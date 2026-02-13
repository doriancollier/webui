import { Router } from 'express';
import { fileLister } from '../services/file-lister.js';
import { FileListQuerySchema } from '@lifeos/shared/schemas';

const router = Router();

router.get('/', async (req, res) => {
  const parsed = FileListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.format() });
  }
  const result = await fileLister.listFiles(parsed.data.cwd);
  res.json(result);
});

export default router;
