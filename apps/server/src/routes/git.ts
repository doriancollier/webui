import { Router } from 'express';
import { z } from 'zod';
import { getGitStatus } from '../services/git-status.js';

const router = Router();

const GitStatusQuerySchema = z.object({
  dir: z.string().optional(),
});

router.get('/status', async (req, res) => {
  const parsed = GitStatusQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.format() });
  }
  const cwd = parsed.data.dir || process.cwd();
  const result = await getGitStatus(cwd);
  res.json(result);
});

export default router;
