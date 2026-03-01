import { Router } from 'express';
import { CommandRegistryService } from '../services/core/command-registry.js';
import { CommandsQuerySchema } from '@dorkos/shared/schemas';
import { validateBoundary, BoundaryError } from '../lib/boundary.js';
import { DEFAULT_CWD } from '../lib/resolve-root.js';

const defaultRoot = DEFAULT_CWD;
const MAX_REGISTRY_CACHE_SIZE = 50;
const registryCache = new Map<string, CommandRegistryService>();

function getRegistry(cwd?: string): CommandRegistryService {
  const root = cwd || defaultRoot;
  let registry = registryCache.get(root);
  if (!registry) {
    // Evict oldest entry if cache is full
    if (registryCache.size >= MAX_REGISTRY_CACHE_SIZE) {
      const oldest = registryCache.keys().next().value!;
      registryCache.delete(oldest);
    }
    registry = new CommandRegistryService(root);
    registryCache.set(root, registry);
  }
  return registry;
}

const router = Router();

// GET /api/commands - List all commands (with optional refresh and cwd)
router.get('/', async (req, res) => {
  const parsed = CommandsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.format() });
  }
  const refresh = parsed.data.refresh === 'true';
  try {
    let validatedCwd: string | undefined;
    if (parsed.data.cwd) {
      validatedCwd = await validateBoundary(parsed.data.cwd);
    }
    const registry = getRegistry(validatedCwd);
    const commands = await registry.getCommands(refresh);
    res.json(commands);
  } catch (err) {
    if (err instanceof BoundaryError) {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    throw err;
  }
});

export default router;
