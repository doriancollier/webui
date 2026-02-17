/**
 * Tunnel route — POST endpoints to start and stop the ngrok tunnel.
 *
 * @module routes/tunnel
 */
import { Router } from 'express';
import { tunnelManager } from '../services/tunnel-manager.js';
import { configManager } from '../services/config-manager.js';

const router = Router();

router.post('/start', async (_req, res) => {
  try {
    // Resolve auth token: env var first, then config fallback
    const authtoken =
      process.env.NGROK_AUTHTOKEN || configManager.get('tunnel')?.authtoken;
    if (!authtoken) {
      return res.status(400).json({ error: 'No ngrok auth token configured' });
    }

    const port =
      Number(process.env.TUNNEL_PORT) ||
      Number(process.env.DORKOS_PORT) ||
      4242;
    const tunnelConfig = configManager.get('tunnel');
    const config = {
      port,
      authtoken,
      domain: tunnelConfig?.domain ?? undefined,
      basicAuth: tunnelConfig?.auth ?? undefined,
    };

    await tunnelManager.start(config);

    // Persist enabled state
    configManager.set('tunnel', { ...tunnelConfig, enabled: true });

    return res.json({ url: tunnelManager.status.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to start tunnel';
    return res.status(500).json({ error: message });
  }
});

router.post('/stop', async (_req, res) => {
  try {
    await tunnelManager.stop();

    // Persist disabled state
    const tunnelConfig = configManager.get('tunnel');
    configManager.set('tunnel', { ...tunnelConfig, enabled: false });

    return res.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to stop tunnel';
    return res.status(500).json({ error: message });
  }
});

export default router;
