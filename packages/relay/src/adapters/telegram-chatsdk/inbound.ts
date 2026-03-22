/**
 * Inbound message handling for the Chat SDK Telegram adapter.
 *
 * Converts Chat SDK {@link Message} objects into Relay-compatible
 * {@link StandardPayload} envelopes and publishes them to the relay bus.
 *
 * @module relay/adapters/telegram-chatsdk/inbound
 */
import type { Message, Thread } from 'chat';
import type { StandardPayload } from '@dorkos/shared/relay-schemas';
import type { RelayPublisher, AdapterInboundCallbacks, RelayLogger } from '../../types.js';
import { noopLogger } from '../../types.js';
import { ChatSdkTelegramThreadIdCodec } from '../../lib/thread-id.js';

/** Subject prefix for all Chat SDK Telegram adapter subjects. */
export const SUBJECT_PREFIX = 'relay.human.telegram-chatsdk';

/** Codec instance for encoding/decoding thread IDs. */
const codec = new ChatSdkTelegramThreadIdCodec();

/** Max length for a single Telegram message (Telegram's hard limit is 4096). */
export const MAX_MESSAGE_LENGTH = 4096;

/** Maximum inbound message content length (32 KB). */
const MAX_CONTENT_LENGTH = 32_768;

/** Sender name used when publishing inbound messages from unresolvable users. */
const UNKNOWN_SENDER = 'unknown';

/** Telegram-specific formatting rules injected into agent system prompts via responseContext. */
const TELEGRAM_FORMATTING_RULES = [
  'FORMATTING RULES (you MUST follow these):',
  '- Do NOT use Markdown tables. Telegram cannot render them.',
  '- For structured data: use bullet points or bold key-value pairs.',
  '- Use **bold**, _italic_, `code`, ```code blocks```, and [links](url).',
  '- Telegram supports HTML subset: headings are not supported, use bold instead.',
  `- Keep responses concise. Messages over ${MAX_MESSAGE_LENGTH} characters are split.`,
].join('\n');

/**
 * Handle an inbound Chat SDK message and publish it to the Relay bus.
 *
 * Converts the Chat SDK Message and Thread into a StandardPayload and
 * publishes to the Relay subject derived from the Telegram chat ID.
 *
 * @param thread - The Chat SDK thread the message was received in
 * @param message - The inbound Chat SDK message
 * @param relay - The relay publisher
 * @param callbacks - Callbacks to mutate adapter state counters
 * @param logger - Logger for debug/warn output
 */
export async function handleInboundMessage(
  thread: Thread,
  message: Message,
  relay: RelayPublisher,
  callbacks: AdapterInboundCallbacks,
  logger: RelayLogger = noopLogger
): Promise<void> {
  const rawText = message.text ?? '';
  if (!rawText.trim()) {
    logger.debug(`[TelegramChatSdk] inbound skipped: empty text in thread ${thread.id}`);
    return;
  }

  // Cap inbound content to prevent oversized payloads reaching the relay
  const text = rawText.slice(0, MAX_CONTENT_LENGTH);

  const senderName = message.author.fullName || message.author.userName || UNKNOWN_SENDER;

  // Derive subject from thread ID — Chat SDK Telegram encodes chatId into the thread ID
  const channelType = thread.isDM ? 'dm' : 'group';
  const subject = codec.encode(thread.id, channelType);

  const channelName = thread.isDM ? undefined : thread.id;

  const payload: StandardPayload = {
    content: text,
    senderName,
    channelName: channelName,
    channelType,
    responseContext: {
      platform: 'telegram',
      maxLength: MAX_MESSAGE_LENGTH,
      supportedFormats: ['text', 'markdown'],
      instructions: `Reply to subject ${subject} to respond to this Telegram message.`,
      formattingInstructions: TELEGRAM_FORMATTING_RULES,
    },
    platformData: {
      threadId: thread.id,
      messageId: message.id,
      authorId: message.author.userId,
      username: message.author.userName,
    },
  };

  try {
    const result = await relay.publish(subject, payload, {
      from: `${SUBJECT_PREFIX}.bot`,
      replyTo: subject,
    });

    if (result.deliveredTo === 0 && result.rejected?.length) {
      const reason = result.rejected[0]?.reason ?? 'unknown';
      callbacks.recordError(new Error(`Publish rejected: ${reason}`));
      logger.warn(`[TelegramChatSdk] inbound publish rejected for thread ${thread.id}: ${reason}`);
      return;
    }

    callbacks.trackInbound();
    logger.debug(
      `[TelegramChatSdk] inbound from ${senderName} in thread ${thread.id}: "${text.slice(0, 80)}${text.length > 80 ? '\u2026' : ''}" (${text.length} chars) \u2192 ${subject}`
    );
  } catch (err) {
    callbacks.recordError(err);
    logger.warn(
      `[TelegramChatSdk] inbound publish failed for thread ${thread.id}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}
