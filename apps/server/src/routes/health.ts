import { Router } from 'express';
import { createRequire } from 'module';
import { tunnelManager } from '../services/tunnel-manager.js';

const require = createRequire(import.meta.url);
const { version: SERVER_VERSION } = require('../../package.json') as { version: string };

const router = Router();

router.get('/', (_req, res) => {
  const response: Record<string, unknown> = {
    status: 'ok',
    version: SERVER_VERSION,
    uptime: process.uptime(),
  };

  const tunnelStatus = tunnelManager.status;
  if (tunnelStatus.enabled) {
    response.tunnel = {
      connected: tunnelStatus.connected,
      url: tunnelStatus.url,
      port: tunnelStatus.port,
      startedAt: tunnelStatus.startedAt,
    };
  }

  res.json(response);
});

export default router;
