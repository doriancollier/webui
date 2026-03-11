/**
 * Discovery routes — SSE-streamed filesystem scanning for AI-configured projects.
 *
 * Delegates to `meshCore.discover()` (unified scanner) and streams results as SSE.
 *
 * @module routes/discovery
 */
import { Router } from 'express';
import { z } from 'zod';
import type { MeshCore } from '@dorkos/mesh';
import { parseBody } from '../lib/route-utils.js';
import { isWithinBoundary, getBoundary } from '../lib/boundary.js';

/** Zod schema for the POST /scan request body. */
const ScanRequestSchema = z.object({
  root: z.string().optional(),
  roots: z.array(z.string()).optional(),
  maxDepth: z.number().int().min(1).max(10).optional(),
  timeout: z.number().int().min(1000).max(120000).optional(),
});

/**
 * Create the Discovery router with the SSE scan endpoint.
 *
 * @param meshCore - MeshCore instance for delegating discovery scans
 */
export function createDiscoveryRouter(meshCore: MeshCore): Router {
  const router = Router();

  router.post('/scan', async (req, res) => {
    const data = parseBody(ScanRequestSchema, req.body, res);
    if (!data) return;

    // Default to boundary (home dir) instead of DEFAULT_CWD
    const roots =
      data.roots && data.roots.length > 0 ? data.roots : data.root ? [data.root] : [getBoundary()];

    // Validate each root against boundary
    for (const root of roots) {
      const withinBoundary = await isWithinBoundary(root);
      if (!withinBoundary) {
        return res.status(403).json({ error: `Root path outside directory boundary` });
      }
    }

    // Set up SSE stream
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      for await (const event of meshCore.discover(roots, {
        maxDepth: data.maxDepth,
        timeout: data.timeout,
      })) {
        if (res.writableEnded) break;
        // Filter auto-import events (internal to mesh)
        if (event.type === 'auto-import') continue;
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      }
    } catch (err) {
      if (!res.writableEnded) {
        const message = err instanceof Error ? err.message : 'Scan failed';
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  return router;
}
