import { Router } from 'express';
import { runtimeRegistry } from '../services/core/runtime-registry.js';

const router = Router();

/**
 * GET /api/capabilities — returns capabilities for all registered runtimes.
 *
 * Response shape: `{ capabilities: Record<string, RuntimeCapabilities>, defaultRuntime: string }`
 */
router.get('/', (_req, res) => {
  const capabilities = runtimeRegistry.getAllCapabilities();
  const defaultRuntime = runtimeRegistry.getDefaultType();
  res.json({ capabilities, defaultRuntime });
});

export default router;
