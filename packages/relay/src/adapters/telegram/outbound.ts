/**
 * Telegram outbound message delivery.
 *
 * Handles deliver() implementation including message truncation for
 * Telegram's 4096-character limit, StreamEvent-aware buffering,
 * and typing signal management.
 *
 * @module relay/adapters/telegram-outbound
 */
import type { Bot } from 'grammy';
import type { RelayEnvelope } from '@dorkos/shared/relay-schemas';
import type { AdapterContext, AdapterStatus, DeliveryResult } from '../../types.js';
import {
  extractPayloadContent,
  detectStreamEventType,
  extractTextDelta,
  extractErrorMessage,
  SILENT_EVENT_TYPES,
} from '../../lib/payload-utils.js';
import { extractChatId, SUBJECT_PREFIX, MAX_MESSAGE_LENGTH } from './inbound.js';

/** Telegram sendChatAction type for typing indicator. */
const TELEGRAM_TYPING_ACTION = 'typing' as const;

/**
 * Truncate a string to a maximum length, appending an ellipsis if cut.
 *
 * @param text - The text to truncate
 * @param maxLen - Maximum character length
 */
function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

/**
 * Callback interface for reporting status changes from outbound delivery.
 *
 * The facade passes a thin callback so outbound logic can update adapter state
 * without owning the full class instance.
 */
export interface OutboundCallbacks {
  /** Update the adapter status (partial merge). */
  updateStatus: (patch: Partial<AdapterStatus>) => void;
  /** Record an error without throwing. */
  recordError: (err: unknown) => void;
}

/**
 * Send a text message to Telegram and update outbound counter.
 *
 * @param bot - The grammy Bot instance
 * @param chatId - The Telegram chat ID
 * @param text - The message text to send
 * @param startTime - Timestamp (ms) for delivery duration calculation
 * @param status - Current adapter status for counter reads
 * @param callbacks - Callbacks to mutate adapter state
 */
async function sendAndTrack(
  bot: Bot,
  chatId: number,
  text: string,
  startTime: number,
  status: AdapterStatus,
  callbacks: OutboundCallbacks,
): Promise<DeliveryResult> {
  try {
    await bot.api.sendMessage(chatId, text);
    callbacks.updateStatus({
      messageCount: {
        ...status.messageCount,
        outbound: status.messageCount.outbound + 1,
      },
    });
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
 * Deliver a Relay message to the Telegram chat identified by the subject.
 *
 * Extracts the chat ID from the subject, reads the payload content, and
 * sends it via the Telegram Bot API. Outbound content is truncated to
 * Telegram's 4096-character message limit. StreamEvent payloads are buffered
 * per-chat and flushed on 'done' or 'error' events.
 *
 * @param adapterId - The adapter instance ID for error messages
 * @param subject - The Relay subject (e.g. relay.human.telegram.123456)
 * @param envelope - The relay envelope to deliver
 * @param _context - Optional adapter context (unused by this adapter)
 * @param bot - The grammy Bot instance, or null if not started
 * @param responseBuffers - Per-chat response buffer for text_delta accumulation
 * @param status - Current adapter status for counter reads
 * @param callbacks - Callbacks to mutate adapter state
 */
export async function deliverMessage(
  adapterId: string,
  subject: string,
  envelope: RelayEnvelope,
  _context: AdapterContext | undefined,
  bot: Bot | null,
  responseBuffers: Map<number, string>,
  status: AdapterStatus,
  callbacks: OutboundCallbacks,
): Promise<DeliveryResult> {
  const startTime = Date.now();

  // Guard: skip messages that originated from this adapter to prevent echo.
  // Inbound messages are published with `from: relay.human.telegram.bot`,
  // which starts with our subject prefix. Without this guard the publish
  // pipeline routes the message right back to deliver(), creating a loop.
  if (envelope.from.startsWith(SUBJECT_PREFIX)) {
    return { success: true, durationMs: Date.now() - startTime };
  }

  if (!bot) {
    return {
      success: false,
      error: `TelegramAdapter(${adapterId}): not started`,
      durationMs: Date.now() - startTime,
    };
  }

  const chatId = extractChatId(subject);
  if (chatId === null) {
    return {
      success: false,
      error: `TelegramAdapter(${adapterId}): cannot extract chat ID from subject '${subject}'`,
      durationMs: Date.now() - startTime,
    };
  }

  // --- StreamEvent-aware delivery ---
  const eventType = detectStreamEventType(envelope.payload);

  if (eventType) {
    // text_delta: accumulate in buffer
    const textChunk = extractTextDelta(envelope.payload);
    if (textChunk) {
      const existing = responseBuffers.get(chatId) ?? '';
      responseBuffers.set(chatId, existing + textChunk);
      return { success: true, durationMs: Date.now() - startTime };
    }

    // error: flush buffer + send error
    const errorMsg = extractErrorMessage(envelope.payload);
    if (errorMsg) {
      const buffered = responseBuffers.get(chatId) ?? '';
      responseBuffers.delete(chatId);
      const text = buffered
        ? truncateText(`${buffered}\n\n[Error: ${errorMsg}]`, MAX_MESSAGE_LENGTH)
        : truncateText(`[Error: ${errorMsg}]`, MAX_MESSAGE_LENGTH);
      return sendAndTrack(bot, chatId, text, startTime, status, callbacks);
    }

    // done: flush accumulated buffer as a single message
    if (eventType === 'done') {
      const buffered = responseBuffers.get(chatId);
      responseBuffers.delete(chatId);
      if (buffered) {
        return sendAndTrack(bot, chatId, truncateText(buffered, MAX_MESSAGE_LENGTH), startTime, status, callbacks);
      }
      return { success: true, durationMs: Date.now() - startTime };
    }

    // All other StreamEvent types: silently skip
    if (SILENT_EVENT_TYPES.has(eventType)) {
      return { success: true, durationMs: Date.now() - startTime };
    }
  }

  // --- Standard payload (non-StreamEvent) ---
  const content = extractPayloadContent(envelope.payload);
  const text = truncateText(content, MAX_MESSAGE_LENGTH);
  return sendAndTrack(bot, chatId, text, startTime, status, callbacks);
}

/**
 * Handle a typing signal from the Relay and forward it to Telegram.
 *
 * Extracts the chat ID from the subject and sends a `typing` chat action
 * via the Telegram Bot API. Errors are silently swallowed — typing signals
 * are best-effort and non-critical.
 *
 * @param bot - The grammy Bot instance, or null if not started
 * @param subject - The Relay subject the typing signal was emitted on
 * @param state - The signal state ('active' | 'stopped' or other values)
 */
export async function handleTypingSignal(
  bot: Bot | null,
  subject: string,
  state: string,
): Promise<void> {
  if (!bot || state !== 'active') return;

  const chatId = extractChatId(subject);
  if (chatId === null) return;

  try {
    await bot.api.sendChatAction(chatId, TELEGRAM_TYPING_ACTION);
  } catch {
    // Typing signals are best-effort — never throw on failure
  }
}
