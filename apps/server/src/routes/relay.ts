/**
 * Relay message bus routes — send messages, manage endpoints, query inbox, SSE stream.
 *
 * @module routes/relay
 */
import { Router } from 'express';
import type { RelayCore } from '@dorkos/relay';
import {
  SendMessageRequestSchema,
  MessageListQuerySchema,
  InboxQuerySchema,
  EndpointRegistrationSchema,
} from '@dorkos/shared/relay-schemas';
import { initSSEStream } from '../services/stream-adapter.js';

/**
 * Create the Relay router with message and endpoint management endpoints.
 *
 * @param relayCore - The RelayCore instance for message bus operations
 */
export function createRelayRouter(relayCore: RelayCore): Router {
  const router = Router();

  // POST /messages — Send a message
  router.post('/messages', async (req, res) => {
    const result = SendMessageRequestSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }
    try {
      const publishResult = await relayCore.publish(result.data.subject, result.data.payload, {
        from: result.data.from,
        replyTo: result.data.replyTo,
        budget: result.data.budget,
      });
      return res.json(publishResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publish failed';
      return res
        .status(422)
        .json({ error: message, code: (err as Error & { code?: string })?.code ?? 'PUBLISH_FAILED' });
    }
  });

  // GET /messages — List with filters and cursor pagination
  router.get('/messages', (_req, res) => {
    const result = MessageListQuerySchema.safeParse(_req.query);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }
    const messages = relayCore.listMessages(result.data);
    return res.json(messages);
  });

  // GET /messages/:id — Get single message
  router.get('/messages/:id', (_req, res) => {
    const message = relayCore.getMessage(_req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    return res.json(message);
  });

  // GET /endpoints — List registered endpoints
  router.get('/endpoints', (_req, res) => {
    const endpoints = relayCore.listEndpoints();
    return res.json(endpoints);
  });

  // POST /endpoints — Register an endpoint
  router.post('/endpoints', async (req, res) => {
    const result = EndpointRegistrationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }
    try {
      const endpoint = await relayCore.registerEndpoint(result.data.subject);
      return res.status(201).json(endpoint);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      return res.status(422).json({ error: message });
    }
  });

  // DELETE /endpoints/:subject — Unregister endpoint
  router.delete('/endpoints/:subject', async (req, res) => {
    const removed = await relayCore.unregisterEndpoint(req.params.subject);
    if (!removed) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    return res.json({ success: true });
  });

  // GET /endpoints/:subject/inbox — Read inbox for a specific endpoint
  router.get('/endpoints/:subject/inbox', (_req, res) => {
    const result = InboxQuerySchema.safeParse(_req.query);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }
    try {
      const messages = relayCore.readInbox(_req.params.subject, result.data);
      return res.json(messages);
    } catch (err) {
      if ((err as Error & { code?: string })?.code === 'ENDPOINT_NOT_FOUND') {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      throw err;
    }
  });

  // GET /dead-letters — List dead-letter messages
  router.get('/dead-letters', async (_req, res) => {
    const endpointHash = _req.query.endpointHash as string | undefined;
    const deadLetters = await relayCore.getDeadLetters(
      endpointHash ? { endpointHash } : undefined,
    );
    return res.json(deadLetters);
  });

  // GET /metrics — Relay system metrics
  router.get('/metrics', (_req, res) => {
    const metrics = relayCore.getMetrics();
    return res.json(metrics);
  });

  // GET /stream — SSE event stream with server-side subject filtering
  router.get('/stream', (req, res) => {
    const pattern = (req.query.subject as string) || '>';

    initSSEStream(res);

    // Send connected event
    res.write(`event: relay_connected\n`);
    res.write(`data: ${JSON.stringify({ pattern, connectedAt: new Date().toISOString() })}\n\n`);

    // Subscribe to messages matching pattern
    const unsubMessages = relayCore.subscribe(pattern, (envelope) => {
      res.write(`id: ${envelope.id}\n`);
      res.write(`event: relay_message\n`);
      res.write(`data: ${JSON.stringify(envelope)}\n\n`);
    });

    // Subscribe to signals (dead letters, backpressure)
    const unsubSignals = relayCore.onSignal(pattern, (_subject, signal) => {
      const eventType = signal.type === 'backpressure' ? 'relay_backpressure' : 'relay_signal';
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(signal)}\n\n`);
    });

    // Keepalive every 15 seconds
    const keepalive = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, 15_000);

    // Cleanup on connection close
    req.on('close', () => {
      clearInterval(keepalive);
      unsubMessages();
      unsubSignals();
    });
  });

  return router;
}
