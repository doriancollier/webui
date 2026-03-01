import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { agentManager } from '../services/core/agent-manager.js';
import { transcriptReader } from '../services/session/transcript-reader.js';
import { initSSEStream, sendSSEEvent, endSSEStream } from '../services/core/stream-adapter.js';
import {
  CreateSessionRequestSchema,
  UpdateSessionRequestSchema,
  SendMessageRequestSchema,
  ApprovalRequestSchema,
  SubmitAnswersRequestSchema,
  ListSessionsQuerySchema,
} from '@dorkos/shared/schemas';
import { assertBoundary } from '../lib/route-utils.js';
import { isRelayEnabled } from '../services/relay/relay-state.js';
import type { RelayCore } from '@dorkos/relay';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vaultRoot = path.resolve(__dirname, '../../../../');

const router = Router();

// POST /api/sessions - Create new session
// Sends an initial message to the SDK to generate the session JSONL file,
// then returns the session metadata.
router.post('/', async (req, res) => {
  const parsed = CreateSessionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.format() });
  }
  const { permissionMode = 'default', cwd } = parsed.data;

  if (!(await assertBoundary(cwd, res))) return;

  // Use SDK's query() with a no-op prompt to establish the session.
  // The SDK will create the JSONL file and assign a session ID.
  // We need to send a real first message, so we'll just create an in-memory
  // session entry and let the first POST /messages call create the JSONL.
  const sessionId = crypto.randomUUID();
  agentManager.ensureSession(sessionId, { permissionMode, cwd });

  res.json({
    id: sessionId,
    title: `New Session`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    permissionMode,
    cwd,
  });
});

// GET /api/sessions - List all sessions from SDK transcripts
router.get('/', async (req, res) => {
  const parsed = ListSessionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.format() });
  }
  const { limit, cwd } = parsed.data;
  if (!(await assertBoundary(cwd, res))) return;

  const projectDir = cwd || vaultRoot;
  const sessions = await transcriptReader.listSessions(projectDir);
  res.json(sessions.slice(0, limit));
});

// GET /api/sessions/:id - Get session details
router.get('/:id', async (req, res) => {
  const cwd = (req.query.cwd as string) || undefined;
  if (!(await assertBoundary(cwd, res))) return;

  const projectDir = cwd || vaultRoot;
  const session = await transcriptReader.getSession(projectDir, req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// GET /api/sessions/:id/tasks - Get task state from SDK transcript
router.get('/:id/tasks', async (req, res) => {
  const cwdParam = (req.query.cwd as string) || undefined;

  if (!(await assertBoundary(cwdParam, res))) return;

  const cwd = cwdParam || vaultRoot;

  const etag = await transcriptReader.getTranscriptETag(cwd, req.params.id);
  if (etag) {
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
  }

  try {
    const tasks = await transcriptReader.readTasks(cwd, req.params.id);
    res.json({ tasks });
  } catch {
    res.status(404).json({ error: 'Session not found' });
  }
});

// GET /api/sessions/:id/messages - Get message history from SDK transcript
router.get('/:id/messages', async (req, res) => {
  const cwdParam = (req.query.cwd as string) || undefined;

  if (!(await assertBoundary(cwdParam, res))) return;

  const cwd = cwdParam || vaultRoot;

  const etag = await transcriptReader.getTranscriptETag(cwd, req.params.id);
  if (etag) {
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
  }

  const messages = await transcriptReader.readTranscript(cwd, req.params.id);
  res.json({ messages });
});

// PATCH /api/sessions/:id - Update session settings
router.patch('/:id', async (req, res) => {
  const parsed = UpdateSessionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.format() });
  }
  const { permissionMode, model } = parsed.data;
  const updated = agentManager.updateSession(req.params.id, { permissionMode, model });
  if (!updated) return res.status(404).json({ error: 'Session not found' });

  const cwd = (req.query.cwd as string) || vaultRoot;
  const session = await transcriptReader.getSession(cwd, req.params.id);
  if (session) {
    session.permissionMode = permissionMode ?? session.permissionMode;
    session.model = model ?? session.model;
  }
  res.json(session ?? { id: req.params.id, permissionMode, model });
});

/**
 * Publish a user message to the Relay bus and return a 202 receipt.
 *
 * Registers a console endpoint for the client, publishes the message
 * to `relay.agent.{sessionId}`, and returns the publish receipt.
 *
 * @param relayCore - The RelayCore instance
 * @param sessionId - Target session UUID
 * @param clientId - Client identifier (from X-Client-Id header)
 * @param content - User message text
 * @param cwd - Optional working directory
 */
async function publishViaRelay(
  relayCore: RelayCore,
  sessionId: string,
  clientId: string,
  content: string,
  cwd?: string,
): Promise<{ messageId: string; traceId: string }> {
  const consoleEndpoint = `relay.human.console.${clientId}`;

  // Register the console endpoint (idempotent — catch duplicate registration)
  try {
    await relayCore.registerEndpoint(consoleEndpoint);
  } catch (err) {
    // Only ignore "already registered" — log real failures
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('already registered')) {
      console.error('publishViaRelay: failed to register console endpoint:', message);
    }
  }

  const publishResult = await relayCore.publish(
    `relay.agent.${sessionId}`,
    { content, cwd },
    {
      from: consoleEndpoint,
      replyTo: consoleEndpoint,
      budget: {
        maxHops: 5,
        ttl: Date.now() + 300_000,
        callBudgetRemaining: 10,
      },
    },
  );

  return {
    messageId: publishResult.messageId,
    traceId: publishResult.messageId,
  };
}

// POST /api/sessions/:id/messages - Send message (SSE stream or Relay 202 receipt)
router.post('/:id/messages', async (req, res) => {
  const parsed = SendMessageRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.format() });
  }
  const { content, cwd } = parsed.data;

  const sessionId = req.params.id;

  // Read X-Client-Id header, or generate UUID if missing
  const clientId = (req.headers['x-client-id'] as string) || crypto.randomUUID();

  // Acquire lock before processing
  const lockAcquired = agentManager.acquireLock(sessionId, clientId, res);
  if (!lockAcquired) {
    const lockInfo = agentManager.getLockInfo(sessionId);
    return res.status(409).json({
      error: 'Session locked',
      code: 'SESSION_LOCKED',
      lockedBy: lockInfo?.clientId ?? 'unknown',
      lockedAt: lockInfo ? new Date(lockInfo.acquiredAt).toISOString() : new Date().toISOString(),
    });
  }

  // Relay path: publish to message bus and return 202 receipt
  const relayCore = req.app.locals.relayCore as RelayCore | undefined;
  if (isRelayEnabled() && relayCore) {
    try {
      const receipt = await publishViaRelay(relayCore, sessionId, clientId, content, cwd);
      return res.status(202).json(receipt);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Relay publish failed';
      return res.status(500).json({ error: message });
    } finally {
      agentManager.releaseLock(sessionId, clientId);
    }
  }

  // Legacy path: stream SSE response on the POST connection
  // Idempotent lock release — ensures exactly one release regardless of close/finally ordering
  let lockReleased = false;
  const releaseLockOnce = () => {
    if (lockReleased) return;
    lockReleased = true;
    agentManager.releaseLock(sessionId, clientId);
  };

  // Guarantee lock release if client disconnects before try block
  res.on('close', releaseLockOnce);

  initSSEStream(res);

  try {
    for await (const event of agentManager.sendMessage(sessionId, content, { cwd })) {
      sendSSEEvent(res, event);

      // If SDK assigned a different session ID, track it
      if (event.type === 'done') {
        const actualSdkId = agentManager.getSdkSessionId(sessionId);
        if (actualSdkId && actualSdkId !== sessionId) {
          // Send a redirect hint so the client can update its session ID
          sendSSEEvent(res, {
            type: 'done',
            data: { sessionId: actualSdkId },
          });
        }
      }
    }
  } catch (err) {
    sendSSEEvent(res, {
      type: 'error',
      data: { message: err instanceof Error ? err.message : 'Unknown error' },
    });
  } finally {
    releaseLockOnce();
    endSSEStream(res);
  }
});

// POST /api/sessions/:id/approve - Approve pending tool call
router.post('/:id/approve', async (req, res) => {
  const parsed = ApprovalRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.format() });
  }
  const { toolCallId } = parsed.data;
  const approved = agentManager.approveTool(req.params.id, toolCallId, true);
  if (!approved) return res.status(404).json({ error: 'No pending approval' });
  res.json({ ok: true });
});

// POST /api/sessions/:id/deny - Deny pending tool call
router.post('/:id/deny', async (req, res) => {
  const parsed = ApprovalRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.format() });
  }
  const { toolCallId } = parsed.data;
  const denied = agentManager.approveTool(req.params.id, toolCallId, false);
  if (!denied) return res.status(404).json({ error: 'No pending approval' });
  res.json({ ok: true });
});

// POST /api/sessions/:id/submit-answers - Submit answers for AskUserQuestion
router.post('/:id/submit-answers', async (req, res) => {
  const parsed = SubmitAnswersRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.format() });
  }
  const { toolCallId, answers } = parsed.data;
  const ok = agentManager.submitAnswers(req.params.id, toolCallId, answers);
  if (!ok) return res.status(404).json({ error: 'No pending question' });
  res.json({ ok: true });
});

// GET /api/sessions/:id/stream - Persistent SSE connection for session sync
router.get('/:id/stream', (req, res) => {
  const sessionId = req.params.id;
  const cwd = (req.query.cwd as string) || vaultRoot;
  const clientId = req.query.clientId as string | undefined;
  const sessionBroadcaster = req.app.locals.sessionBroadcaster;

  initSSEStream(res);

  // Register with broadcaster (clientId enables relay subscription fan-in)
  sessionBroadcaster.registerClient(sessionId, cwd, res, clientId);

  // The broadcaster handles:
  // - Sending sync_connected event
  // - Auto-deregistering on disconnect (res.on('close'))
  // - Broadcasting sync_update events when JSONL changes
});

export default router;
