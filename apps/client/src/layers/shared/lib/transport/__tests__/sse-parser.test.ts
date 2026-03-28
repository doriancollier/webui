import { describe, it, expect } from 'vitest';
import { parseSSEStream, type SSEEvent } from '../sse-parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode a raw SSE string into a ReadableStream and return its reader. */
function readerFrom(raw: string): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(raw));
      controller.close();
    },
  });
  return stream.getReader();
}

/** Collect all events from the async generator. */
async function collect<T = unknown>(
  raw: string,
  options?: { onParseError?: 'skip' | 'throw' }
): Promise<SSEEvent<T>[]> {
  const events: SSEEvent<T>[] = [];
  for await (const event of parseSSEStream<T>(readerFrom(raw), options)) {
    events.push(event);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseSSEStream', () => {
  it('parses id field and includes it in yielded events', async () => {
    const raw = 'id: abc-123\nevent: update\ndata: {"v":1}\n\n';
    const events = await collect(raw);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'update', data: { v: 1 }, id: 'abc-123' });
  });

  it('persists id across events when not re-set', async () => {
    const raw = [
      'id: first',
      'event: a',
      'data: {"n":1}',
      '',
      'event: b',
      'data: {"n":2}',
      '',
      '',
    ].join('\n');

    const events = await collect(raw);

    expect(events).toHaveLength(2);
    expect(events[0]!.id).toBe('first');
    // id persists across events per spec
    expect(events[1]!.id).toBe('first');
  });

  it('ignores id fields containing NULL bytes', async () => {
    const raw = 'id: bad\0id\nevent: test\ndata: {"ok":true}\n\n';
    const events = await collect(raw);

    expect(events).toHaveLength(1);
    // NULL byte id is ignored — no id on event (and no prior id to persist)
    expect(events[0]!.id).toBeUndefined();
  });

  it('parses retry field as non-negative integer', async () => {
    const raw = 'retry: 3000\nevent: ping\ndata: {}\n\n';
    const events = await collect(raw);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'ping', data: {}, retry: 3000 });
  });

  it('ignores non-numeric and negative retry values', async () => {
    const raw = [
      'retry: abc',
      'event: a',
      'data: {"n":1}',
      '',
      'retry: -500',
      'event: b',
      'data: {"n":2}',
      '',
      '',
    ].join('\n');

    const events = await collect(raw);

    expect(events).toHaveLength(2);
    expect(events[0]!.retry).toBeUndefined();
    expect(events[1]!.retry).toBeUndefined();
  });

  it('yields comment lines as comment events', async () => {
    const raw = ': this is a comment\nevent: update\ndata: {"v":1}\n\n';
    const events = await collect(raw);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'comment', data: 'this is a comment', comment: true });
    expect(events[1]).toEqual({ type: 'update', data: { v: 1 } });
  });

  it('accumulates multi-line data and joins with newline', async () => {
    const raw = ['event: multi', 'data: {', 'data:   "key": "value"', 'data: }', '', ''].join('\n');

    const events = await collect(raw);

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('multi');
    expect(events[0]!.data).toEqual({ key: 'value' });
  });

  it('dispatches events on empty lines (field accumulation)', async () => {
    const raw = [
      'event: first',
      'data: {"a":1}',
      '',
      'event: second',
      'data: {"b":2}',
      '',
      '',
    ].join('\n');

    const events = await collect(raw);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'first', data: { a: 1 } });
    expect(events[1]).toEqual({ type: 'second', data: { b: 2 } });
  });

  it('handles no-space-after-colon field values', async () => {
    const raw = 'event:update\ndata:{"v":1}\n\n';
    const events = await collect(raw);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'update', data: { v: 1 } });
  });

  it('handles existing sendMessage SSE format (regression)', async () => {
    // This matches the format used by HttpTransport.sendMessage:
    //   event: text_delta\ndata: {"content":"hi"}\n\n
    const raw = [
      'event: text_delta',
      'data: {"content":"hello"}',
      '',
      'event: result',
      'data: {"status":"done"}',
      '',
      '',
    ].join('\n');

    const events = await collect(raw);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'text_delta', data: { content: 'hello' } });
    expect(events[1]).toEqual({ type: 'result', data: { status: 'done' } });
  });

  it('flushes final event when stream ends without trailing empty line', async () => {
    // No trailing \n\n — stream just ends with data buffered
    const raw = 'event: final\ndata: {"end":true}\n';
    const events = await collect(raw);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'final', data: { end: true } });
  });

  it('ignores malformed lines without a colon', async () => {
    const raw = 'event: test\nbadline\ndata: {"ok":true}\n\n';
    const events = await collect(raw);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'test', data: { ok: true } });
  });

  it('defaults event type to "message" when no event field is set', async () => {
    const raw = 'data: {"implicit":true}\n\n';
    const events = await collect(raw);

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('message');
    expect(events[0]!.data).toEqual({ implicit: true });
  });
});
