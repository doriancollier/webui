import { Router } from 'express';
import { tunnelManager } from '../services/core/tunnel-manager.js';
import { SERVER_VERSION } from '../lib/version.js';

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
