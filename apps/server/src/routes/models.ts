import { Router } from 'express';
import { runtimeRegistry } from '../services/core/runtime-registry.js';

const router = Router();

/** GET /api/models — list available Claude models. */
router.get('/', async (_req, res) => {
  const runtime = runtimeRegistry.getDefault();
  const models = await runtime.getSupportedModels();
  res.json({ models });
});

export default router;
