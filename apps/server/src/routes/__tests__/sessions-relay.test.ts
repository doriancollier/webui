import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StreamEvent } from '@dorkos/shared/types';

// Mock relay-state before importing app
vi.mock('../../services/relay/relay-state.js', () => ({
  isRelayEnabled: vi.fn(() => false),
  setRelayEnabled: vi.fn(),
}));

// Mock boundary before importing app
vi.mock('../../lib/boundary.js', () => ({
  validateBoundary: vi.fn(async (p: string) => p),
  getBoundary: vi.fn(() => '/mock/home'),
  initBoundary: vi.fn().mockResolvedValue('/mock/home'),
  isWithinBoundary: vi.fn().mockResolvedValue(true),
  BoundaryError: class BoundaryError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = 'BoundaryError';
      this.code = code;
    }
  },
}));

// Mock logger — use vi.hoisted so the variable is available inside the hoisted vi.mock factory
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
vi.mock('../../lib/logger.js', () => ({
  logger: mockLogger,
  initLogger: vi.fn(),
}));

// Mock services before importing app
vi.mock('../../services/session/transcript-reader.js', () => ({
  transcriptReader: {
    listSessions: vi.fn(),
    getSession: vi.fn(),
    readTranscript: vi.fn(),
    listTranscripts: vi.fn(),
  },
}));

vi.mock('../../services/core/agent-manager.js', () => ({
  agentManager: {
    ensureSession: vi.fn(),
    sendMessage: vi.fn(),
    approveTool: vi.fn(),
    updateSession: vi.fn(),
    hasSession: vi.fn(),
    checkSessionHealth: vi.fn(),
    getSdkSessionId: vi.fn(),
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
    getLockInfo: vi.fn(),
    isLocked: vi.fn(),
  },
}));

vi.mock('../../services/core/tunnel-manager.js', () => ({
  tunnelManager: {
    status: { enabled: false, connected: false, url: null, port: null, startedAt: null },
  },
}));

vi.mock('../../services/session/session-broadcaster.js', () => ({
  SessionBroadcaster: vi.fn().mockImplementation(() => ({
    registerClient: vi.fn(),
    deregisterClient: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

// Dynamically import after mocks are set up
import request from 'supertest';
import { createApp } from '../../app.js';
import { agentManager } from '../../services/core/agent-manager.js';
import { isRelayEnabled } from '../../services/relay/relay-state.js';
import { parseSSEResponse } from '@dorkos/test-utils/sse-helpers';

function createMockRelayCore() {
  return {
    publish: vi.fn().mockResolvedValue({ messageId: 'msg-001', deliveredTo: 1 }),
    registerEndpoint: vi.fn().mockResolvedValue({ subject: 'test', hash: 'abc' }),
    unregisterEndpoint: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn().mockReturnValue(() => {}),
    listEndpoints: vi.fn().mockReturnValue([]),
    getMessage: vi.fn(),
    listMessages: vi.fn().mockReturnValue({ messages: [] }),
    readInbox: vi.fn().mockReturnValue({ messages: [] }),
    getDeadLetters: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockReturnValue({ totalMessages: 0 }),
    onSignal: vi.fn().mockReturnValue(() => {}),
    close: vi.fn(),
  };
}

/** Valid UUID for session ID params (routes validate UUID format). */
const S1 = '00000000-0000-4000-8000-000000000001';

describe('Sessions Routes — Relay Integration', () => {
  let app: ReturnType<typeof createApp>;
  let mockRelayCore: ReturnType<typeof createMockRelayCore>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentManager.acquireLock).mockReturnValue(true);
    vi.mocked(agentManager.getLockInfo).mockReturnValue(null);
    vi.mocked(isRelayEnabled).mockReturnValue(false);

    app = createApp();
    mockRelayCore = createMockRelayCore();

    // Attach mock session broadcaster
    app.locals.sessionBroadcaster = {
      registerClient: vi.fn(),
      deregisterClient: vi.fn(),
      shutdown: vi.fn(),
    };
  });

  describe('POST /api/sessions/:id/messages — Relay path', () => {
    it('returns 202 with receipt when Relay is enabled', async () => {
      vi.mocked(isRelayEnabled).mockReturnValue(true);
      app.locals.relayCore = mockRelayCore;

      const res = await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .set('X-Client-Id', 'client-42')
        .send({ content: 'hello relay' });

      expect(res.status).toBe(202);
      expect(res.body).toEqual({
        messageId: 'msg-001',
        traceId: 'msg-001',
      });
    });

    it('registers console endpoint with correct subject', async () => {
      vi.mocked(isRelayEnabled).mockReturnValue(true);
      app.locals.relayCore = mockRelayCore;

      await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .set('X-Client-Id', 'client-42')
        .send({ content: 'hello' });

      expect(mockRelayCore.registerEndpoint).toHaveBeenCalledWith(
        'relay.human.console.client-42',
      );
    });

    it('publishes to relay.agent.{sessionId} with correct budget', async () => {
      vi.mocked(isRelayEnabled).mockReturnValue(true);
      app.locals.relayCore = mockRelayCore;

      const beforeTs = Date.now();
      await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .set('X-Client-Id', 'client-42')
        .send({ content: 'hello relay' });

      expect(mockRelayCore.publish).toHaveBeenCalledWith(
        `relay.agent.${S1}`,
        { content: 'hello relay', cwd: undefined },
        expect.objectContaining({
          from: 'relay.human.console.client-42',
          replyTo: 'relay.human.console.client-42',
          budget: expect.objectContaining({
            maxHops: 5,
            callBudgetRemaining: 10,
          }),
        }),
      );

      // Verify TTL is approximately 300 seconds from now
      const publishCall = mockRelayCore.publish.mock.calls[0];
      const ttl = publishCall[2].budget.ttl as number;
      expect(ttl).toBeGreaterThanOrEqual(beforeTs + 300_000 - 1000);
      expect(ttl).toBeLessThanOrEqual(beforeTs + 300_000 + 1000);
    });

    it('acquires and releases session lock in Relay path', async () => {
      vi.mocked(isRelayEnabled).mockReturnValue(true);
      app.locals.relayCore = mockRelayCore;

      await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .set('X-Client-Id', 'client-42')
        .send({ content: 'hello' });

      expect(agentManager.acquireLock).toHaveBeenCalledWith(
        S1,
        'client-42',
        expect.anything(),
      );
      expect(agentManager.releaseLock).toHaveBeenCalledWith(S1, 'client-42');
    });

    it('returns 409 when session is locked even in Relay path', async () => {
      vi.mocked(isRelayEnabled).mockReturnValue(true);
      app.locals.relayCore = mockRelayCore;
      vi.mocked(agentManager.acquireLock).mockReturnValue(false);
      vi.mocked(agentManager.getLockInfo).mockReturnValue({
        clientId: 'other-client',
        acquiredAt: Date.now() - 60000,
      });

      const res = await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .set('X-Client-Id', 'client-42')
        .send({ content: 'hello' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SESSION_LOCKED');
      expect(mockRelayCore.publish).not.toHaveBeenCalled();
    });

    it('returns 500 when Relay publish fails', async () => {
      vi.mocked(isRelayEnabled).mockReturnValue(true);
      app.locals.relayCore = mockRelayCore;
      mockRelayCore.publish.mockRejectedValue(new Error('Bus overloaded'));

      const res = await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .set('X-Client-Id', 'client-42')
        .send({ content: 'hello' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Bus overloaded');
    });

    it('releases lock even when Relay publish fails', async () => {
      vi.mocked(isRelayEnabled).mockReturnValue(true);
      app.locals.relayCore = mockRelayCore;
      mockRelayCore.publish.mockRejectedValue(new Error('Bus overloaded'));

      await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .set('X-Client-Id', 'client-42')
        .send({ content: 'hello' });

      expect(agentManager.releaseLock).toHaveBeenCalledWith(S1, 'client-42');
    });

    it('ignores duplicate endpoint registration errors', async () => {
      vi.mocked(isRelayEnabled).mockReturnValue(true);
      app.locals.relayCore = mockRelayCore;
      mockRelayCore.registerEndpoint.mockRejectedValue(new Error('Endpoint already registered'));

      const res = await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .set('X-Client-Id', 'client-42')
        .send({ content: 'hello' });

      // Should still succeed despite endpoint registration error
      expect(res.status).toBe(202);
      expect(mockRelayCore.publish).toHaveBeenCalled();
    });

    it('returns message ID as trace ID instead of no-trace', async () => {
      vi.mocked(isRelayEnabled).mockReturnValue(true);
      app.locals.relayCore = mockRelayCore;
      const mockMessageId = 'test-msg-01ABCDEF';
      mockRelayCore.publish.mockResolvedValue({
        messageId: mockMessageId,
        deliveredTo: 1,
      });

      const res = await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .set('X-Client-Id', 'client-1')
        .send({ content: 'hello' });

      expect(res.status).toBe(202);
      expect(res.body.traceId).toBe(mockMessageId);
      expect(res.body.traceId).not.toBe('no-trace');
    });

    it('logs error when endpoint registration fails for non-duplicate reason', async () => {
      mockLogger.error.mockClear();

      vi.mocked(isRelayEnabled).mockReturnValue(true);
      app.locals.relayCore = mockRelayCore;
      mockRelayCore.registerEndpoint.mockRejectedValue(new Error('disk full'));

      const res = await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .set('X-Client-Id', 'client-1')
        .send({ content: 'hello' });

      // Publish should still proceed
      expect(res.status).toBe(202);
      // Error should be logged via logger
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('publishViaRelay'),
        expect.stringContaining('disk full'),
      );
    });

    it('silently ignores already-registered endpoint errors without logging', async () => {
      mockLogger.error.mockClear();

      vi.mocked(isRelayEnabled).mockReturnValue(true);
      app.locals.relayCore = mockRelayCore;
      mockRelayCore.registerEndpoint.mockRejectedValue(new Error('endpoint already registered'));

      const res = await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .set('X-Client-Id', 'client-1')
        .send({ content: 'hello' });

      expect(res.status).toBe(202);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/sessions/:id/messages — Legacy path (Relay disabled)', () => {
    it('returns SSE stream when Relay is disabled', async () => {
      vi.mocked(isRelayEnabled).mockReturnValue(false);

      const events: StreamEvent[] = [
        { type: 'text_delta', data: { text: 'Hello world' } },
        { type: 'done', data: { sessionId: S1 } },
      ];

      vi.mocked(agentManager.sendMessage).mockImplementation(async function* () {
        for (const event of events) {
          yield event;
        }
      });
      vi.mocked(agentManager.getSdkSessionId).mockReturnValue(S1);

      const res = await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .send({ content: 'hi' })
        .buffer(true)
        .parse((res, callback) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            callback(null, data);
          });
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/event-stream');

      const parsed = parseSSEResponse(res.body);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].type).toBe('text_delta');
    });

    it('returns SSE stream when isRelayEnabled is true but relayCore is missing', async () => {
      vi.mocked(isRelayEnabled).mockReturnValue(true);
      // Do NOT set app.locals.relayCore — it stays undefined

      const events: StreamEvent[] = [
        { type: 'text_delta', data: { text: 'fallback' } },
        { type: 'done', data: { sessionId: S1 } },
      ];

      vi.mocked(agentManager.sendMessage).mockImplementation(async function* () {
        for (const event of events) {
          yield event;
        }
      });
      vi.mocked(agentManager.getSdkSessionId).mockReturnValue(S1);

      const res = await request(app)
        .post(`/api/sessions/${S1}/messages`)
        .send({ content: 'hi' })
        .buffer(true)
        .parse((res, callback) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            callback(null, data);
          });
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/event-stream');
    });
  });
});
