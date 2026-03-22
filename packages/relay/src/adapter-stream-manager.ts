/**
 * Relay-level stream aggregation manager.
 *
 * Intercepts StreamEvent payloads (text_delta, done, error, approval_required)
 * before they reach adapters. For adapters that implement `deliverStream()`,
 * aggregates text_delta events into an AsyncQueue and delivers the stream
 * as a single AsyncIterable. Falls back to per-event `deliver()` for adapters
 * that don't implement streaming.
 *
 * @module relay/adapter-stream-manager
 */
import type { RelayEnvelope } from '@dorkos/shared/relay-schemas';
import type {
  RelayAdapter,
  StreamableAdapter,
  AdapterContext,
  DeliveryResult,
  RelayLogger,
} from './types.js';
import { noopLogger } from './types.js';
import { AsyncQueue } from './lib/async-queue.js';
import { extractTextDelta, extractErrorMessage } from './lib/payload-utils.js';

/** Tracked state for an in-flight stream being delivered to an adapter. */
interface ActiveStreamContext {
  /** The async queue that text_delta chunks are pushed into. */
  queue: AsyncQueue<string>;
  /** Timestamp (ms) when the stream started — used for TTL reaping. */
  startedAt: number;
  /** The background promise for the deliverStream() call. */
  deliveryPromise: Promise<DeliveryResult>;
}

/**
 * Relay-level stream aggregation manager.
 *
 * Keyed by `{adapterId}:{threadId}` to support concurrent streams across
 * different conversations and adapters.
 */
export class AdapterStreamManager {
  /** TTL for abandoned streams — matches existing BUFFER_TTL_MS (5 min). */
  static readonly STREAM_TTL_MS = 5 * 60 * 1_000;

  /** Reaping interval for abandoned streams (60 seconds). */
  static readonly REAP_INTERVAL_MS = 60_000;

  private readonly streams = new Map<string, ActiveStreamContext>();
  private reapTimer: ReturnType<typeof setInterval> | null = null;
  private readonly logger: RelayLogger;

  constructor(logger?: RelayLogger) {
    this.logger = logger ?? noopLogger;
  }

  /** Start the TTL reaper interval. Call on relay startup. */
  start(): void {
    this.reapTimer = setInterval(
      () => this.reapStaleStreams(),
      AdapterStreamManager.REAP_INTERVAL_MS
    );
  }

  /** Stop the reaper and complete all active streams. Call on relay shutdown. */
  async stop(): Promise<void> {
    if (this.reapTimer) {
      clearInterval(this.reapTimer);
      this.reapTimer = null;
    }
    for (const [key, ctx] of this.streams) {
      ctx.queue.complete();
      this.streams.delete(key);
    }
  }

  /** Number of active streams (for testing/diagnostics). */
  get activeStreamCount(): number {
    return this.streams.size;
  }

  /**
   * Route a StreamEvent to the appropriate handler.
   *
   * Returns `null` when the adapter does not implement `deliverStream()` or
   * when the caller should fall through to `adapter.deliver()` (e.g., after
   * flushing the queue for `approval_required`).
   *
   * @param adapterId - The matched adapter's ID
   * @param threadId - Platform thread ID (extracted by the adapter's codec)
   * @param eventType - The StreamEvent type (text_delta, done, error, approval_required)
   * @param envelope - The relay envelope
   * @param adapter - The matched adapter (for deliverStream/deliver fallback)
   * @param subject - The relay subject
   * @param context - Optional adapter context
   * @returns DeliveryResult, or null if the stream manager did not handle this event
   */
  async handleStreamEvent(
    adapterId: string,
    threadId: string,
    eventType: string,
    envelope: RelayEnvelope,
    adapter: RelayAdapter,
    subject: string,
    context?: AdapterContext
  ): Promise<DeliveryResult | null> {
    // Only intercept if the adapter implements deliverStream
    if (
      !('deliverStream' in adapter) ||
      typeof (adapter as StreamableAdapter).deliverStream !== 'function'
    ) {
      return null; // Fall through to adapter.deliver()
    }

    const streamKey = `${adapterId}:${threadId}`;

    switch (eventType) {
      case 'text_delta':
        return this.handleTextDelta(
          streamKey,
          envelope,
          adapter as StreamableAdapter,
          threadId,
          subject,
          context
        );
      case 'done':
        return this.handleDone(streamKey);
      case 'error':
        return this.handleError(streamKey, envelope);
      case 'approval_required':
        return this.handleApprovalRequired(streamKey);
      default:
        return { success: true }; // Silently drop unknown stream events
    }
  }

  /**
   * Handle a text_delta event. Creates a new stream on first delta,
   * pushes subsequent deltas to the existing queue.
   */
  private handleTextDelta(
    streamKey: string,
    envelope: RelayEnvelope,
    adapter: StreamableAdapter,
    threadId: string,
    subject: string,
    context?: AdapterContext
  ): DeliveryResult {
    // Use the existing extractTextDelta from payload-utils (handles nested data.text)
    const textChunk = extractTextDelta(envelope.payload);
    if (!textChunk) return { success: true };

    const existing = this.streams.get(streamKey);
    if (existing) {
      existing.queue.push(textChunk);
      return { success: true };
    }

    // Create a new stream
    const queue = new AsyncQueue<string>();
    const deliveryPromise = adapter.deliverStream(subject, threadId, queue, context).catch(
      (err): DeliveryResult => ({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    );

    this.streams.set(streamKey, {
      queue,
      startedAt: Date.now(),
      deliveryPromise,
    });

    queue.push(textChunk);
    return { success: true };
  }

  /** Handle a done event. Complete the queue and await delivery. */
  private async handleDone(streamKey: string): Promise<DeliveryResult> {
    const ctx = this.streams.get(streamKey);
    if (!ctx) return { success: true };

    ctx.queue.complete();
    this.streams.delete(streamKey);

    try {
      return await ctx.deliveryPromise;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Handle an error event. Fail the queue and await delivery. */
  private async handleError(streamKey: string, envelope: RelayEnvelope): Promise<DeliveryResult> {
    const ctx = this.streams.get(streamKey);
    if (!ctx) return { success: true };

    // Use the existing extractErrorMessage from payload-utils (handles nested data.message)
    const errorMsg = extractErrorMessage(envelope.payload);
    ctx.queue.fail(new Error(errorMsg ?? 'Unknown stream error'));
    this.streams.delete(streamKey);

    try {
      await ctx.deliveryPromise;
    } catch {
      // Expected — the queue was failed; delivery rejection is best-effort
    }
    return { success: true };
  }

  /**
   * Handle an approval_required event. Complete the current stream
   * (flush buffered text) then return null to fall through to deliver().
   */
  private async handleApprovalRequired(streamKey: string): Promise<DeliveryResult | null> {
    const ctx = this.streams.get(streamKey);
    if (ctx) {
      ctx.queue.complete();
      this.streams.delete(streamKey);
      try {
        await ctx.deliveryPromise;
      } catch {
        // Best effort — stream may have failed
      }
    }
    return null; // Signal caller to fall through to adapter.deliver()
  }

  /** Reap streams that have exceeded the TTL. */
  private reapStaleStreams(): void {
    const now = Date.now();
    for (const [key, ctx] of this.streams) {
      if (now - ctx.startedAt > AdapterStreamManager.STREAM_TTL_MS) {
        const ageSeconds = Math.round((now - ctx.startedAt) / 1000);
        this.logger.warn(`Reaping stale stream: ${key} (age: ${ageSeconds}s)`);
        ctx.queue.complete();
        this.streams.delete(key);
      }
    }
  }
}
