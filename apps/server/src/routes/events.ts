/**
 * Unified SSE event stream endpoint.
 *
 * Provides a single multiplexed SSE connection for all real-time events.
 * Clients filter by the SSE `event:` field rather than opening per-resource connections.
 *
 * @module routes/events
 */
import { Router } from 'express';
import { SSE } from '../config/constants.js';
import { initSSEStream } from '../services/core/stream-adapter.js';
import { eventFanOut } from '../services/core/event-fan-out.js';

const router = Router();

/** GET / — Open a unified SSE stream for all real-time events. */
router.get('/', (req, res) => {
  // Register with fan-out BEFORE sending SSE headers to avoid
  // writing 200 headers then failing with 503 when max clients exceeded.
  const unsubscribe = eventFanOut.addClient(res);
  if (res.writableEnded) return;

  initSSEStream(res);

  // Send initial connected event
  res.write(
    `event: connected\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`
  );

  // Keepalive heartbeat to prevent proxies/browsers from closing the connection
  const heartbeat = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeat);
      return;
    }
    try {
      res.write('event: heartbeat\ndata: \n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, SSE.HEARTBEAT_INTERVAL_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;
