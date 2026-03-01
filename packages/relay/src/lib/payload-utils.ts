/**
 * Payload extraction utilities for Relay adapters.
 *
 * Provides a single, shared implementation for extracting text content from
 * unknown Relay envelope payloads. Used by both the Telegram and Claude Code
 * adapters to avoid duplicated extraction logic.
 *
 * @module relay/lib/payload-utils
 */

/**
 * Extract text content from an unknown Relay envelope payload.
 *
 * Checks for `content` and `text` string fields on object payloads,
 * falls back to JSON serialization for other shapes.
 *
 * @param payload - The unknown payload from a RelayEnvelope
 */
export function extractPayloadContent(payload: unknown): string {
  if (typeof payload === 'string') return payload;

  if (payload !== null && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.text === 'string') return obj.text;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return '[unserializable payload]';
  }
}
