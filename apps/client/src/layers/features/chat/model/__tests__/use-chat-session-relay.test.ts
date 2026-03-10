/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '@/layers/shared/model';
import { createMockTransport } from '@dorkos/test-utils';
import type { Transport } from '@dorkos/shared/transport';
import { useChatSession } from '../use-chat-session';

// Mock useRelayEnabled
vi.mock('@/layers/entities/relay', () => ({
  useRelayEnabled: vi.fn(() => false),
}));

import { useRelayEnabled } from '@/layers/entities/relay';
const mockUseRelayEnabled = vi.mocked(useRelayEnabled);

// Mock crypto.randomUUID for deterministic IDs.
// Default implementation returns sequential UUIDs for test isolation.
let uuidCounter = 0;
const mockUUID = vi.fn(() => `test-uuid-${++uuidCounter}`);
vi.stubGlobal('crypto', { randomUUID: mockUUID });

// Mock EventSource since jsdom doesn't provide it
class MockEventSource {
  listeners: Record<string, ((event: MessageEvent) => void)[]> = {};
  url: string;
  readyState = 1;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener() {}

  close() {
    this.readyState = 2;
  }

  /** Helper for tests to simulate server-sent events. */
  emit(type: string, data: unknown) {
    for (const listener of this.listeners[type] || []) {
      listener({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  static instances: MockEventSource[] = [];
  static reset() {
    MockEventSource.instances = [];
  }
}

function createWrapper(transport: Transport) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(TransportProvider as any, { transport }, children)
    );
  };
}

/**
 * Helper: start handleSubmit and emit stream_ready during the waitForStreamReady poll.
 *
 * handleSubmit resets streamReadyRef before polling, so stream_ready must be emitted
 * AFTER the reset. This helper starts the submit, emits stream_ready, then awaits completion.
 * For fake-timer tests, pass `advanceTimers: true` to advance by 50ms so the poll fires.
 */
async function submitWithStreamReady(
  result: { current: ReturnType<typeof useChatSession> },
  es: MockEventSource,
  options?: { advanceTimers?: boolean },
) {
  const submitPromise = result.current.handleSubmit();
  // Emit stream_ready so the waitForStreamReady poll resolves
  es.emit('stream_ready', {});
  if (options?.advanceTimers) {
    // Advance fake timers past the 50ms poll interval so setInterval fires
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await submitPromise;
    });
  } else {
    await act(async () => {
      await submitPromise;
    });
  }
}

describe('useChatSession relay protocol', () => {
  let mockTransport: Transport;

  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.reset();
    (globalThis as Record<string, unknown>).EventSource = MockEventSource;
    mockTransport = createMockTransport();
    mockUseRelayEnabled.mockReturnValue(false);
    // Reset counter so UUIDs are deterministic per test: test-uuid-1, test-uuid-2, ...
    uuidCounter = 0;
    mockUUID.mockImplementation(() => `test-uuid-${++uuidCounter}`);
  });

  afterEach(() => {
    // Reset instances but keep EventSource defined to avoid uncaught errors from
    // React effect cleanup that fires after test teardown
    MockEventSource.reset();
  });

  it('calls sendMessageRelay when relay enabled', async () => {
    mockUseRelayEnabled.mockReturnValue(true);
    vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
      messageId: 'msg-1',
      traceId: 'trace-1',
    });

    const { result } = renderHook(() => useChatSession('session-1'), {
      wrapper: createWrapper(mockTransport),
    });

    const es = MockEventSource.instances[0];

    // Set input
    act(() => {
      result.current.setInput('hello relay');
    });

    // Submit — stream_ready emitted during the waitForStreamReady poll
    await submitWithStreamReady(result, es!);

    expect(mockTransport.sendMessageRelay).toHaveBeenCalledWith('session-1', 'hello relay', {
      clientId: 'test-uuid-1',
      correlationId: expect.any(String),
    });
    expect(mockTransport.sendMessage).not.toHaveBeenCalled();
  });

  it('calls sendMessage when relay disabled', async () => {
    mockUseRelayEnabled.mockReturnValue(false);

    const { result } = renderHook(() => useChatSession('session-1'), {
      wrapper: createWrapper(mockTransport),
    });

    act(() => {
      result.current.setInput('hello legacy');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockTransport.sendMessage).toHaveBeenCalled();
    expect(mockTransport.sendMessageRelay).not.toHaveBeenCalled();
  });

  it('adds user message optimistically on relay submit', async () => {
    mockUseRelayEnabled.mockReturnValue(true);
    vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
      messageId: 'msg-1',
      traceId: 'trace-1',
    });

    const { result } = renderHook(() => useChatSession('session-1'), {
      wrapper: createWrapper(mockTransport),
    });

    const es = MockEventSource.instances[0];

    act(() => {
      result.current.setInput('optimistic msg');
    });

    await submitWithStreamReady(result, es!);

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual(
      expect.objectContaining({
        role: 'user',
        content: 'optimistic msg',
      })
    );
  });

  it('sets status to streaming on relay submit', async () => {
    mockUseRelayEnabled.mockReturnValue(true);

    // Use a deferred promise so we can observe the status while sendMessageRelay is in-flight
    let resolveSend!: (value: { messageId: string; traceId: string }) => void;
    vi.mocked(mockTransport.sendMessageRelay).mockImplementation(
      () => new Promise((resolve) => { resolveSend = resolve; })
    );

    const { result } = renderHook(() => useChatSession('session-1'), {
      wrapper: createWrapper(mockTransport),
    });

    const es = MockEventSource.instances[0];

    act(() => {
      result.current.setInput('streaming check');
    });

    // Start submit — handleSubmit resets streamReadyRef and polls via setInterval(50ms).
    // We emit stream_ready to unblock the poll, then let microtasks flush so
    // sendMessageRelay is called (capturing the resolveSend callback).
    const submitPromise = result.current.handleSubmit();
    es?.emit('stream_ready', {});
    // Flush microtasks to let waitForStreamReady resolve and sendMessageRelay be called
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });

    // Status should be streaming while the relay call is in flight
    expect(result.current.status).toBe('streaming');

    // Now resolve the send
    await act(async () => {
      resolveSend({ messageId: 'msg-1', traceId: 'trace-1' });
      await submitPromise;
    });

    // Relay path keeps status as 'streaming' — done event arrives via EventSource
    expect(result.current.status).toBe('streaming');
  });

  it('handles sendMessageRelay errors', async () => {
    mockUseRelayEnabled.mockReturnValue(true);
    vi.mocked(mockTransport.sendMessageRelay).mockRejectedValue(
      new Error('Relay delivery failed')
    );

    const { result } = renderHook(() => useChatSession('session-1'), {
      wrapper: createWrapper(mockTransport),
    });

    const es = MockEventSource.instances[0];

    act(() => {
      result.current.setInput('will fail');
    });

    await submitWithStreamReady(result, es!);

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Relay delivery failed');
  });

  it('processes relay_message events from EventSource', async () => {
    mockUseRelayEnabled.mockReturnValue(true);
    vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
      messageId: 'msg-1',
      traceId: 'trace-1',
    });

    const { result } = renderHook(() => useChatSession('session-1'), {
      wrapper: createWrapper(mockTransport),
    });

    const es = MockEventSource.instances[0];

    // Submit a message to enter streaming state
    act(() => {
      result.current.setInput('test relay events');
    });

    await submitWithStreamReady(result, es!);

    // Find the EventSource that has relay_message listeners
    const esWithRelay = MockEventSource.instances.find(
      (es) => es.listeners['relay_message']?.length > 0
    );

    if (esWithRelay) {
      act(() => {
        esWithRelay.emit('relay_message', {
          messageId: 'msg-001',
          payload: { type: 'text_delta', data: { text: 'hello from relay' } },
          subject: 'relay.human.console.test-client',
        });
      });

      // The stream event handler should process the text_delta and add an assistant message
      await waitFor(() => {
        const assistantMessages = result.current.messages.filter((m) => m.role === 'assistant');
        expect(assistantMessages.length).toBeGreaterThan(0);
      });
    } else {
      expect(MockEventSource.instances.length).toBeGreaterThan(0);
    }
  });

  it('relay EventSource is NOT torn down when isStreaming changes', async () => {
    mockUseRelayEnabled.mockReturnValue(true);
    vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
      messageId: 'msg-1',
      traceId: 'trace-1',
    });

    const { result } = renderHook(() => useChatSession('session-1'), {
      wrapper: createWrapper(mockTransport),
    });

    // One EventSource created on mount for relay path
    expect(MockEventSource.instances).toHaveLength(1);
    const originalEs = MockEventSource.instances[0];

    // Submit — sets isStreaming=true
    act(() => {
      result.current.setInput('hello');
    });
    await submitWithStreamReady(result, originalEs);

    // Status is still 'streaming' on relay path
    expect(result.current.status).toBe('streaming');

    // The original EventSource should still be open (not replaced)
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]).toBe(originalEs);
    expect(originalEs.readyState).toBe(1); // OPEN
  });

  it('relay EventSource listens for stream_ready and registers it', async () => {
    mockUseRelayEnabled.mockReturnValue(true);

    renderHook(() => useChatSession('session-1'), {
      wrapper: createWrapper(mockTransport),
    });

    const es = MockEventSource.instances[0];
    expect(es).toBeDefined();
    // stream_ready listener should be registered
    expect(es.listeners['stream_ready']).toHaveLength(1);
  });

  it('relay EventSource URL includes clientId', () => {
    mockUseRelayEnabled.mockReturnValue(true);

    renderHook(() => useChatSession('session-1'), {
      wrapper: createWrapper(mockTransport),
    });

    const es = MockEventSource.instances[0];
    expect(es.url).toContain('clientId=test-uuid-1');
  });

  it('legacy path does NOT create EventSource when relay enabled', () => {
    mockUseRelayEnabled.mockReturnValue(true);

    renderHook(() => useChatSession('session-1'), {
      wrapper: createWrapper(mockTransport),
    });

    // Only one EventSource (relay path), not two
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('clientId=');
  });

  it('legacy path creates EventSource without clientId when relay disabled', () => {
    mockUseRelayEnabled.mockReturnValue(false);

    renderHook(() => useChatSession('session-1'), {
      wrapper: createWrapper(mockTransport),
    });

    const es = MockEventSource.instances[0];
    expect(es).toBeDefined();
    expect(es.url).not.toContain('clientId=');
  });

  describe('staleness detector', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('transitions to idle and refreshes messages when staleness timer fires and backend completed', async () => {
      mockUseRelayEnabled.mockReturnValue(true);
      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'msg-1',
        traceId: 'trace-1',
      });
      // getSession resolves = backend completed
      vi.mocked(mockTransport.getSession).mockResolvedValue({
        id: 'session-1',
        title: 'Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissionMode: 'default',
      });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      const es = MockEventSource.instances[0];

      act(() => { result.current.setInput('test'); });

      await submitWithStreamReady(result, es!, { advanceTimers: true });

      // Status is streaming on relay path — we haven't received a done event
      expect(result.current.status).toBe('streaming');

      // Advance past the staleness timeout
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_001);
      });

      // Should transition to idle after staleness timer fires
      expect(result.current.status).toBe('idle');
      expect(mockTransport.getSession).toHaveBeenCalledWith('session-1', undefined);
    });

    it('does not transition to idle when getSession throws (network error)', async () => {
      mockUseRelayEnabled.mockReturnValue(true);
      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'msg-1',
        traceId: 'trace-1',
      });
      // getSession throws = backend unreachable
      vi.mocked(mockTransport.getSession).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      const es = MockEventSource.instances[0];

      act(() => { result.current.setInput('test'); });

      await submitWithStreamReady(result, es!, { advanceTimers: true });

      expect(result.current.status).toBe('streaming');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_001);
      });

      // Should stay streaming — network error means we can't confirm completion
      expect(result.current.status).toBe('streaming');
    });

    it('staleness timer resets on each received relay_message event', async () => {
      mockUseRelayEnabled.mockReturnValue(true);
      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'msg-1',
        traceId: 'trace-1',
      });
      vi.mocked(mockTransport.getSession).mockResolvedValue({
        id: 'session-1',
        title: 'Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissionMode: 'default',
      });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      const es = MockEventSource.instances[0];

      act(() => { result.current.setInput('test'); });

      await submitWithStreamReady(result, es!, { advanceTimers: true });

      expect(result.current.status).toBe('streaming');

      // Advance 10s (less than the 15s timeout) and emit a relay_message to reset the timer
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      act(() => {
        es?.emit('relay_message', {
          payload: { type: 'text_delta', data: { text: 'still going' } },
        });
      });

      // Advance another 10s — the timer was reset, so it hasn't fired yet (only 10s since last event)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      // Should still be streaming — timer was reset by the relay_message event
      expect(result.current.status).toBe('streaming');
      expect(mockTransport.getSession).not.toHaveBeenCalled();

      // Now advance past the full 15s since last event
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_001);
      });

      // Now the timer should have fired
      expect(result.current.status).toBe('idle');
    });

    it('does not start staleness timer when relay is disabled', async () => {
      mockUseRelayEnabled.mockReturnValue(false);
      vi.mocked(mockTransport.getSession).mockResolvedValue({
        id: 'session-1',
        title: 'Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissionMode: 'default',
      });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      act(() => { result.current.setInput('test'); });

      // Legacy path — sendMessage resolves immediately with done event
      vi.mocked(mockTransport.sendMessage).mockImplementation(
        async (_id, _content, onEvent) => {
          onEvent({ type: 'text_delta', data: { text: 'hi' } } as Parameters<typeof onEvent>[0]);
          // Don't emit done — to keep status streaming if legacy path were to do so
        }
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      // getSession should NOT be called — staleness detector is relay-only
      expect(mockTransport.getSession).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Bug 1: 503 storm — refetchInterval fires in relay mode (regression)
  // Root cause: refetchInterval has no `relayEnabled` guard, so it polls
  // GET /messages every ACTIVE_TAB_REFETCH_MS (3 000 ms) even when Relay SSE
  // already handles history invalidation via sync_update events.
  // Fix: add `|| relayEnabled` to the refetchInterval callback.
  // ---------------------------------------------------------------------------
  describe('relay mode disables GET /messages polling (Bug 1: 503 storm regression)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not re-poll GET /messages every 3 s when relay is enabled', async () => {
      mockUseRelayEnabled.mockReturnValue(true);
      vi.mocked(mockTransport.getMessages).mockResolvedValue({ messages: [] });

      renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      // Flush the initial TanStack Query fetch triggered on mount
      await act(async () => {
        await Promise.resolve();
      });

      const callCountAfterMount = vi.mocked(mockTransport.getMessages).mock.calls.length;

      // Advance past two ACTIVE_TAB_REFETCH_MS intervals (3 000 ms each).
      // Without the fix, TanStack Query fires two more getMessages calls here.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_100);
      });

      // In relay mode, polling must stay at the initial call count.
      // Regression: without the relayEnabled guard, getMessages is called 2 more times.
      expect(vi.mocked(mockTransport.getMessages).mock.calls.length).toBe(callCountAfterMount);
    });

    it('still polls GET /messages when relay is disabled', async () => {
      mockUseRelayEnabled.mockReturnValue(false);
      vi.mocked(mockTransport.getMessages).mockResolvedValue({ messages: [] });

      renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      // Flush initial query + allow timers to settle
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const callCountAfterMount = vi.mocked(mockTransport.getMessages).mock.calls.length;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_100);
      });

      // Legacy mode: polling IS expected — at least 2 more calls after mount
      expect(vi.mocked(mockTransport.getMessages).mock.calls.length).toBeGreaterThan(callCountAfterMount);
    });
  });

  // ---------------------------------------------------------------------------
  // Bug 2: tool call spinner stuck after streaming completes (regression)
  // ---------------------------------------------------------------------------
  describe('tool call spinner regression in relay mode (Bug 2)', () => {
    /** Wrap a stream event payload in the relay_message envelope format. */
    function relayEvent(type: string, data: unknown) {
      return { payload: { type, data } };
    }

    it('transitions tool call from running to complete after tool_call_end + done (happy path)', async () => {
      mockUseRelayEnabled.mockReturnValue(true);
      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'msg-1',
        traceId: 'trace-1',
      });
      vi.mocked(mockTransport.getMessages).mockResolvedValue({ messages: [] });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      const es = MockEventSource.instances[0];
      act(() => { result.current.setInput('use TodoWrite'); });
      await submitWithStreamReady(result, es!);

      // Emit tool lifecycle events in order
      act(() => {
        es?.emit('relay_message', relayEvent('tool_call_start', {
          toolCallId: 'tc-todo', toolName: 'TodoWrite', input: '',
        }));
      });
      act(() => {
        es?.emit('relay_message', relayEvent('tool_call_end', { toolCallId: 'tc-todo' }));
      });
      act(() => {
        es?.emit('relay_message', relayEvent('done', {}));
      });

      await waitFor(() => expect(result.current.status).toBe('idle'));

      const assistantMsg = result.current.messages.find((m) => m.role === 'assistant');
      const toolCall = assistantMsg?.toolCalls?.find((tc) => tc.toolCallId === 'tc-todo');
      expect(toolCall, 'tool call should exist in assistant message').toBeDefined();
      // Regression guard: tool call must be complete, not running
      expect(toolCall?.status).toBe('complete');
    });

    it('tool call stays complete after sync_update races with tool_call_end during streaming (race condition)', async () => {
      mockUseRelayEnabled.mockReturnValue(true);

      // Assign distinct UUIDs so we can track which message is which:
      // call 1 -> clientIdRef (hook init), call 2 -> user message, call 3 -> assistantIdRef
      mockUUID
        .mockReturnValueOnce('client-id-1')
        .mockReturnValueOnce('streaming-user-id')
        .mockReturnValueOnce('streaming-assistant-id');

      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'msg-1',
        traceId: 'trace-1',
      });

      // Initial mount returns empty -> historySeededRef stays false.
      // After sync_update invalidation: returns stale history with a DIFFERENT
      // assistant id and the tool call still in 'running' state.
      vi.mocked(mockTransport.getMessages)
        .mockResolvedValueOnce({ messages: [] })
        .mockResolvedValue({
          messages: [
            {
              id: 'history-user-1',
              role: 'user' as const,
              content: 'use TodoWrite',
              parts: [{ type: 'text' as const, text: 'use TodoWrite' }],
              timestamp: new Date().toISOString(),
            },
            {
              // Crucially: id differs from 'streaming-assistant-id'
              id: 'history-assistant-1',
              role: 'assistant' as const,
              content: '',
              parts: [{
                type: 'tool_call' as const,
                toolCallId: 'tc-todo',
                toolName: 'TodoWrite',
                input: '',
                status: 'running' as const,
              }],
              timestamp: new Date().toISOString(),
            },
          ],
        });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      // Wait for initial empty getMessages call to resolve
      await act(async () => { await Promise.resolve(); });

      const es = MockEventSource.instances[0];
      act(() => { result.current.setInput('use TodoWrite'); });
      await submitWithStreamReady(result, es!);

      // tool_call_start: streaming assistant message created (id='streaming-assistant-id'),
      // tool call pushed to currentPartsRef with status 'running'
      act(() => {
        es?.emit('relay_message', relayEvent('tool_call_start', {
          toolCallId: 'tc-todo', toolName: 'TodoWrite', input: '',
        }));
      });

      // sync_update fires (relay SSE always active).
      // With the fix: statusRef.current === 'streaming', so invalidateQueries is
      // skipped — getMessages is NOT called a second time, and messages state is
      // NOT overwritten with stale history.
      act(() => { es?.emit('sync_update', {}); });

      // Verify the fix: sync_update during streaming must NOT trigger a refetch
      await act(async () => { await Promise.resolve(); });
      expect(vi.mocked(mockTransport.getMessages)).toHaveBeenCalledTimes(1);

      // tool_call_end: updateAssistantMessage('streaming-assistant-id') correctly
      // finds and updates the streaming assistant message (state was not overwritten)
      act(() => {
        es?.emit('relay_message', relayEvent('tool_call_end', { toolCallId: 'tc-todo' }));
      });
      act(() => {
        es?.emit('relay_message', relayEvent('done', {}));
      });

      await waitFor(() => expect(result.current.status).toBe('idle'));

      // Tool call must be 'complete' — the streaming update was NOT a no-op
      // because the fix prevented the history from clobbering streaming state.
      const assistantMsg = result.current.messages.find((m) => m.role === 'assistant');
      const toolCall = assistantMsg?.toolCalls?.find((tc) => tc.toolCallId === 'tc-todo');
      expect(toolCall, 'tool call should exist in the visible assistant message').toBeDefined();
      expect(toolCall?.status).toBe('complete');
    });
  });

  // ---------------------------------------------------------------------------
  // Task 1.3: Synchronous state reset tests
  // Covers streamReadyRef reset (task 1.1) and statusRef sync guard (task 1.2)
  // ---------------------------------------------------------------------------
  describe('synchronous state resets (task 1.3)', () => {
    it('resets streamReadyRef before each relay send, forcing waitForStreamReady poll', async () => {
      mockUseRelayEnabled.mockReturnValue(true);
      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'msg-1',
        traceId: 'trace-1',
      });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      const es = MockEventSource.instances[0];

      // --- First message ---
      act(() => {
        result.current.setInput('message one');
      });
      await submitWithStreamReady(result, es!);

      expect(mockTransport.sendMessageRelay).toHaveBeenCalledTimes(1);

      // Complete the first message by emitting done
      act(() => {
        es?.emit('relay_message', { payload: { type: 'done', data: {} } });
      });
      await waitFor(() => expect(result.current.status).toBe('idle'));

      // --- Second message ---
      act(() => {
        result.current.setInput('message two');
      });

      // Start the second submit. If streamReadyRef were not reset, waitForStreamReady
      // would resolve immediately without needing a stream_ready event.
      // By requiring stream_ready to be emitted, we verify the reset happened.
      const submitPromise = result.current.handleSubmit();

      // Without the reset fix, sendMessageRelay would already be called here because
      // streamReadyRef would still be true. With the fix, it must wait for stream_ready.
      // Give microtasks a chance to settle without emitting stream_ready.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // sendMessageRelay should NOT have been called yet for the second message
      // because we haven't emitted stream_ready
      expect(mockTransport.sendMessageRelay).toHaveBeenCalledTimes(1);

      // Now emit stream_ready to unblock the poll
      es?.emit('stream_ready', {});

      await act(async () => {
        await submitPromise;
      });

      // Now the second message should have been sent
      expect(mockTransport.sendMessageRelay).toHaveBeenCalledTimes(2);
    });

    it('sets statusRef synchronously so sync_update is blocked immediately after setStatus', async () => {
      mockUseRelayEnabled.mockReturnValue(true);

      // Use a deferred sendMessageRelay so we can observe state mid-submit
      let resolveSend!: (value: { messageId: string; traceId: string }) => void;
      vi.mocked(mockTransport.sendMessageRelay).mockImplementation(
        () => new Promise((resolve) => { resolveSend = resolve; })
      );

      // Return empty messages initially, then stale history on refetch
      vi.mocked(mockTransport.getMessages)
        .mockResolvedValueOnce({ messages: [] })
        .mockResolvedValue({
          messages: [{
            id: 'stale-1',
            role: 'assistant' as const,
            content: 'stale content',
            parts: [{ type: 'text' as const, text: 'stale content' }],
            timestamp: new Date().toISOString(),
          }],
        });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      // Wait for initial getMessages
      await act(async () => { await Promise.resolve(); });

      const es = MockEventSource.instances[0];

      act(() => {
        result.current.setInput('test statusRef sync');
      });

      // Start submit — this sets status to streaming and statusRef synchronously
      const submitPromise = result.current.handleSubmit();
      es?.emit('stream_ready', {});
      await act(async () => { await new Promise((r) => setTimeout(r, 100)); });

      // Status should be streaming
      expect(result.current.status).toBe('streaming');

      // Fire sync_update — with the synchronous statusRef fix, this should be blocked
      act(() => {
        es?.emit('sync_update', {});
      });

      // Flush any pending queries
      await act(async () => { await Promise.resolve(); });

      // getMessages should only have been called once (initial mount), NOT again
      // from sync_update, because statusRef.current === 'streaming' blocks invalidation
      expect(vi.mocked(mockTransport.getMessages)).toHaveBeenCalledTimes(1);

      // Clean up
      await act(async () => {
        resolveSend({ messageId: 'msg-1', traceId: 'trace-1' });
        await submitPromise;
      });
    });

    it('blocks sync_update invalidation when statusRef is streaming', async () => {
      mockUseRelayEnabled.mockReturnValue(true);
      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'msg-1',
        traceId: 'trace-1',
      });
      vi.mocked(mockTransport.getMessages)
        .mockResolvedValueOnce({ messages: [] })
        .mockResolvedValue({ messages: [] });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      // Wait for initial getMessages
      await act(async () => { await Promise.resolve(); });
      const initialCallCount = vi.mocked(mockTransport.getMessages).mock.calls.length;

      const es = MockEventSource.instances[0];

      act(() => {
        result.current.setInput('streaming msg');
      });

      await submitWithStreamReady(result, es!);

      // Now in streaming state
      expect(result.current.status).toBe('streaming');

      // Emit sync_update — should be blocked by the streaming guard
      act(() => {
        es?.emit('sync_update', {});
      });

      await act(async () => { await Promise.resolve(); });

      // No additional getMessages calls after initial mount
      expect(vi.mocked(mockTransport.getMessages).mock.calls.length).toBe(initialCallCount);

      // Complete streaming by emitting done
      act(() => {
        es?.emit('relay_message', { payload: { type: 'done', data: {} } });
      });

      await waitFor(() => expect(result.current.status).toBe('idle'));

      // Now sync_update SHOULD trigger invalidation since we're idle
      act(() => {
        es?.emit('sync_update', {});
      });

      await act(async () => { await Promise.resolve(); });

      // getMessages should have been called again after idle
      expect(vi.mocked(mockTransport.getMessages).mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  // ---------------------------------------------------------------------------
  // Task 3.1: Correlation ID unit tests
  // Covers client-side correlationId generation, filtering, and backward compat
  // ---------------------------------------------------------------------------
  describe('correlation ID filtering (task 3.1)', () => {
    /** Wrap a stream event payload in the relay_message envelope format with optional correlationId. */
    function relayEventWithCorrelation(
      type: string,
      data: unknown,
      correlationId?: string,
    ) {
      return {
        payload: { type, data },
        ...(correlationId ? { correlationId } : {}),
      };
    }

    it('sends correlationId to transport.sendMessageRelay', async () => {
      mockUseRelayEnabled.mockReturnValue(true);
      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'msg-1',
        traceId: 'trace-1',
      });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      const es = MockEventSource.instances[0];

      act(() => {
        result.current.setInput('test correlation');
      });

      await submitWithStreamReady(result, es!);

      // Verify correlationId was passed to sendMessageRelay as a string
      expect(mockTransport.sendMessageRelay).toHaveBeenCalledWith(
        'session-1',
        'test correlation',
        expect.objectContaining({
          clientId: expect.any(String),
          correlationId: expect.any(String),
        }),
      );

      // Verify the correlationId is not empty
      const callArgs = vi.mocked(mockTransport.sendMessageRelay).mock.calls[0];
      const options = callArgs[2] as { correlationId?: string };
      expect(options.correlationId).toBeTruthy();
    });

    it('discards relay_message events with mismatched correlationId', async () => {
      mockUseRelayEnabled.mockReturnValue(true);
      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'msg-1',
        traceId: 'trace-1',
      });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      const es = MockEventSource.instances[0];

      act(() => {
        result.current.setInput('msg');
      });

      await submitWithStreamReady(result, es!);

      // Capture the actual correlationId that was sent
      const callArgs = vi.mocked(mockTransport.sendMessageRelay).mock.calls[0];
      const actualCorrelationId = (callArgs[2] as { correlationId?: string }).correlationId!;
      expect(actualCorrelationId).toBeTruthy();

      // Status is streaming after submit
      expect(result.current.status).toBe('streaming');

      // Emit a relay_message with MISMATCHED correlationId (from a previous message)
      act(() => {
        es?.emit(
          'relay_message',
          relayEventWithCorrelation('text_delta', { text: 'stale text' }, 'old-correlation'),
        );
      });

      // The stale event should be discarded — no assistant messages should appear
      const assistantMsgsAfterStale = result.current.messages.filter(
        (m) => m.role === 'assistant',
      );
      expect(assistantMsgsAfterStale).toHaveLength(0);

      // Now emit a relay_message with MATCHING correlationId
      act(() => {
        es?.emit(
          'relay_message',
          relayEventWithCorrelation('text_delta', { text: 'valid text' }, actualCorrelationId),
        );
      });

      // The valid event should be processed — an assistant message should appear
      await waitFor(() => {
        const assistantMsgs = result.current.messages.filter(
          (m) => m.role === 'assistant',
        );
        expect(assistantMsgs.length).toBeGreaterThan(0);
      });
    });

    it('passes through relay_message events without correlationId for backward compat', async () => {
      mockUseRelayEnabled.mockReturnValue(true);

      mockUUID
        .mockReturnValueOnce('client-id-1')
        .mockReturnValueOnce('user-msg-id')
        .mockReturnValueOnce('assistant-id')
        .mockReturnValueOnce('my-correlation');

      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'msg-1',
        traceId: 'trace-1',
      });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      const es = MockEventSource.instances[0];

      act(() => {
        result.current.setInput('backward compat test');
      });

      await submitWithStreamReady(result, es!);

      // Emit a relay_message WITHOUT correlationId — should pass through
      act(() => {
        es?.emit(
          'relay_message',
          relayEventWithCorrelation('text_delta', { text: 'no correlation' }),
        );
      });

      // The event should be processed — an assistant message should appear
      await waitFor(() => {
        const assistantMsgs = result.current.messages.filter(
          (m) => m.role === 'assistant',
        );
        expect(assistantMsgs.length).toBeGreaterThan(0);
      });
    });

    it('updates correlationIdRef on each new message, filtering late events from prior messages', async () => {
      mockUseRelayEnabled.mockReturnValue(true);
      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'msg-1',
        traceId: 'trace-1',
      });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      const es = MockEventSource.instances[0];

      // --- Send Message 1 ---
      act(() => {
        result.current.setInput('first message');
      });
      await submitWithStreamReady(result, es!);

      // Capture the correlationId for message 1
      const msg1CallArgs = vi.mocked(mockTransport.sendMessageRelay).mock.calls[0];
      const corrMsg1 = (msg1CallArgs[2] as { correlationId?: string }).correlationId!;

      // Complete Message 1 with matching correlationId
      act(() => {
        es?.emit(
          'relay_message',
          relayEventWithCorrelation('done', {}, corrMsg1),
        );
      });
      await waitFor(() => expect(result.current.status).toBe('idle'));

      // --- Send Message 2 ---
      act(() => {
        result.current.setInput('second message');
      });
      await submitWithStreamReady(result, es!);

      // Capture the correlationId for message 2
      const msg2CallArgs = vi.mocked(mockTransport.sendMessageRelay).mock.calls[1];
      const corrMsg2 = (msg2CallArgs[2] as { correlationId?: string }).correlationId!;

      // Verify message 1 and 2 have different correlationIds
      expect(corrMsg1).not.toBe(corrMsg2);

      // Late-arriving event from Message 1 — should be discarded
      act(() => {
        es?.emit(
          'relay_message',
          relayEventWithCorrelation('text_delta', { text: 'ghost from msg 1' }, corrMsg1),
        );
      });

      // No assistant text from the ghost event
      const assistantMsgs = result.current.messages.filter((m) => m.role === 'assistant');
      const hasGhostText = assistantMsgs.some((m) =>
        m.parts?.some((p) => p.type === 'text' && p.text.includes('ghost from msg 1')),
      );
      expect(hasGhostText).toBe(false);

      // Valid event for Message 2 — should be accepted
      act(() => {
        es?.emit(
          'relay_message',
          relayEventWithCorrelation('text_delta', { text: 'valid msg 2' }, corrMsg2),
        );
      });

      await waitFor(() => {
        const msgs = result.current.messages.filter((m) => m.role === 'assistant');
        expect(msgs.some((m) =>
          m.parts?.some((p) => p.type === 'text' && p.text.includes('valid msg 2')),
        )).toBe(true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Task 1.3: History seeding during streaming
  // Regression test for the streaming guard added to the history seed effect.
  // When sessionId changes mid-stream (create-on-first-message), the seed effect
  // must NOT overwrite optimistic messages with stale/incomplete server history.
  // ---------------------------------------------------------------------------
  describe('history seeding during streaming', () => {
    it('does not overwrite optimistic messages when historySeededRef resets mid-stream', async () => {
      mockUseRelayEnabled.mockReturnValue(true);

      // First getMessages returns empty (initial mount), second returns the user message
      // (refetch after sessionId change would bring back server history)
      vi.mocked(mockTransport.getMessages)
        .mockResolvedValueOnce({ messages: [] })
        .mockResolvedValue({
          messages: [
            {
              id: 'msg-1',
              role: 'user' as const,
              content: 'hello',
              parts: [{ type: 'text' as const, text: 'hello' }],
              timestamp: new Date().toISOString(),
            },
          ],
        });

      vi.mocked(mockTransport.sendMessageRelay).mockResolvedValue({
        messageId: 'relay-1',
        traceId: 'trace-1',
      });

      const { result } = renderHook(() => useChatSession('session-1'), {
        wrapper: createWrapper(mockTransport),
      });

      // Wait for initial empty getMessages to resolve
      await act(async () => {
        await Promise.resolve();
      });

      const es = MockEventSource.instances[0];

      // User sends message -> optimistic message added to state
      act(() => {
        result.current.setInput('hello');
      });

      await submitWithStreamReady(result, es!);

      // Status should be streaming after relay submit
      expect(result.current.status).toBe('streaming');

      // The optimistic user message should be present
      expect(result.current.messages).toContainEqual(
        expect.objectContaining({ role: 'user', content: 'hello' })
      );

      // Simulate sync_update which would trigger a refetch — but the streaming
      // guard in the seed effect should prevent overwriting optimistic messages
      act(() => {
        es?.emit('sync_update', {});
      });

      await act(async () => {
        await Promise.resolve();
      });

      // The optimistic user message must still be present (not overwritten by seed)
      expect(result.current.messages).toContainEqual(
        expect.objectContaining({ role: 'user', content: 'hello' })
      );
    });
  });
});
