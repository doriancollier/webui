import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Mock runtime that satisfies the AgentRuntime interface methods used by sessions.ts
const mockRuntime = vi.hoisted(() => ({
  type: 'claude-code',
  ensureSession: vi.fn(),
  hasSession: vi.fn(() => false),
  updateSession: vi.fn().mockReturnValue(true),
  sendMessage: vi.fn(),
  approveTool: vi.fn(),
  submitAnswers: vi.fn(() => true),
  listSessions: vi.fn().mockResolvedValue([]),
  getSession: vi.fn().mockResolvedValue({ id: 'test-id', title: 'Test' }),
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
import { validateBoundary, BoundaryError } from '../../lib/boundary.js';

const app = createApp();

/** Valid UUID for session ID params (routes validate UUID format). */
const SESSION_ID = '00000000-0000-4000-8000-000000000001';

describe('Sessions Routes — Boundary Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PATCH /:id', () => {
    it('rejects cwd outside boundary with 403', async () => {
      vi.mocked(validateBoundary).mockRejectedValueOnce(
        new BoundaryError('Access denied: path outside directory boundary', 'OUTSIDE_BOUNDARY'),
      );

      const res = await request(app)
        .patch(`/api/sessions/${SESSION_ID}`)
        .query({ cwd: '/etc/shadow' })
        .send({ permissionMode: 'default' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OUTSIDE_BOUNDARY');
      expect(res.body.error).toBe('Access denied: path outside directory boundary');
    });

    it('rejects null byte paths with 403', async () => {
      vi.mocked(validateBoundary).mockRejectedValueOnce(
        new BoundaryError('Invalid path: null bytes not allowed', 'NULL_BYTE'),
      );

      const res = await request(app)
        .patch(`/api/sessions/${SESSION_ID}`)
        .query({ cwd: '/home/user\0' })
        .send({ permissionMode: 'default' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NULL_BYTE');
    });

    it('allows request when cwd is within boundary', async () => {
      vi.mocked(validateBoundary).mockResolvedValueOnce('/mock/home/project');

      const res = await request(app)
        .patch(`/api/sessions/${SESSION_ID}`)
        .query({ cwd: '/mock/home/project' })
        .send({ permissionMode: 'default' });

      expect(res.status).not.toBe(403);
      expect(validateBoundary).toHaveBeenCalledWith('/mock/home/project');
    });
  });

  describe('GET /:id/stream', () => {
    it('rejects cwd outside boundary with 403', async () => {
      vi.mocked(validateBoundary).mockRejectedValueOnce(
        new BoundaryError('Access denied: path outside directory boundary', 'OUTSIDE_BOUNDARY'),
      );

      const res = await request(app)
        .get(`/api/sessions/${SESSION_ID}/stream`)
        .query({ cwd: '/etc/passwd' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OUTSIDE_BOUNDARY');
      expect(res.body.error).toBe('Access denied: path outside directory boundary');
    });

    it('rejects null byte paths with 403', async () => {
      vi.mocked(validateBoundary).mockRejectedValueOnce(
        new BoundaryError('Invalid path: null bytes not allowed', 'NULL_BYTE'),
      );

      const res = await request(app)
        .get(`/api/sessions/${SESSION_ID}/stream`)
        .query({ cwd: '/home/user\0' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NULL_BYTE');
    });

    it('calls assertBoundary with the cwd query parameter', async () => {
      vi.mocked(validateBoundary).mockRejectedValueOnce(
        new BoundaryError('Access denied: path outside directory boundary', 'OUTSIDE_BOUNDARY'),
      );

      await request(app)
        .get(`/api/sessions/${SESSION_ID}/stream`)
        .query({ cwd: '/outside/boundary' });

      expect(validateBoundary).toHaveBeenCalledWith('/outside/boundary');
    });
  });

  describe('GET / (list sessions)', () => {
    it('rejects cwd outside boundary with 403', async () => {
      vi.mocked(validateBoundary).mockRejectedValueOnce(
        new BoundaryError('Access denied: path outside directory boundary', 'OUTSIDE_BOUNDARY'),
      );

      const res = await request(app)
        .get('/api/sessions')
        .query({ cwd: '/etc/shadow' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OUTSIDE_BOUNDARY');
    });
  });

  describe('GET /:id (get session)', () => {
    it('rejects cwd outside boundary with 403', async () => {
      vi.mocked(validateBoundary).mockRejectedValueOnce(
        new BoundaryError('Access denied: path outside directory boundary', 'OUTSIDE_BOUNDARY'),
      );

      const res = await request(app)
        .get(`/api/sessions/${SESSION_ID}`)
        .query({ cwd: '/etc/shadow' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OUTSIDE_BOUNDARY');
    });
  });

  describe('GET /:id/messages', () => {
    it('rejects cwd outside boundary with 403', async () => {
      vi.mocked(validateBoundary).mockRejectedValueOnce(
        new BoundaryError('Access denied: path outside directory boundary', 'OUTSIDE_BOUNDARY'),
      );

      const res = await request(app)
        .get(`/api/sessions/${SESSION_ID}/messages`)
        .query({ cwd: '/etc/shadow' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OUTSIDE_BOUNDARY');
    });
  });

  describe('GET /:id/tasks', () => {
    it('rejects cwd outside boundary with 403', async () => {
      vi.mocked(validateBoundary).mockRejectedValueOnce(
        new BoundaryError('Access denied: path outside directory boundary', 'OUTSIDE_BOUNDARY'),
      );

      const res = await request(app)
        .get(`/api/sessions/${SESSION_ID}/tasks`)
        .query({ cwd: '/etc/shadow' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OUTSIDE_BOUNDARY');
    });
  });
});
