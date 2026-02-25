import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageReceiver, extractSessionId, extractPayloadContent } from '../message-receiver.js';
import type { AgentManagerLike } from '../message-receiver.js';
import type { TraceStore } from '../trace-store.js';
import type { RelayCore } from '@dorkos/relay';
import type { RelayEnvelope } from '@dorkos/shared/relay-schemas';
import type { StreamEvent } from '@dorkos/shared/types';

// --- Helpers ---

function makeEnvelope(overrides: Partial<RelayEnvelope> = {}): RelayEnvelope {
  return {
    id: 'msg-001',
    subject: 'relay.agent.session-abc',
    from: 'relay.human.console.client-1',
    replyTo: 'relay.human.console.client-1',
    budget: {
      hopCount: 0,
      maxHops: 5,
      ancestorChain: [],
      ttl: Date.now() + 60_000,
      callBudgetRemaining: 10,
    },
    createdAt: new Date().toISOString(),
    payload: { content: 'Hello agent' },
    ...overrides,
  };
}

function makePulseEnvelope(overrides: Partial<RelayEnvelope> = {}): RelayEnvelope {
  return makeEnvelope({
    subject: 'relay.system.pulse.sched-001',
    payload: {
      type: 'pulse_dispatch',
      scheduleId: 'sched-001',
      runId: 'run-001',
      prompt: 'Do something',
      cwd: null,
      permissionMode: 'default',
      scheduleName: 'Test Schedule',
      cron: '0 * * * *',
      trigger: 'cron',
    },
    ...overrides,
  });
}

/** Creates a mock async generator that yields given events. */
async function* mockEventStream(events: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const event of events) {
    yield event;
  }
}

function createMocks() {
  const subscribedHandlers = new Map<string, ((envelope: RelayEnvelope) => void)[]>();

  const relayCore = {
    subscribe: vi.fn((pattern: string, handler: (envelope: RelayEnvelope) => void) => {
      const handlers = subscribedHandlers.get(pattern) ?? [];
      handlers.push(handler);
      subscribedHandlers.set(pattern, handlers);
      return vi.fn(); // unsubscribe function
    }),
    publish: vi.fn().mockResolvedValue({ messageId: 'reply-001', deliveredTo: 1 }),
  } as unknown as RelayCore;

  const agentManager: AgentManagerLike = {
    ensureSession: vi.fn(),
    sendMessage: vi.fn().mockReturnValue(mockEventStream([])),
  };

  const traceStore = {
    insertSpan: vi.fn(),
    updateSpan: vi.fn(),
    getSpanByMessageId: vi.fn(),
    getTrace: vi.fn(),
    getMetrics: vi.fn(),
    close: vi.fn(),
  } as unknown as TraceStore;

  return { relayCore, agentManager, traceStore, subscribedHandlers };
}

// --- Tests ---

describe('extractSessionId', () => {
  it('extracts sessionId from relay.agent.{sessionId}', () => {
    expect(extractSessionId('relay.agent.session-abc')).toBe('session-abc');
  });

  it('extracts sessionId from relay.agent.{sessionId} with extra segments', () => {
    expect(extractSessionId('relay.agent.session-abc.extra')).toBe('session-abc');
  });

  it('returns null for non-agent subjects', () => {
    expect(extractSessionId('relay.system.pulse.sched-1')).toBeNull();
  });

  it('returns null for too-short subjects', () => {
    expect(extractSessionId('relay.agent')).toBeNull();
  });

  it('returns null for empty sessionId segment', () => {
    expect(extractSessionId('relay.agent.')).toBeNull();
  });
});

describe('extractPayloadContent', () => {
  it('returns string payloads directly', () => {
    expect(extractPayloadContent('hello')).toBe('hello');
  });

  it('extracts content field from object', () => {
    expect(extractPayloadContent({ content: 'hello' })).toBe('hello');
  });

  it('extracts text field from object', () => {
    expect(extractPayloadContent({ text: 'hello' })).toBe('hello');
  });

  it('falls back to JSON for unknown shapes', () => {
    expect(extractPayloadContent({ foo: 42 })).toBe('{"foo":42}');
  });
});

describe('MessageReceiver', () => {
  let receiver: MessageReceiver;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
    receiver = new MessageReceiver({
      relayCore: mocks.relayCore,
      agentManager: mocks.agentManager,
      traceStore: mocks.traceStore,
      defaultCwd: '/tmp/test',
    });
  });

  describe('start()', () => {
    it('subscribes to relay.agent.> and relay.system.pulse.>', () => {
      receiver.start();

      expect(mocks.relayCore.subscribe).toHaveBeenCalledTimes(2);
      expect(mocks.relayCore.subscribe).toHaveBeenCalledWith(
        'relay.agent.>',
        expect.any(Function),
      );
      expect(mocks.relayCore.subscribe).toHaveBeenCalledWith(
        'relay.system.pulse.>',
        expect.any(Function),
      );
    });
  });

  describe('stop()', () => {
    it('calls all unsubscribe functions', () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      vi.mocked(mocks.relayCore.subscribe)
        .mockReturnValueOnce(unsub1)
        .mockReturnValueOnce(unsub2);

      receiver.start();
      receiver.stop();

      expect(unsub1).toHaveBeenCalled();
      expect(unsub2).toHaveBeenCalled();
    });
  });

  describe('handleAgentMessage()', () => {
    it('extracts correct sessionId from subject', async () => {
      const envelope = makeEnvelope({ subject: 'relay.agent.my-session-id' });

      await receiver.handleAgentMessage(envelope);

      expect(mocks.agentManager.ensureSession).toHaveBeenCalledWith(
        'my-session-id',
        expect.objectContaining({ permissionMode: 'default', cwd: '/tmp/test' }),
      );
    });

    it('calls agentManager.ensureSession and sendMessage', async () => {
      const envelope = makeEnvelope();

      await receiver.handleAgentMessage(envelope);

      expect(mocks.agentManager.ensureSession).toHaveBeenCalledWith(
        'session-abc',
        expect.objectContaining({ permissionMode: 'default', hasStarted: true }),
      );
      expect(mocks.agentManager.sendMessage).toHaveBeenCalledWith(
        'session-abc',
        'Hello agent',
        expect.objectContaining({ cwd: '/tmp/test' }),
      );
    });

    it('publishes response events to replyTo with incremented hop count', async () => {
      const events: StreamEvent[] = [
        { type: 'text_delta', data: { text: 'Hello' } },
        { type: 'text_delta', data: { text: ' world' } },
      ];
      vi.mocked(mocks.agentManager.sendMessage).mockReturnValue(mockEventStream(events));

      const envelope = makeEnvelope({
        replyTo: 'relay.human.console.client-1',
        budget: {
          hopCount: 1,
          maxHops: 5,
          ancestorChain: [],
          ttl: Date.now() + 60_000,
          callBudgetRemaining: 10,
        },
      });

      await receiver.handleAgentMessage(envelope);

      expect(mocks.relayCore.publish).toHaveBeenCalledTimes(2);
      // Check incremented hop count
      expect(mocks.relayCore.publish).toHaveBeenCalledWith(
        'relay.human.console.client-1',
        events[0],
        expect.objectContaining({
          from: 'agent:session-abc',
          budget: expect.objectContaining({ hopCount: 2 }),
        }),
      );
    });

    it('does not publish if no replyTo', async () => {
      const events: StreamEvent[] = [{ type: 'text_delta', data: { text: 'Hello' } }];
      vi.mocked(mocks.agentManager.sendMessage).mockReturnValue(mockEventStream(events));

      const envelope = makeEnvelope({ replyTo: undefined });

      await receiver.handleAgentMessage(envelope);

      expect(mocks.relayCore.publish).not.toHaveBeenCalled();
    });

    it('records trace span as pending then updates to processed', async () => {
      const envelope = makeEnvelope();

      await receiver.handleAgentMessage(envelope);

      // Insert with pending status
      expect(mocks.traceStore.insertSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-001',
          status: 'pending',
          toEndpoint: 'agent:session-abc',
        }),
      );

      // Update to processed
      expect(mocks.traceStore.updateSpan).toHaveBeenCalledWith(
        'msg-001',
        expect.objectContaining({
          status: 'processed',
          processedAt: expect.any(Number),
        }),
      );
    });

    it('updates trace to failed on error', async () => {
      vi.mocked(mocks.agentManager.sendMessage).mockImplementation(() => {
        throw new Error('Agent crashed');
      });

      const envelope = makeEnvelope();

      await receiver.handleAgentMessage(envelope);

      expect(mocks.traceStore.updateSpan).toHaveBeenCalledWith(
        'msg-001',
        expect.objectContaining({
          status: 'failed',
          error: 'Agent crashed',
        }),
      );
    });

    it('skips processing for invalid subject', async () => {
      const envelope = makeEnvelope({ subject: 'invalid.subject' });

      await receiver.handleAgentMessage(envelope);

      expect(mocks.agentManager.ensureSession).not.toHaveBeenCalled();
      expect(mocks.traceStore.insertSpan).not.toHaveBeenCalled();
    });
  });

  describe('handlePulseMessage()', () => {
    it('validates payload type and records trace', async () => {
      const envelope = makePulseEnvelope();

      await receiver.handlePulseMessage(envelope);

      expect(mocks.traceStore.insertSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-001',
          status: 'delivered',
          toEndpoint: 'pulse:sched-001',
        }),
      );
    });

    it('rejects invalid PulseDispatchPayload and records failed trace', async () => {
      const envelope = makeEnvelope({
        subject: 'relay.system.pulse.sched-001',
        payload: { type: 'not_pulse_dispatch' },
      });

      await receiver.handlePulseMessage(envelope);

      expect(mocks.agentManager.ensureSession).not.toHaveBeenCalled();
      expect(mocks.traceStore.insertSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-001',
          status: 'failed',
          toEndpoint: 'pulse:unknown',
        }),
      );
    });
  });

  describe('handlePulseMessage() with pulseStore', () => {
    let pulseStore: {
      updateRun: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      pulseStore = {
        updateRun: vi.fn(),
      };
      receiver = new MessageReceiver({
        relayCore: mocks.relayCore,
        agentManager: mocks.agentManager,
        traceStore: mocks.traceStore,
        defaultCwd: '/tmp/test',
        pulseStore: pulseStore as never,
      });
    });

    it('calls ensureSession and sendMessage with correct args', async () => {
      const envelope = makePulseEnvelope();

      await receiver.handlePulseMessage(envelope);

      expect(mocks.agentManager.ensureSession).toHaveBeenCalledWith(
        'run-001',
        expect.objectContaining({
          permissionMode: 'default',
          hasStarted: false,
        }),
      );
      expect(mocks.agentManager.sendMessage).toHaveBeenCalledWith(
        'run-001',
        'Do something',
        expect.objectContaining({ cwd: '/tmp/test' }),
      );
    });

    it('marks run as completed on success with output summary', async () => {
      const events: StreamEvent[] = [
        { type: 'text_delta', data: { text: 'Result output' } },
      ];
      vi.mocked(mocks.agentManager.sendMessage).mockReturnValue(mockEventStream(events));

      const envelope = makePulseEnvelope();

      await receiver.handlePulseMessage(envelope);

      expect(pulseStore.updateRun).toHaveBeenCalledWith(
        'run-001',
        expect.objectContaining({
          status: 'completed',
          outputSummary: 'Result output',
          sessionId: 'run-001',
        }),
      );
      expect(mocks.traceStore.updateSpan).toHaveBeenCalledWith(
        'msg-001',
        expect.objectContaining({ status: 'processed' }),
      );
    });

    it('marks run as failed on agentManager error', async () => {
      vi.mocked(mocks.agentManager.sendMessage).mockImplementation(() => {
        throw new Error('Agent exploded');
      });

      const envelope = makePulseEnvelope();

      await receiver.handlePulseMessage(envelope);

      expect(pulseStore.updateRun).toHaveBeenCalledWith(
        'run-001',
        expect.objectContaining({
          status: 'failed',
          error: 'Agent exploded',
          sessionId: 'run-001',
        }),
      );
      expect(mocks.traceStore.updateSpan).toHaveBeenCalledWith(
        'msg-001',
        expect.objectContaining({
          status: 'failed',
          error: 'Agent exploded',
        }),
      );
    });

    it('does not call agentManager for invalid payload', async () => {
      const envelope = makePulseEnvelope({
        payload: { type: 'wrong_type' },
      });

      await receiver.handlePulseMessage(envelope);

      expect(mocks.agentManager.ensureSession).not.toHaveBeenCalled();
      expect(mocks.agentManager.sendMessage).not.toHaveBeenCalled();
      expect(pulseStore.updateRun).not.toHaveBeenCalled();
    });

    it('truncates output summary to 1000 chars', async () => {
      const longText = 'x'.repeat(2000);
      const events: StreamEvent[] = [
        { type: 'text_delta', data: { text: longText } },
      ];
      vi.mocked(mocks.agentManager.sendMessage).mockReturnValue(mockEventStream(events));

      const envelope = makePulseEnvelope();

      await receiver.handlePulseMessage(envelope);

      expect(pulseStore.updateRun).toHaveBeenCalledWith(
        'run-001',
        expect.objectContaining({
          status: 'completed',
          outputSummary: 'x'.repeat(1000),
        }),
      );
    });

    it('fails immediately when budget TTL is already expired', async () => {
      const envelope = makePulseEnvelope({
        budget: {
          hopCount: 0,
          maxHops: 5,
          ancestorChain: [],
          ttl: Date.now() - 1000, // already expired
          callBudgetRemaining: 10,
        },
      });

      await receiver.handlePulseMessage(envelope);

      // Should not even attempt to call agentManager
      expect(mocks.agentManager.ensureSession).not.toHaveBeenCalled();

      // Run marked as failed due to expired TTL
      expect(pulseStore.updateRun).toHaveBeenCalledWith(
        'run-001',
        expect.objectContaining({
          status: 'failed',
          error: 'Run timed out (TTL budget expired)',
        }),
      );

      expect(mocks.traceStore.updateSpan).toHaveBeenCalledWith(
        'msg-001',
        expect.objectContaining({ status: 'failed' }),
      );
    });
  });
});
