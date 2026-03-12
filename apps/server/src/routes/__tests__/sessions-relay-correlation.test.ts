import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FakeAgentRuntime } from '@dorkos/test-utils';

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

// Mock logger
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

// Declared at module scope so the vi.mock factory closure can reference it.
// Initialized in beforeEach so each test starts with a fresh spy instance.
let fakeRuntime: FakeAgentRuntime;

vi.mock('../../services/core/runtime-registry.js', () => ({
  runtimeRegistry: {
    getDefault: vi.fn(() => fakeRuntime),
    get: vi.fn(() => fakeRuntime),
    getAllCapabilities: vi.fn(() => ({})),
    getDefaultType: vi.fn(() => 'fake'),
  },
}));

vi.mock('../../services/core/tunnel-manager.js', () => ({
  tunnelManager: {
    status: { enabled: false, connected: false, url: null, port: null, startedAt: null },
  },
}));

// Dynamically import after mocks are set up
import request from 'supertest';
import { createApp } from '../../app.js';
import { isRelayEnabled } from '../../services/relay/relay-state.js';

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

/** Valid UUID for correlationId field. */
const VALID_CORRELATION_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('POST /api/sessions/:id/messages — correlationId relay threading', () => {
  let app: ReturnType<typeof createApp>;
  let mockRelayCore: ReturnType<typeof createMockRelayCore>;

  beforeEach(() => {
    fakeRuntime = new FakeAgentRuntime();
    vi.clearAllMocks();
    fakeRuntime.acquireLock.mockReturnValue(true);
    fakeRuntime.getLockInfo.mockReturnValue(null);
    fakeRuntime.getInternalSessionId.mockReturnValue(undefined);
    vi.mocked(isRelayEnabled).mockReturnValue(true);

    app = createApp();
    mockRelayCore = createMockRelayCore();
    app.locals.relayCore = mockRelayCore;
  });

  it('threads correlationId from POST body into relay publish payload', async () => {
    const res = await request(app)
      .post(`/api/sessions/${S1}/messages`)
      .set('X-Client-Id', 'test-client')
      .send({ content: 'hello', correlationId: VALID_CORRELATION_ID })
      .expect(202);

    expect(res.body).toEqual({
      messageId: 'msg-001',
      traceId: 'msg-001',
    });

    // Verify relay.publish was called with correlationId in payload
    expect(mockRelayCore.publish).toHaveBeenCalledTimes(1);
    const [subject, payload] = mockRelayCore.publish.mock.calls[0];
    expect(subject).toBe(`relay.agent.${S1}`);
    expect(payload).toEqual(
      expect.objectContaining({
        content: 'hello',
        correlationId: VALID_CORRELATION_ID,
      }),
    );
  });

  it('omits correlationId from relay payload when not in POST body', async () => {
    await request(app)
      .post(`/api/sessions/${S1}/messages`)
      .set('X-Client-Id', 'test-client')
      .send({ content: 'hello' })
      .expect(202);

    expect(mockRelayCore.publish).toHaveBeenCalledTimes(1);
    const [, payload] = mockRelayCore.publish.mock.calls[0];
    expect(payload.correlationId).toBeUndefined();
  });

  it('rejects invalid correlationId format with 400', async () => {
    const res = await request(app)
      .post(`/api/sessions/${S1}/messages`)
      .set('X-Client-Id', 'test-client')
      .send({ content: 'hello', correlationId: 'not-a-uuid' })
      .expect(400);

    expect(res.body.error).toBeDefined();
    expect(mockRelayCore.publish).not.toHaveBeenCalled();
  });

  it('accepts request without correlationId for backward compatibility', async () => {
    const res = await request(app)
      .post(`/api/sessions/${S1}/messages`)
      .set('X-Client-Id', 'test-client')
      .send({ content: 'hello' })
      .expect(202);

    expect(res.body).toEqual({
      messageId: 'msg-001',
      traceId: 'msg-001',
    });
  });

  it('preserves other payload fields alongside correlationId', async () => {
    await request(app)
      .post(`/api/sessions/${S1}/messages`)
      .set('X-Client-Id', 'test-client')
      .send({ content: 'hello relay', cwd: '/some/dir', correlationId: VALID_CORRELATION_ID })
      .expect(202);

    const [subject, payload, opts] = mockRelayCore.publish.mock.calls[0];
    expect(subject).toBe(`relay.agent.${S1}`);
    expect(payload).toEqual({
      content: 'hello relay',
      cwd: '/some/dir',
      correlationId: VALID_CORRELATION_ID,
    });
    expect(opts).toEqual(
      expect.objectContaining({
        from: 'relay.human.console.test-client',
        replyTo: 'relay.human.console.test-client',
      }),
    );
  });
});
