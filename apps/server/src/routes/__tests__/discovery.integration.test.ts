/**
 * Integration tests for the discovery SSE endpoint.
 *
 * These tests verify the SSE wire format, event sequencing, and error handling
 * of POST /api/discovery/scan by mounting the router in a real Express app
 * and using supertest to make requests.
 *
 * The scanner is mocked to return controlled async generators — the focus
 * is on the route/SSE layer, not the filesystem scanning logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSSEResponse } from '@dorkos/test-utils/sse-helpers';
import type { ScanEvent } from '../../services/discovery/discovery-scanner.js';

// Mock the discovery scanner
const mockScanForAgents = vi.fn();
vi.mock('../../services/discovery/discovery-scanner.js', () => ({
  scanForAgents: (...args: unknown[]) => mockScanForAgents(...args),
}));

// Mock boundary module
const mockIsWithinBoundary = vi.fn();
vi.mock('../../lib/boundary.js', () => ({
  isWithinBoundary: (...args: unknown[]) => mockIsWithinBoundary(...args),
  getBoundary: vi.fn().mockReturnValue('/home/user'),
  initBoundary: vi.fn(),
  validateBoundary: vi.fn(),
  BoundaryError: class BoundaryError extends Error {
    readonly code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = 'BoundaryError';
      this.code = code;
    }
  },
}));

import request from 'supertest';
import express from 'express';
import { createDiscoveryRouter } from '../discovery.js';

/** Helper to create a minimal Express app with the discovery router mounted. */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/discovery', createDiscoveryRouter());
  return app;
}

/**
 * Helper to send a POST to /api/discovery/scan and collect the raw SSE response.
 *
 * Supertest's default parser doesn't handle SSE streams, so we use a custom
 * parser that collects all chunks into a single string.
 */
async function postScan(app: express.Express, body: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/discovery/scan')
    .send(body)
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
}

/** Create a mock async generator that yields the given events. */
function mockGenerator(events: ScanEvent[]) {
  return async function* () {
    for (const e of events) yield e;
  };
}

describe('Discovery SSE Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsWithinBoundary.mockResolvedValue(true);
  });

  // -------------------------------------------------------------------------
  // SSE format
  // -------------------------------------------------------------------------

  describe('SSE format', () => {
    it('returns text/event-stream content type', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'complete', data: { scannedDirs: 0, foundAgents: 0, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      const res = await postScan(app);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/event-stream');
    });

    it('returns no-cache and keep-alive headers', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'complete', data: { scannedDirs: 0, foundAgents: 0, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      const res = await postScan(app);

      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['connection']).toBe('keep-alive');
      expect(res.headers['x-accel-buffering']).toBe('no');
    });

    it('formats each event as event: + data: lines separated by double newlines', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'complete', data: { scannedDirs: 5, foundAgents: 1, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      const res = await postScan(app);
      const raw = res.body as string;

      // Verify the raw SSE wire format
      expect(raw).toContain('event: complete\n');
      expect(raw).toContain('data: ');
      // Each event block ends with a double newline
      expect(raw).toMatch(/data: .+\n\n/);
    });
  });

  // -------------------------------------------------------------------------
  // Candidate events
  // -------------------------------------------------------------------------

  describe('candidate events', () => {
    it('emits candidate events for discovered projects', async () => {
      const candidates: ScanEvent[] = [
        {
          type: 'candidate',
          data: {
            path: '/home/user/project-alpha',
            name: 'project-alpha',
            markers: ['CLAUDE.md', '.claude'],
            gitBranch: 'main',
            gitRemote: 'git@github.com:user/project-alpha.git',
            hasDorkManifest: false,
          },
        },
        {
          type: 'candidate',
          data: {
            path: '/home/user/project-beta',
            name: 'project-beta',
            markers: ['.dork/agent.json'],
            gitBranch: 'develop',
            gitRemote: null,
            hasDorkManifest: true,
          },
        },
        {
          type: 'complete',
          data: { scannedDirs: 50, foundAgents: 2, timedOut: false },
        },
      ];

      mockScanForAgents.mockImplementation(mockGenerator(candidates));

      const app = createTestApp();
      const res = await postScan(app);
      const parsed = parseSSEResponse(res.body as string);

      expect(parsed).toHaveLength(3);

      // First candidate
      expect(parsed[0].type).toBe('candidate');
      expect(parsed[0].data).toEqual({
        path: '/home/user/project-alpha',
        name: 'project-alpha',
        markers: ['CLAUDE.md', '.claude'],
        gitBranch: 'main',
        gitRemote: 'git@github.com:user/project-alpha.git',
        hasDorkManifest: false,
      });

      // Second candidate
      expect(parsed[1].type).toBe('candidate');
      expect(parsed[1].data).toEqual(
        expect.objectContaining({
          name: 'project-beta',
          hasDorkManifest: true,
        }),
      );
    });

    it('preserves null values for git fields in candidate data', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          {
            type: 'candidate',
            data: {
              path: '/home/user/no-git',
              name: 'no-git',
              markers: ['CLAUDE.md'],
              gitBranch: null,
              gitRemote: null,
              hasDorkManifest: false,
            },
          },
          { type: 'complete', data: { scannedDirs: 1, foundAgents: 1, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      const res = await postScan(app);
      const parsed = parseSSEResponse(res.body as string);

      const candidate = parsed[0].data as Record<string, unknown>;
      expect(candidate.gitBranch).toBeNull();
      expect(candidate.gitRemote).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Progress events
  // -------------------------------------------------------------------------

  describe('progress events', () => {
    it('emits progress events with scanned dir and agent counts', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'progress', data: { scannedDirs: 100, foundAgents: 2 } },
          { type: 'progress', data: { scannedDirs: 200, foundAgents: 5 } },
          { type: 'complete', data: { scannedDirs: 250, foundAgents: 5, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      const res = await postScan(app);
      const parsed = parseSSEResponse(res.body as string);

      const progressEvents = parsed.filter((e) => e.type === 'progress');
      expect(progressEvents).toHaveLength(2);
      expect(progressEvents[0].data).toEqual({ scannedDirs: 100, foundAgents: 2 });
      expect(progressEvents[1].data).toEqual({ scannedDirs: 200, foundAgents: 5 });
    });

    it('handles zero progress events when scan completes quickly', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'complete', data: { scannedDirs: 3, foundAgents: 0, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      const res = await postScan(app);
      const parsed = parseSSEResponse(res.body as string);

      const progressEvents = parsed.filter((e) => e.type === 'progress');
      expect(progressEvents).toHaveLength(0);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('complete');
    });
  });

  // -------------------------------------------------------------------------
  // Complete event
  // -------------------------------------------------------------------------

  describe('complete event', () => {
    it('emits a complete event with summary counts', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'complete', data: { scannedDirs: 500, foundAgents: 12, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      const res = await postScan(app);
      const parsed = parseSSEResponse(res.body as string);

      const complete = parsed.find((e) => e.type === 'complete');
      expect(complete).toBeDefined();
      expect(complete!.data).toEqual({
        scannedDirs: 500,
        foundAgents: 12,
        timedOut: false,
      });
    });

    it('reports timedOut: true when scan exceeds timeout', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'progress', data: { scannedDirs: 100, foundAgents: 1 } },
          { type: 'complete', data: { scannedDirs: 100, foundAgents: 1, timedOut: true } },
        ]),
      );

      const app = createTestApp();
      const res = await postScan(app);
      const parsed = parseSSEResponse(res.body as string);

      const complete = parsed.find((e) => e.type === 'complete');
      expect(complete!.data).toEqual(
        expect.objectContaining({ timedOut: true }),
      );
    });

    it('is the last event in the stream', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          {
            type: 'candidate',
            data: {
              path: '/home/user/proj',
              name: 'proj',
              markers: ['CLAUDE.md'],
              gitBranch: null,
              gitRemote: null,
              hasDorkManifest: false,
            },
          },
          { type: 'progress', data: { scannedDirs: 100, foundAgents: 1 } },
          { type: 'complete', data: { scannedDirs: 150, foundAgents: 1, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      const res = await postScan(app);
      const parsed = parseSSEResponse(res.body as string);

      expect(parsed[parsed.length - 1].type).toBe('complete');
    });
  });

  // -------------------------------------------------------------------------
  // Validation errors (400)
  // -------------------------------------------------------------------------

  describe('validation errors', () => {
    it('returns 400 for maxDepth below 1', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/discovery/scan').send({ maxDepth: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('returns 400 for maxDepth above 10', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/discovery/scan').send({ maxDepth: 11 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('returns JSON error body with details', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/discovery/scan').send({ maxDepth: -1 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('details');
    });

    it('does not call scanner when validation fails', async () => {
      const app = createTestApp();
      await request(app).post('/api/discovery/scan').send({ maxDepth: 999 });

      expect(mockScanForAgents).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Boundary violation (403)
  // -------------------------------------------------------------------------

  describe('boundary violation', () => {
    it('returns 403 when root is outside the directory boundary', async () => {
      mockIsWithinBoundary.mockResolvedValue(false);

      const app = createTestApp();
      const res = await request(app)
        .post('/api/discovery/scan')
        .send({ root: '/root/forbidden' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Root path outside directory boundary');
    });

    it('does not call scanner when boundary check fails', async () => {
      mockIsWithinBoundary.mockResolvedValue(false);

      const app = createTestApp();
      await request(app)
        .post('/api/discovery/scan')
        .send({ root: '/root/forbidden' });

      expect(mockScanForAgents).not.toHaveBeenCalled();
    });

    it('skips boundary check when root is omitted', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'complete', data: { scannedDirs: 0, foundAgents: 0, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      await postScan(app, {});

      expect(mockIsWithinBoundary).not.toHaveBeenCalled();
      expect(mockScanForAgents).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Timeout parameter passthrough
  // -------------------------------------------------------------------------

  describe('timeout parameter', () => {
    it('passes timeout to the scanner', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'complete', data: { scannedDirs: 0, foundAgents: 0, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      await postScan(app, { timeout: 5000 });

      expect(mockScanForAgents).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('passes maxDepth to the scanner', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'complete', data: { scannedDirs: 0, foundAgents: 0, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      await postScan(app, { maxDepth: 7 });

      expect(mockScanForAgents).toHaveBeenCalledWith(
        expect.objectContaining({ maxDepth: 7 }),
      );
    });

    it('passes root to the scanner after boundary check', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'complete', data: { scannedDirs: 0, foundAgents: 0, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      await postScan(app, { root: '/home/user/projects' });

      expect(mockIsWithinBoundary).toHaveBeenCalledWith('/home/user/projects');
      expect(mockScanForAgents).toHaveBeenCalledWith(
        expect.objectContaining({ root: '/home/user/projects' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Scanner error handling
  // -------------------------------------------------------------------------

  describe('scanner error handling', () => {
    it('emits an error SSE event when the scanner throws', async () => {
      mockScanForAgents.mockImplementation(async function* () {
        yield { type: 'progress', data: { scannedDirs: 10, foundAgents: 0 } };
        throw new Error('Permission denied');
      });

      const app = createTestApp();
      const res = await postScan(app);
      const parsed = parseSSEResponse(res.body as string);

      const errorEvent = parsed.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.data).toEqual({ error: 'Permission denied' });
    });

    it('emits a generic error message for non-Error exceptions', async () => {
      mockScanForAgents.mockImplementation(async function* () {
        throw 'string-error';
      });

      const app = createTestApp();
      const res = await postScan(app);
      const parsed = parseSSEResponse(res.body as string);

      const errorEvent = parsed.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.data).toEqual({ error: 'Scan failed' });
    });

    it('still returns 200 status for scanner errors (error is in SSE stream)', async () => {
      mockScanForAgents.mockImplementation(async function* () {
        throw new Error('Boom');
      });

      const app = createTestApp();
      const res = await postScan(app);

      // SSE streams return 200; errors are communicated via event data
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Full event sequence
  // -------------------------------------------------------------------------

  describe('full event sequence', () => {
    it('streams a realistic mix of candidate, progress, and complete events', async () => {
      const events: ScanEvent[] = [
        {
          type: 'candidate',
          data: {
            path: '/home/user/web-app',
            name: 'web-app',
            markers: ['CLAUDE.md'],
            gitBranch: 'main',
            gitRemote: 'https://github.com/user/web-app.git',
            hasDorkManifest: false,
          },
        },
        { type: 'progress', data: { scannedDirs: 100, foundAgents: 1 } },
        {
          type: 'candidate',
          data: {
            path: '/home/user/api-server',
            name: 'api-server',
            markers: ['.dork/agent.json', '.claude'],
            gitBranch: 'feature/auth',
            gitRemote: 'https://github.com/user/api-server.git',
            hasDorkManifest: true,
          },
        },
        { type: 'progress', data: { scannedDirs: 200, foundAgents: 2 } },
        { type: 'progress', data: { scannedDirs: 300, foundAgents: 2 } },
        { type: 'complete', data: { scannedDirs: 350, foundAgents: 2, timedOut: false } },
      ];

      mockScanForAgents.mockImplementation(mockGenerator(events));

      const app = createTestApp();
      const res = await postScan(app);
      const parsed = parseSSEResponse(res.body as string);

      expect(parsed).toHaveLength(6);

      // Verify event ordering
      const types = parsed.map((e) => e.type);
      expect(types).toEqual([
        'candidate',
        'progress',
        'candidate',
        'progress',
        'progress',
        'complete',
      ]);

      // Verify candidate data integrity through JSON serialization round-trip
      const candidates = parsed.filter((e) => e.type === 'candidate');
      expect(candidates).toHaveLength(2);
      expect((candidates[0].data as Record<string, unknown>).name).toBe('web-app');
      expect((candidates[1].data as Record<string, unknown>).name).toBe('api-server');
    });

    it('handles an empty scan with only a complete event', async () => {
      mockScanForAgents.mockImplementation(
        mockGenerator([
          { type: 'complete', data: { scannedDirs: 0, foundAgents: 0, timedOut: false } },
        ]),
      );

      const app = createTestApp();
      const res = await postScan(app);
      const parsed = parseSSEResponse(res.body as string);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('complete');
      expect(parsed[0].data).toEqual({
        scannedDirs: 0,
        foundAgents: 0,
        timedOut: false,
      });
    });
  });
});
