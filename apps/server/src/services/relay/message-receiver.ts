/**
 * Bridge between Relay message bus and AgentManager.
 *
 * Subscribes to `relay.agent.>` and `relay.system.pulse.>` subjects,
 * dispatches incoming messages to the appropriate agent session, and
 * publishes response events back via the Relay. Records trace spans
 * throughout the message lifecycle.
 *
 * @module services/relay/message-receiver
 */
import { randomUUID } from 'node:crypto';
import type { RelayCore, PublishResult } from '@dorkos/relay';
import type { StreamEvent } from '@dorkos/shared/types';
import type { RelayEnvelope, TraceSpan } from '@dorkos/shared/relay-schemas';
import { PulseDispatchPayloadSchema } from '@dorkos/shared/relay-schemas';
import type { PulseStore } from '../pulse/pulse-store.js';
import type { TraceStore } from './trace-store.js';
import { logger } from '../../lib/logger.js';

/** Maximum characters to collect for run output summary. */
const OUTPUT_SUMMARY_MAX_CHARS = 1000;

/** Minimal AgentManager interface for dependency injection. */
export interface AgentManagerLike {
  ensureSession(
    sessionId: string,
    opts: { permissionMode: string; cwd?: string; hasStarted?: boolean },
  ): void;
  sendMessage(
    sessionId: string,
    content: string,
    opts?: { permissionMode?: string; cwd?: string },
  ): AsyncGenerator<StreamEvent>;
}

/** Options for constructing a MessageReceiver. */
export interface MessageReceiverOptions {
  relayCore: RelayCore;
  agentManager: AgentManagerLike;
  traceStore: TraceStore;
  defaultCwd?: string;
  /** Optional PulseStore for updating run lifecycle on pulse dispatch messages. */
  pulseStore?: PulseStore;
}

/** Subject prefix for agent-bound messages. */
const AGENT_SUBJECT_PREFIX = 'relay.agent.';

/** Subject prefix for Pulse dispatch messages. */
const PULSE_SUBJECT_PREFIX = 'relay.system.pulse.';

/**
 * Receives Relay messages and dispatches them to agent sessions.
 *
 * Subscribes to wildcard patterns on construction via `start()`, and
 * unsubscribes on `stop()`. Handles both agent-directed messages and
 * Pulse scheduler dispatch messages.
 */
export class MessageReceiver {
  private readonly relayCore: RelayCore;
  private readonly agentManager: AgentManagerLike;
  private readonly traceStore: TraceStore;
  private readonly defaultCwd: string | undefined;
  private readonly pulseStore: PulseStore | undefined;
  private unsubscribers: Array<() => void> = [];

  constructor(options: MessageReceiverOptions) {
    this.relayCore = options.relayCore;
    this.agentManager = options.agentManager;
    this.traceStore = options.traceStore;
    this.defaultCwd = options.defaultCwd;
    this.pulseStore = options.pulseStore;
  }

  /**
   * Subscribe to relay agent and pulse subjects.
   *
   * Registers subscription handlers for `relay.agent.>` and
   * `relay.system.pulse.>` patterns via RelayCore.
   */
  start(): void {
    const agentUnsub = this.relayCore.subscribe(
      'relay.agent.>',
      (envelope: RelayEnvelope) => {
        void this.handleAgentMessage(envelope);
      },
    );

    const pulseUnsub = this.relayCore.subscribe(
      'relay.system.pulse.>',
      (envelope: RelayEnvelope) => {
        void this.handlePulseMessage(envelope);
      },
    );

    this.unsubscribers.push(agentUnsub, pulseUnsub);
    logger.info('[MessageReceiver] Started — subscribed to relay.agent.> and relay.system.pulse.>');
  }

  /**
   * Handle a message addressed to an agent session.
   *
   * Extracts the session ID from the subject (3rd segment of
   * `relay.agent.{sessionId}`), ensures the session exists, sends
   * the message content, and publishes response chunks to the
   * envelope's `replyTo` subject with an incremented hop count.
   *
   * @param envelope - The incoming relay envelope
   */
  async handleAgentMessage(envelope: RelayEnvelope): Promise<void> {
    const sessionId = extractSessionId(envelope.subject);
    if (!sessionId) {
      logger.warn('[MessageReceiver] Could not extract sessionId from subject:', envelope.subject);
      return;
    }

    const traceId = randomUUID();
    const spanId = randomUUID();
    const now = Date.now();

    // Record initial trace span as pending
    const span: TraceSpan = {
      messageId: envelope.id,
      traceId,
      spanId,
      parentSpanId: null,
      subject: envelope.subject,
      fromEndpoint: envelope.from,
      toEndpoint: `agent:${sessionId}`,
      status: 'pending',
      budgetHopsUsed: envelope.budget.hopCount,
      budgetTtlRemainingMs: envelope.budget.ttl - now,
      sentAt: now,
      deliveredAt: null,
      processedAt: null,
      error: null,
    };
    this.traceStore.insertSpan(span);

    try {
      // Ensure the agent session exists
      this.agentManager.ensureSession(sessionId, {
        permissionMode: 'default',
        cwd: this.defaultCwd,
        hasStarted: true,
      });

      // Extract message content from payload
      const content = extractPayloadContent(envelope.payload);

      // Send message and collect response events
      const eventStream = this.agentManager.sendMessage(sessionId, content, {
        cwd: this.defaultCwd,
      });

      // Publish response events to replyTo if specified
      if (envelope.replyTo) {
        for await (const event of eventStream) {
          await this.publishResponse(envelope, event);
        }
      } else {
        // Drain the stream even if no replyTo
        for await (const _event of eventStream) {
          // consumed
        }
      }

      // Update trace to processed
      this.traceStore.updateSpan(envelope.id, {
        status: 'processed',
        processedAt: Date.now(),
      });

      logger.debug('[MessageReceiver] Processed agent message', {
        sessionId,
        messageId: envelope.id,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.traceStore.updateSpan(envelope.id, {
        status: 'failed',
        processedAt: Date.now(),
        error: errorMsg,
      });
      logger.error('[MessageReceiver] Agent message failed:', errorMsg, {
        sessionId,
        messageId: envelope.id,
      });
    }
  }

  /**
   * Handle a Pulse scheduler dispatch message.
   *
   * Validates the payload against PulseDispatchPayloadSchema, creates an
   * agent session for the run, streams the response, and updates the run
   * lifecycle in PulseStore. Publishes response events to `replyTo` if set.
   *
   * @param envelope - The incoming relay envelope
   */
  async handlePulseMessage(envelope: RelayEnvelope): Promise<void> {
    const traceId = randomUUID();
    const spanId = randomUUID();
    const now = Date.now();

    // Validate payload type
    const parsed = PulseDispatchPayloadSchema.safeParse(envelope.payload);
    if (!parsed.success) {
      logger.warn('[MessageReceiver] Invalid PulseDispatchPayload', {
        messageId: envelope.id,
        errors: parsed.error.flatten().fieldErrors,
      });
      // Record failed trace for invalid payloads
      const failSpan: TraceSpan = {
        messageId: envelope.id,
        traceId,
        spanId,
        parentSpanId: null,
        subject: envelope.subject,
        fromEndpoint: envelope.from,
        toEndpoint: `pulse:unknown`,
        status: 'failed',
        budgetHopsUsed: envelope.budget.hopCount,
        budgetTtlRemainingMs: envelope.budget.ttl - now,
        sentAt: now,
        deliveredAt: now,
        processedAt: now,
        error: `Invalid PulseDispatchPayload: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
      };
      this.traceStore.insertSpan(failSpan);
      return;
    }

    const payload = parsed.data;
    const { scheduleId, runId, prompt, cwd, permissionMode } = payload;
    const effectiveCwd = cwd ?? this.defaultCwd;

    // Record trace span as delivered
    const span: TraceSpan = {
      messageId: envelope.id,
      traceId,
      spanId,
      parentSpanId: null,
      subject: envelope.subject,
      fromEndpoint: envelope.from,
      toEndpoint: `pulse:${scheduleId}`,
      status: 'delivered',
      budgetHopsUsed: envelope.budget.hopCount,
      budgetTtlRemainingMs: envelope.budget.ttl - now,
      sentAt: now,
      deliveredAt: now,
      processedAt: null,
      error: null,
    };
    this.traceStore.insertSpan(span);

    // Set up timeout from remaining TTL budget
    const ttlRemaining = envelope.budget.ttl - Date.now();
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (ttlRemaining <= 0) {
      controller.abort();
    } else {
      timeout = setTimeout(() => controller.abort(), ttlRemaining);
    }

    const startTime = Date.now();
    let outputSummary = '';

    try {
      // Check if already timed out before starting
      if (controller.signal.aborted) {
        throw new Error('Run timed out (TTL budget expired)');
      }

      // Ensure agent session and send the prompt
      this.agentManager.ensureSession(runId, {
        permissionMode,
        cwd: effectiveCwd,
        hasStarted: false,
      });

      const eventStream = this.agentManager.sendMessage(runId, prompt, {
        cwd: effectiveCwd,
      });

      // Collect output and optionally publish responses
      for await (const event of eventStream) {
        if (controller.signal.aborted) break;

        // Collect text_delta events for output summary
        if (event.type === 'text_delta' && outputSummary.length < OUTPUT_SUMMARY_MAX_CHARS) {
          const data = event.data as { text: string };
          outputSummary += data.text;
        }

        // Publish response events to replyTo if specified
        if (envelope.replyTo) {
          await this.publishResponse(envelope, event);
        }
      }

      const durationMs = Date.now() - startTime;
      const truncatedSummary = outputSummary.slice(0, OUTPUT_SUMMARY_MAX_CHARS);

      // Update run to completed in PulseStore
      if (this.pulseStore) {
        if (controller.signal.aborted) {
          this.pulseStore.updateRun(runId, {
            status: 'cancelled',
            finishedAt: new Date().toISOString(),
            durationMs,
            outputSummary: truncatedSummary,
            error: 'Run timed out (TTL budget expired)',
            sessionId: runId,
          });
        } else {
          this.pulseStore.updateRun(runId, {
            status: 'completed',
            finishedAt: new Date().toISOString(),
            durationMs,
            outputSummary: truncatedSummary,
            sessionId: runId,
          });
        }
      }

      // Update trace to processed
      this.traceStore.updateSpan(envelope.id, {
        status: 'processed',
        processedAt: Date.now(),
      });

      logger.info('[MessageReceiver] Pulse dispatch completed', {
        scheduleId,
        runId,
        durationMs,
        messageId: envelope.id,
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Update run to failed in PulseStore
      if (this.pulseStore) {
        this.pulseStore.updateRun(runId, {
          status: 'failed',
          finishedAt: new Date().toISOString(),
          durationMs,
          outputSummary: outputSummary.slice(0, OUTPUT_SUMMARY_MAX_CHARS),
          error: errorMsg,
          sessionId: runId,
        });
      }

      // Update trace to failed
      this.traceStore.updateSpan(envelope.id, {
        status: 'failed',
        processedAt: Date.now(),
        error: errorMsg,
      });

      logger.error('[MessageReceiver] Pulse dispatch failed:', errorMsg, {
        scheduleId,
        runId,
        messageId: envelope.id,
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  /** Unsubscribe from all relay subjects. */
  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    logger.info('[MessageReceiver] Stopped');
  }

  /**
   * Publish a response event to the envelope's replyTo subject.
   *
   * Increments the hop count from the original envelope's budget.
   */
  private async publishResponse(
    originalEnvelope: RelayEnvelope,
    event: StreamEvent,
  ): Promise<PublishResult> {
    return this.relayCore.publish(originalEnvelope.replyTo!, event, {
      from: `agent:${extractSessionId(originalEnvelope.subject)}`,
      budget: {
        hopCount: originalEnvelope.budget.hopCount + 1,
      },
    });
  }
}

/**
 * Extract session ID from a relay subject.
 *
 * Given `relay.agent.{sessionId}`, returns the sessionId (3rd segment).
 * Returns null if the subject does not have the expected format.
 *
 * @internal Exported for testing only.
 */
export function extractSessionId(subject: string): string | null {
  const segments = subject.split('.');
  // relay.agent.{sessionId} = 3 segments minimum
  if (segments.length < 3 || segments[0] !== 'relay' || segments[1] !== 'agent') {
    return null;
  }
  return segments[2] || null;
}

/**
 * Extract message content string from an envelope payload.
 *
 * Handles both string payloads and object payloads with a `content`
 * or `text` field. Falls back to JSON stringification.
 *
 * @internal Exported for testing only.
 */
export function extractPayloadContent(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.text === 'string') return obj.text;
  }
  return JSON.stringify(payload);
}
