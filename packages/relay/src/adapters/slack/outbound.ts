/**
 * Slack outbound message delivery.
 *
 * Handles deliver() implementation including Slack's native streaming API
 * for real-time token-by-token responses, standard postMessage for
 * non-StreamEvent payloads, threading, and echo prevention.
 *
 * @module relay/adapters/slack-outbound
 */
import { randomUUID } from 'node:crypto';
import type { WebClient } from '@slack/web-api';
import type { RelayEnvelope } from '@dorkos/shared/relay-schemas';
import type { AdapterOutboundCallbacks, DeliveryResult } from '../../types.js';
import {
  extractPayloadContent,
  detectStreamEventType,
  extractTextDelta,
  extractErrorMessage,
  truncateText,
  SILENT_EVENT_TYPES,
  formatForPlatform,
} from '../../lib/payload-utils.js';
import { extractChannelId, SUBJECT_PREFIX, MAX_MESSAGE_LENGTH } from './inbound.js';

// === Types ===

/** Minimum interval (ms) between chat.update calls for a single stream. */
const STREAM_UPDATE_INTERVAL_MS = 1_000;

/** Maximum age (ms) before an orphaned stream entry is reaped. */
const STREAM_TTL_MS = 5 * 60 * 1_000;

/** Active stream state for a channel (keyed by channelId:threadTs). */
export interface ActiveStream {
  /** The channel ID being streamed to. */
  channelId: string;
  /** The thread_ts to reply under. */
  threadTs: string;
  /** The message ts returned by chat.postMessage (updated by streaming). */
  messageTs: string;
  /** Accumulated raw Markdown text content for the stream. */
  accumulatedText: string;
  /** Timestamp (ms) of the last chat.update call — used for throttling. */
  lastUpdateAt: number;
  /** Timestamp (ms) when the stream was created — used for TTL reaping. */
  startedAt: number;
  /** Unique ID for this stream — used to detect async race conditions in handleDone. */
  streamId: string;
}

/** Options for delivering a Relay message to Slack. */
export interface SlackDeliverOptions {
  adapterId: string;
  subject: string;
  envelope: RelayEnvelope;
  client: WebClient | null;
  streamState: Map<string, ActiveStream>;
  botUserId: string;
  callbacks: AdapterOutboundCallbacks;
  streaming: boolean;
  typingIndicator: 'none' | 'reaction';
}

// === Helpers ===

/**
 * Build a composite key for stream state that is thread-safe.
 *
 * When replying in a thread, different threads in the same channel
 * get independent stream state.
 *
 * @param channelId - The Slack channel ID
 * @param threadTs - Optional thread timestamp
 */
function streamKey(channelId: string, threadTs?: string): string {
  return threadTs ? `${channelId}:${threadTs}` : channelId;
}

/**
 * Resolve the thread_ts from a relay envelope for threading replies.
 *
 * Looks for platformData.threadTs (already in a thread) or platformData.ts
 * (the original message — start a new thread) from the inbound message context
 * carried through the relay envelope.
 *
 * @param envelope - The relay envelope to inspect
 */
function resolveThreadTs(envelope: RelayEnvelope): string | undefined {
  const payload = envelope.payload;
  if (payload === null || typeof payload !== 'object') return undefined;

  const obj = payload as Record<string, unknown>;
  const pd = obj.platformData as Record<string, unknown> | undefined;
  if (!pd) return undefined;

  // threadTs takes precedence (already in a thread)
  if (typeof pd.threadTs === 'string' && pd.threadTs) return pd.threadTs;
  // ts of the original message (start a new thread)
  if (typeof pd.ts === 'string' && pd.ts) return pd.ts;

  return undefined;
}

/**
 * Execute a Slack API call and return a DeliveryResult.
 *
 * Wraps common try/catch + duration + error recording logic shared
 * across all stream handlers.
 *
 * @param fn - The async Slack API operation to execute
 * @param callbacks - Callbacks for error recording
 * @param startTime - Timestamp (ms) for delivery duration calculation
 * @param trackDelivery - Whether to call trackOutbound on success
 */
async function wrapSlackCall(
  fn: () => Promise<unknown>,
  callbacks: AdapterOutboundCallbacks,
  startTime: number,
  trackDelivery = false,
): Promise<DeliveryResult> {
  try {
    await fn();
    if (trackDelivery) callbacks.trackOutbound();
    return { success: true, durationMs: Date.now() - startTime };
  } catch (err) {
    callbacks.recordError(err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Add a typing indicator reaction to the user's original message.
 *
 * Fire-and-forget — errors are silently swallowed since typing
 * indicators are best-effort.
 *
 * @param client - Slack WebClient instance
 * @param channelId - The Slack channel ID
 * @param threadTs - The message timestamp to react to
 * @param typingIndicator - The typing indicator mode
 */
function addTypingReaction(
  client: WebClient,
  channelId: string,
  threadTs: string | undefined,
  typingIndicator: 'none' | 'reaction',
): void {
  if (typingIndicator !== 'reaction' || !threadTs) return;
  void client.reactions
    .add({
      channel: channelId,
      name: 'hourglass_flowing_sand',
      timestamp: threadTs,
    })
    .catch(() => {}); // Silently swallow errors
}

/**
 * Remove the typing indicator reaction from the user's original message.
 *
 * Fire-and-forget — errors are silently swallowed since typing
 * indicators are best-effort.
 *
 * @param client - Slack WebClient instance
 * @param channelId - The Slack channel ID
 * @param threadTs - The message timestamp to remove the reaction from
 * @param typingIndicator - The typing indicator mode
 */
function removeTypingReaction(
  client: WebClient,
  channelId: string,
  threadTs: string | undefined,
  typingIndicator: 'none' | 'reaction',
): void {
  if (typingIndicator !== 'reaction' || !threadTs) return;
  void client.reactions
    .remove({
      channel: channelId,
      name: 'hourglass_flowing_sand',
      timestamp: threadTs,
    })
    .catch(() => {}); // Silently swallow errors
}

// === Stream handlers ===

/**
 * Handle a text_delta StreamEvent — start or append to a streaming message.
 *
 * On the first delta for a channel+thread, posts a new message via chat.postMessage
 * and stores the returned ts in streamState. On subsequent deltas, appends
 * the mrkdwn chunk to the accumulated text and updates the message via
 * chat.update (live editing effect).
 *
 * @param channelId - The Slack channel ID
 * @param textChunk - The raw text chunk to append
 * @param threadTs - Optional thread_ts to reply under
 * @param client - Slack WebClient instance
 * @param streamState - Per-channel active stream state map
 * @param callbacks - Callbacks to track delivery metrics
 * @param startTime - Timestamp (ms) for delivery duration calculation
 * @param streaming - Whether to post/update in real time or buffer silently
 * @param typingIndicator - Typing indicator mode for reaction add/remove
 * @param streamKeyTs - Correlation ID for stream key (may be synthetic envelope ID)
 */
async function handleTextDelta(
  channelId: string,
  textChunk: string,
  threadTs: string | undefined,
  client: WebClient,
  streamState: Map<string, ActiveStream>,
  callbacks: AdapterOutboundCallbacks,
  startTime: number,
  streaming: boolean,
  typingIndicator: 'none' | 'reaction',
  streamKeyTs: string,
): Promise<DeliveryResult> {
  const key = streamKey(channelId, streamKeyTs);
  const existing = streamState.get(key);

  // Buffered mode: accumulate text without posting or updating
  if (!streaming) {
    if (existing) {
      existing.accumulatedText += textChunk;
    } else {
      streamState.set(key, {
        channelId,
        threadTs: threadTs ?? '',
        messageTs: '', // No message posted yet
        accumulatedText: textChunk,
        lastUpdateAt: 0,
        startedAt: Date.now(),
        streamId: randomUUID(),
      });

      // Add typing indicator reaction on stream start (fire-and-forget)
      addTypingReaction(client, channelId, threadTs, typingIndicator);
    }
    return { success: true, durationMs: Date.now() - startTime };
  }

  if (existing) {
    // Accumulate raw Markdown — converted to mrkdwn at send time
    existing.accumulatedText += textChunk;

    // Throttle: skip chat.update if called less than STREAM_UPDATE_INTERVAL_MS ago.
    // The done handler always sends a final update, so no text is lost.
    const now = Date.now();
    if (now - existing.lastUpdateAt < STREAM_UPDATE_INTERVAL_MS) {
      return { success: true, durationMs: now - startTime };
    }
    existing.lastUpdateAt = now;

    // Collapse consecutive newlines on intermediate updates to work around
    // slackify-markdown inserting \n\n paragraph separation (Issue #40).
    // The final flush in handleDone preserves full paragraph formatting.
    const formatted = formatForPlatform(existing.accumulatedText, 'slack');
    const streamText = formatted.replace(/\n{2,}/g, '\n');

    return wrapSlackCall(
      () =>
        client.chat.update({
          channel: channelId,
          ts: existing.messageTs,
          text: truncateText(streamText, MAX_MESSAGE_LENGTH),
        }),
      callbacks,
      startTime,
    );
  }

  // Start new stream — post initial message
  try {
    const mrkdwn = formatForPlatform(textChunk, 'slack');
    const now = Date.now();
    const result = await client.chat.postMessage({
      channel: channelId,
      text: truncateText(mrkdwn, MAX_MESSAGE_LENGTH),
      ...(threadTs ? { thread_ts: threadTs } : {}),
    });

    streamState.set(key, {
      channelId,
      threadTs: threadTs ?? '',
      messageTs: (result as { ts?: string }).ts ?? '',
      accumulatedText: textChunk,
      lastUpdateAt: now,
      startedAt: now,
      streamId: randomUUID(),
    });

    // Add typing indicator reaction on stream start (fire-and-forget)
    addTypingReaction(client, channelId, threadTs, typingIndicator);

    return { success: true, durationMs: now - startTime };
  } catch (err) {
    callbacks.recordError(err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Handle a done StreamEvent — finalize the streaming message.
 *
 * Performs a final chat.update to ensure the message has the complete
 * accumulated text, then removes the channel from streamState.
 *
 * @param channelId - The Slack channel ID
 * @param threadTs - Optional thread_ts for Slack API calls
 * @param client - Slack WebClient instance
 * @param streamState - Per-channel active stream state map
 * @param callbacks - Callbacks to track delivery metrics
 * @param startTime - Timestamp (ms) for delivery duration calculation
 * @param typingIndicator - Typing indicator mode for reaction removal
 * @param streamKeyTs - Correlation ID for stream key (may be synthetic envelope ID)
 */
async function handleDone(
  channelId: string,
  threadTs: string | undefined,
  client: WebClient,
  streamState: Map<string, ActiveStream>,
  callbacks: AdapterOutboundCallbacks,
  startTime: number,
  typingIndicator: 'none' | 'reaction',
  streamKeyTs: string,
): Promise<DeliveryResult> {
  const key = streamKey(channelId, streamKeyTs);
  const existing = streamState.get(key);
  streamState.delete(key);

  // Remove typing indicator reaction (fire-and-forget)
  if (existing?.threadTs) {
    removeTypingReaction(client, channelId, existing.threadTs, typingIndicator);
  }

  if (!existing) {
    // No active stream — nothing to finalize
    return { success: true, durationMs: Date.now() - startTime };
  }

  // Buffered mode: post accumulated text as a new message
  if (!existing.messageTs) {
    return wrapSlackCall(
      () =>
        client.chat.postMessage({
          channel: channelId,
          text: truncateText(
            formatForPlatform(existing.accumulatedText, 'slack'),
            MAX_MESSAGE_LENGTH,
          ),
          ...(threadTs ? { thread_ts: threadTs } : {}),
        }),
      callbacks,
      startTime,
      true,
    );
  }

  // Streaming mode: update existing message
  return wrapSlackCall(
    () =>
      client.chat.update({
        channel: channelId,
        ts: existing.messageTs,
        text: truncateText(
          formatForPlatform(existing.accumulatedText, 'slack'),
          MAX_MESSAGE_LENGTH,
        ),
      }),
    callbacks,
    startTime,
    true,
  );
}

/**
 * Handle an error StreamEvent — append error text and finalize.
 *
 * If a stream is active, appends the error message to the accumulated text
 * and updates the message. Otherwise, posts a standalone error message.
 *
 * @param channelId - The Slack channel ID
 * @param errorMsg - The error message to display
 * @param threadTs - Optional thread_ts for Slack API calls
 * @param client - Slack WebClient instance
 * @param streamState - Per-channel active stream state map
 * @param callbacks - Callbacks to track delivery metrics
 * @param startTime - Timestamp (ms) for delivery duration calculation
 * @param typingIndicator - Typing indicator mode for reaction removal
 * @param streamKeyTs - Correlation ID for stream key (may be synthetic envelope ID)
 */
async function handleError(
  channelId: string,
  errorMsg: string,
  threadTs: string | undefined,
  client: WebClient,
  streamState: Map<string, ActiveStream>,
  callbacks: AdapterOutboundCallbacks,
  startTime: number,
  typingIndicator: 'none' | 'reaction',
  streamKeyTs: string,
): Promise<DeliveryResult> {
  const key = streamKey(channelId, streamKeyTs);
  const existing = streamState.get(key);
  streamState.delete(key);

  // Remove typing indicator reaction (fire-and-forget)
  if (existing?.threadTs) {
    removeTypingReaction(client, channelId, existing.threadTs, typingIndicator);
  }

  if (existing) {
    const finalText = truncateText(
      `${formatForPlatform(existing.accumulatedText, 'slack')}\n\n[Error: ${errorMsg}]`,
      MAX_MESSAGE_LENGTH,
    );

    // Buffered mode: post as new message
    if (!existing.messageTs) {
      return wrapSlackCall(
        () =>
          client.chat.postMessage({
            channel: channelId,
            text: finalText,
            ...(threadTs ? { thread_ts: threadTs } : {}),
          }),
        callbacks,
        startTime,
        true,
      );
    }

    // Streaming mode: update existing message
    return wrapSlackCall(
      () =>
        client.chat.update({
          channel: channelId,
          ts: existing.messageTs,
          text: finalText,
        }),
      callbacks,
      startTime,
      true,
    );
  }

  // No active stream — post standalone error message
  const text = truncateText(`[Error: ${errorMsg}]`, MAX_MESSAGE_LENGTH);
  return wrapSlackCall(
    () =>
      client.chat.postMessage({
        channel: channelId,
        text,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      }),
    callbacks,
    startTime,
    true,
  );
}

// === Public API ===

/**
 * Deliver a Relay message to the Slack channel identified by the subject.
 *
 * For StreamEvent payloads:
 * - `text_delta`: Starts a new streaming message (via `chat.postMessage`) on the
 *   first chunk, then updates it (via `chat.update`) on subsequent chunks.
 *   Text is converted from Markdown to mrkdwn using `formatForPlatform()`.
 * - `done`: Finalizes the stream with a final `chat.update`.
 * - `error`: Appends error text and finalizes.
 * - Silent events: Skipped.
 *
 * For standard payloads:
 * - Extracts content, converts to mrkdwn, sends via `chat.postMessage` with `thread_ts`.
 *
 * All bot responses are threaded under the original inbound message using
 * `platformData.ts` as the `thread_ts`.
 *
 * @param opts - Delivery options
 */
export async function deliverMessage(opts: SlackDeliverOptions): Promise<DeliveryResult> {
  const { adapterId, subject, envelope, client, streamState, callbacks } = opts;
  const startTime = Date.now();

  // Reap orphaned streams that never received a done/error event
  for (const [key, stream] of streamState) {
    if (startTime - stream.startedAt > STREAM_TTL_MS) {
      streamState.delete(key);
    }
  }

  // Echo prevention: skip messages originating from this adapter.
  if (envelope.from.startsWith(SUBJECT_PREFIX)) {
    return { success: true, durationMs: Date.now() - startTime };
  }

  if (!client) {
    return {
      success: false,
      error: `SlackAdapter(${adapterId}): not started`,
      durationMs: Date.now() - startTime,
    };
  }

  const channelId = extractChannelId(subject);
  if (!channelId) {
    return {
      success: false,
      error: `SlackAdapter(${adapterId}): cannot extract channel ID from subject '${subject}'`,
      durationMs: Date.now() - startTime,
    };
  }

  // Resolve thread_ts from the original inbound message's platformData.
  // This is used for Slack API calls (thread_ts, reactions timestamp).
  const threadTs = resolveThreadTs(envelope);

  // For stream key differentiation, use a value that is consistent across all
  // events in a single agent response stream. Priority:
  // 1. threadTs — real Slack timestamp (always present for messages from Slack users)
  // 2. correlationId — shared across events from the same request
  // 3. envelope.from — agent session ID (e.g. "agent:session-abc"), consistent
  //    across all stream events from one response
  // This prevents concurrent responses in the same channel from colliding
  // on just the channelId.
  const payloadObj = envelope.payload && typeof envelope.payload === 'object'
    ? (envelope.payload as Record<string, unknown>)
    : undefined;
  const payloadCorrelationId = payloadObj?.correlationId as string | undefined;
  const streamKeyTs = threadTs ?? payloadCorrelationId ?? envelope.from;

  // --- StreamEvent-aware delivery ---
  const eventType = detectStreamEventType(envelope.payload);

  if (eventType) {
    // text_delta: start or update streaming message
    const textChunk = extractTextDelta(envelope.payload);
    if (textChunk) {
      return handleTextDelta(
        channelId,
        textChunk,
        threadTs,
        client,
        streamState,
        callbacks,
        startTime,
        opts.streaming,
        opts.typingIndicator,
        streamKeyTs,
      );
    }

    // error: append error text and finalize
    const errorMsg = extractErrorMessage(envelope.payload);
    if (errorMsg) {
      return handleError(
        channelId,
        errorMsg,
        threadTs,
        client,
        streamState,
        callbacks,
        startTime,
        opts.typingIndicator,
        streamKeyTs,
      );
    }

    // done: finalize the stream
    if (eventType === 'done') {
      return handleDone(
        channelId,
        threadTs,
        client,
        streamState,
        callbacks,
        startTime,
        opts.typingIndicator,
        streamKeyTs,
      );
    }

    // Silent events: skip without sending anything
    if (SILENT_EVENT_TYPES.has(eventType)) {
      return { success: true, durationMs: Date.now() - startTime };
    }
  }

  // --- Standard payload (non-StreamEvent) ---
  const content = extractPayloadContent(envelope.payload);
  const mrkdwn = formatForPlatform(content, 'slack');
  const text = truncateText(mrkdwn, MAX_MESSAGE_LENGTH);

  return wrapSlackCall(
    () =>
      client.chat.postMessage({
        channel: channelId,
        text,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      }),
    callbacks,
    startTime,
    true,
  );
}
