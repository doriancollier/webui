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

vi.mock('../../services/session/transcript-reader.js', () => ({
  transcriptReader: {
    listSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn().mockResolvedValue({ id: 'test-id', title: 'Test' }),
    readTranscript: vi.fn().mockResolvedValue([]),
    listTranscripts: vi.fn().mockResolvedValue([]),
    getTranscriptETag: vi.fn().mockResolvedValue(null),
    readTasks: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/core/agent-manager.js', () => ({
  agentManager: {
    ensureSession: vi.fn(),
    sendMessage: vi.fn(),
    approveTool: vi.fn(),
    updateSession: vi.fn().mockReturnValue(true),
    hasSession: vi.fn(),
    checkSessionHealth: vi.fn(),
    getSdkSessionId: vi.fn(),
    acquireLock: vi.fn().mockReturnValue(true),
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

import request from 'supertest';
import { createApp } from '../../app.js';
import { validateBoundary, BoundaryError } from '../../lib/boundary.js';

const app = createApp();

// Attach mock sessionBroadcaster to app.locals (needed by GET /:id/stream)
const mockSessionBroadcaster = {
  registerClient: vi.fn(),
  deregisterClient: vi.fn(),
  shutdown: vi.fn(),
};
app.locals.sessionBroadcaster = mockSessionBroadcaster;

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

  describe('POST / (create session)', () => {
    it('rejects cwd outside boundary with 403', async () => {
      vi.mocked(validateBoundary).mockRejectedValueOnce(
        new BoundaryError('Access denied: path outside directory boundary', 'OUTSIDE_BOUNDARY'),
      );

      const res = await request(app)
        .post('/api/sessions')
        .send({ cwd: '/etc/shadow' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OUTSIDE_BOUNDARY');
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
