import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdapterStreamManager } from '../adapter-stream-manager.js';
import { createMockRelayEnvelope } from '../testing/mock-relay-envelope.js';
import type { RelayAdapter, StreamableAdapter, DeliveryResult } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock adapter WITHOUT deliverStream. */
function createMockAdapter(): RelayAdapter {
  return {
    id: 'test-adapter',
    subjectPrefix: 'relay.test',
    displayName: 'Test Adapter',
    start: vi.fn(),
    stop: vi.fn(),
    deliver: vi.fn().mockResolvedValue({ success: true }),
    getStatus: vi.fn().mockReturnValue({
      state: 'connected',
      messageCount: { inbound: 0, outbound: 0 },
      errorCount: 0,
    }),
  };
}

/** Create a mock adapter WITH deliverStream. */
function createStreamableAdapter(): StreamableAdapter & RelayAdapter {
  const base = createMockAdapter();
  return {
    ...base,
    deliverStream: vi
      .fn()
      .mockImplementation(
        async (_subject: string, _threadId: string, stream: AsyncIterable<string>) => {
          const chunks: string[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          return { success: true } as DeliveryResult;
        }
      ),
  };
}

/** Build a text_delta envelope with the correct nested payload format. */
function textDeltaEnvelope(text: string) {
  return createMockRelayEnvelope({
    payload: { type: 'text_delta', data: { text } },
  });
}

/** Build a done envelope with the correct nested payload format. */
function doneEnvelope() {
  return createMockRelayEnvelope({
    payload: { type: 'done', data: {} },
  });
}

/** Build an error envelope with the correct nested payload format. */
function errorEnvelope(message: string) {
  return createMockRelayEnvelope({
    payload: { type: 'error', data: { message } },
  });
}

/** Build an approval_required envelope with the correct nested payload format. */
function approvalEnvelope() {
  return createMockRelayEnvelope({
    payload: {
      type: 'approval_required',
      data: { toolCallId: 'tc1', toolName: 'Write' },
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdapterStreamManager', () => {
  let manager: AdapterStreamManager;

  beforeEach(() => {
    manager = new AdapterStreamManager();
  });

  it('returns null for non-streaming adapter', async () => {
    const adapter = createMockAdapter();
    const envelope = textDeltaEnvelope('hello');

    const result = await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'text_delta',
      envelope,
      adapter,
      'relay.test.subject'
    );

    expect(result).toBeNull();
    expect(manager.activeStreamCount).toBe(0);
  });

  it('creates stream on first text_delta', async () => {
    const adapter = createStreamableAdapter();
    const envelope = textDeltaEnvelope('hello');

    const result = await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'text_delta',
      envelope,
      adapter,
      'relay.test.subject'
    );

    expect(result).toEqual({ success: true });
    expect(manager.activeStreamCount).toBe(1);
    expect(adapter.deliverStream).toHaveBeenCalledTimes(1);
    expect(adapter.deliverStream).toHaveBeenCalledWith(
      'relay.test.subject',
      'thread-1',
      expect.anything(), // AsyncQueue instance
      undefined
    );
  });

  it('pushes subsequent deltas to existing stream', async () => {
    const adapter = createStreamableAdapter();

    await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'text_delta',
      textDeltaEnvelope('hello'),
      adapter,
      'relay.test.subject'
    );

    const result = await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'text_delta',
      textDeltaEnvelope(' world'),
      adapter,
      'relay.test.subject'
    );

    expect(result).toEqual({ success: true });
    // deliverStream should only be called once (on first delta)
    expect(adapter.deliverStream).toHaveBeenCalledTimes(1);
    expect(manager.activeStreamCount).toBe(1);
  });

  it('completes stream on done event', async () => {
    const adapter = createStreamableAdapter();

    // Start stream
    await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'text_delta',
      textDeltaEnvelope('hello'),
      adapter,
      'relay.test.subject'
    );

    // Complete stream
    const result = await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'done',
      doneEnvelope(),
      adapter,
      'relay.test.subject'
    );

    expect(result).toEqual({ success: true });
    expect(manager.activeStreamCount).toBe(0);
  });

  it('propagates error via queue.fail()', async () => {
    // Use an adapter that captures the error from the queue
    const base = createMockAdapter();
    const adapter: StreamableAdapter & RelayAdapter = {
      ...base,
      deliverStream: vi
        .fn()
        .mockImplementation(
          async (_subject: string, _threadId: string, stream: AsyncIterable<string>) => {
            try {
              for await (const _chunk of stream) {
                // consume
              }
              return { success: true } as DeliveryResult;
            } catch {
              // Queue was failed — this is expected
              return { success: true } as DeliveryResult;
            }
          }
        ),
    };

    // Start stream
    await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'text_delta',
      textDeltaEnvelope('partial'),
      adapter,
      'relay.test.subject'
    );

    // Send error
    const result = await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'error',
      errorEnvelope('Something failed'),
      adapter,
      'relay.test.subject'
    );

    expect(result).toEqual({ success: true });
    expect(manager.activeStreamCount).toBe(0);
  });

  it('completes stream and returns null on approval_required', async () => {
    const adapter = createStreamableAdapter();

    // Start stream
    await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'text_delta',
      textDeltaEnvelope('thinking...'),
      adapter,
      'relay.test.subject'
    );

    expect(manager.activeStreamCount).toBe(1);

    // Approval interruption
    const result = await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'approval_required',
      approvalEnvelope(),
      adapter,
      'relay.test.subject'
    );

    // Returns null so caller falls through to adapter.deliver()
    expect(result).toBeNull();
    expect(manager.activeStreamCount).toBe(0);
  });

  it('supports concurrent streams for different thread IDs', async () => {
    const adapter = createStreamableAdapter();

    // Start two streams on different threads
    await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'text_delta',
      textDeltaEnvelope('stream-1'),
      adapter,
      'relay.test.subject'
    );

    await manager.handleStreamEvent(
      'test-adapter',
      'thread-2',
      'text_delta',
      textDeltaEnvelope('stream-2'),
      adapter,
      'relay.test.subject'
    );

    expect(manager.activeStreamCount).toBe(2);
    expect(adapter.deliverStream).toHaveBeenCalledTimes(2);

    // Complete one — the other remains
    await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'done',
      doneEnvelope(),
      adapter,
      'relay.test.subject'
    );

    expect(manager.activeStreamCount).toBe(1);
  });

  it('returns null for non-streaming adapter (fallback to deliver)', async () => {
    const adapter = createMockAdapter();

    // Try all event types — all should return null
    for (const eventType of ['text_delta', 'done', 'error', 'approval_required']) {
      const envelope = createMockRelayEnvelope({
        payload: { type: eventType, data: {} },
      });

      const result = await manager.handleStreamEvent(
        'test-adapter',
        'thread-1',
        eventType,
        envelope,
        adapter,
        'relay.test.subject'
      );

      expect(result).toBeNull();
    }
  });

  it('handles done without prior text_delta gracefully', async () => {
    const adapter = createStreamableAdapter();

    const result = await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'done',
      doneEnvelope(),
      adapter,
      'relay.test.subject'
    );

    expect(result).toEqual({ success: true });
    expect(manager.activeStreamCount).toBe(0);
    expect(adapter.deliverStream).not.toHaveBeenCalled();
  });

  it('handles error without prior text_delta gracefully', async () => {
    const adapter = createStreamableAdapter();

    const result = await manager.handleStreamEvent(
      'test-adapter',
      'thread-1',
      'error',
      errorEnvelope('Unexpected error'),
      adapter,
      'relay.test.subject'
    );

    expect(result).toEqual({ success: true });
    expect(manager.activeStreamCount).toBe(0);
    expect(adapter.deliverStream).not.toHaveBeenCalled();
  });
});
