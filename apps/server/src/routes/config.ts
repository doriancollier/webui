import { Router } from 'express';
import { createRequire } from 'module';
import { tunnelManager } from '../services/tunnel-manager.js';
import { resolveClaudeCliPath } from '../services/agent-manager.js';
import { DEFAULT_PORT } from '@dorkos/shared/constants';

const require = createRequire(import.meta.url);
const { version: SERVER_VERSION } = require('../../package.json') as { version: string };

const router = Router();

router.get('/', (_req, res) => {
  let claudeCliPath: string | null = null;
  try {
    claudeCliPath = resolveClaudeCliPath() ?? null;
  } catch {
    // CLI path resolution can fail — fallback to null
  }

  const tunnel = tunnelManager.status;

  res.json({
    version: SERVER_VERSION,
    port: parseInt(process.env.DORKOS_PORT || String(DEFAULT_PORT), 10),
    uptime: process.uptime(),
    workingDirectory: process.cwd(),
    nodeVersion: process.version,
    claudeCliPath,
    tunnel: {
      enabled: tunnel.enabled,
      connected: tunnel.connected,
      url: tunnel.url,
      authEnabled: !!process.env.TUNNEL_AUTH,
      tokenConfigured: !!process.env.NGROK_AUTHTOKEN,
    },
  });
});

export default router;
