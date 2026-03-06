import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock runtime that satisfies the AgentRuntime interface methods used by sessions.ts
const mockRuntime = vi.hoisted(() => ({
  type: 'claude-code',
  ensureSession: vi.fn(),
  hasSession: vi.fn(() => false),
  updateSession: vi.fn(() => true),
  sendMessage: vi.fn(),
  approveTool: vi.fn(),
  submitAnswers: vi.fn(),
  listSessions: vi.fn().mockResolvedValue([]),
  getSession: vi.fn().mockResolvedValue(null),
  getMessageHistory: vi.fn().mockResolvedValue([]),
  getSessionTasks: vi.fn().mockResolvedValue([]),
  getSessionETag: vi.fn().mockResolvedValue(null),
  readFromOffset: vi.fn().mockResolvedValue({ content: '', newOffset: 0 }),
  watchSession: vi.fn(() => () => {}),
  acquireLock: vi.fn().mockReturnValue(true),
  releaseLock: vi.fn(),
  isLocked: vi.fn(() => false),
  getLockInfo: vi.fn(),
  getSupportedModels: vi.fn().mockResolvedValue([]),
  getCapabilities: vi.fn(() => ({
    type: 'claude-code',
    supportsPermissionModes: true,
    supportsToolApproval: true,
    supportsCostTracking: true,
    supportsResume: true,
    supportsMcp: true,
    supportsQuestionPrompt: true,
  })),
  getInternalSessionId: vi.fn(),
  getCommands: vi.fn().mockResolvedValue({ commands: [], lastScanned: '' }),
  checkSessionHealth: vi.fn(),
}));

vi.mock('../../services/core/runtime-registry.js', () => ({
  runtimeRegistry: {
    getDefault: vi.fn(() => mockRuntime),
    get: vi.fn(() => mockRuntime),
    getAllCapabilities: vi.fn(() => ({})),
    getDefaultType: vi.fn(() => 'claude-code'),
  },
}));

vi.mock('../../services/core/tunnel-manager.js', () => ({
  tunnelManager: {
    status: { enabled: false, connected: false, url: null, port: null, startedAt: null },
  },
}));

import request from 'supertest';
import { createApp } from '../../app.js';

const app = createApp();

/** Valid UUID for session ID params (routes validate UUID format). */
const SESSION_ID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/sessions/:id/submit-answers', () => {
  it('returns 200 when pending question exists', async () => {
    mockRuntime.submitAnswers.mockReturnValue(true);

    const res = await request(app)
      .post(`/api/sessions/${SESSION_ID}/submit-answers`)
      .send({ toolCallId: 'tc-1', answers: { '0': 'Option A' } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockRuntime.submitAnswers).toHaveBeenCalledWith(SESSION_ID, 'tc-1', {
      '0': 'Option A',
    });
  });

  it('returns 404 when no pending question exists', async () => {
    mockRuntime.submitAnswers.mockReturnValue(false);

    const res = await request(app)
      .post(`/api/sessions/${SESSION_ID}/submit-answers`)
      .send({ toolCallId: 'tc-1', answers: { '0': 'Option A' } });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('No pending question');
  });

  it('returns 400 when toolCallId is missing', async () => {
    const res = await request(app)
      .post(`/api/sessions/${SESSION_ID}/submit-answers`)
      .send({ answers: { '0': 'Option A' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 when answers is missing', async () => {
    const res = await request(app)
      .post(`/api/sessions/${SESSION_ID}/submit-answers`)
      .send({ toolCallId: 'tc-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });
});

describe('POST /api/sessions/:id/approve', () => {
  it('returns 200 when pending approval exists', async () => {
    mockRuntime.approveTool.mockReturnValue(true);

    const res = await request(app)
      .post(`/api/sessions/${SESSION_ID}/approve`)
      .send({ toolCallId: 'tc-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockRuntime.approveTool).toHaveBeenCalledWith(SESSION_ID, 'tc-1', true);
  });

  it('returns 404 when no pending approval exists', async () => {
    mockRuntime.approveTool.mockReturnValue(false);

    const res = await request(app)
      .post(`/api/sessions/${SESSION_ID}/approve`)
      .send({ toolCallId: 'tc-1' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('No pending approval');
  });
});

describe('POST /api/sessions/:id/deny', () => {
  it('returns 200 when pending approval exists', async () => {
    mockRuntime.approveTool.mockReturnValue(true);

    const res = await request(app)
      .post(`/api/sessions/${SESSION_ID}/deny`)
      .send({ toolCallId: 'tc-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockRuntime.approveTool).toHaveBeenCalledWith(SESSION_ID, 'tc-1', false);
  });
});
