import chokidar, { type FSWatcher } from 'chokidar';
import { join } from 'path';
import type { Response } from 'express';
import type { StreamEvent } from '@dorkos/shared/types';
import type { TranscriptReader } from './transcript-reader.js';
import { SSE, WATCHER } from '../../../config/constants.js';
import { logger } from '../../../lib/logger.js';
import type { RelayCore } from '@dorkos/relay';

/** Unsubscribe function returned by RelayCore.subscribe(). */
type Unsubscribe = () => void;

/** Callback-based listener entry for session changes. */
interface CallbackEntry {
  callback: (event: StreamEvent) => void;
  sessionId: string;
  vaultRoot: string;
}

/**
 * SessionBroadcaster manages file watching and SSE broadcasting for cross-client session sync.
 *
 * Watches SDK JSONL transcript files and broadcasts updates to connected SSE clients when
 * file changes are detected. Supports multiple clients per session with automatic cleanup.
 *
 * Usage:
 * ```typescript
 * const broadcaster = new SessionBroadcaster(transcriptReader);
 *
 * // Register SSE client for a session
 * app.get('/api/sessions/:id/sync', (req, res) => {
 *   res.setHeader('Content-Type', 'text/event-stream');
 *   broadcaster.registerClient(req.params.id, vaultRoot, res);
 * });
 *
 * // Cleanup on shutdown
 * process.on('SIGTERM', () => broadcaster.shutdown());
 * ```
 */
export class SessionBroadcaster {
  private clients = new Map<string, Set<Response>>();
  private callbacks = new Map<string, CallbackEntry>();
  private watchers = new Map<string, FSWatcher>();
  private offsets = new Map<string, number>();
  private offsetInitializing = new Set<string>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private relaySubscriptions = new Map<Response, Unsubscribe>();
  private callbackRelayUnsubs = new Map<string, Unsubscribe>();
  private relay: RelayCore | null = null;
  private totalClientCount = 0;

  constructor(private transcriptReader: TranscriptReader) {}

  /**
   * Get the number of connected SSE clients.
   *
   * @param sessionId - If provided, returns count for that session only. Otherwise returns global total.
   */
  getClientCount(sessionId?: string): number {
    if (sessionId) {
      return this.clients.get(sessionId)?.size ?? 0;
    }
    return this.totalClientCount;
  }

  /**
   * Set the RelayCore instance for relay subscription fan-in.
   *
   * When set, SSE clients that provide a clientId will automatically
   * receive relay messages published to `relay.human.console.{clientId}`.
   *
   * @param relay - The RelayCore instance
   */
  setRelay(relay: RelayCore): void {
    this.relay = relay;
  }

  /**
   * Register an SSE client for a session.
   *
   * - Adds the response to the set of connected clients
   * - Starts a file watcher if none exists for this session
   * - Initializes offset to current file size (only broadcast new content)
   * - Sends sync_connected event to the client
   * - If relay is set and clientId is provided, subscribes to relay messages
   * - Auto-deregisters on response close
   *
   * @param sessionId - Session UUID
   * @param vaultRoot - Vault root path for resolving transcript directory
   * @param res - Express Response object configured for SSE
   * @param clientId - Optional client identifier for relay subscription
   */
  registerClient(sessionId: string, vaultRoot: string, res: Response, clientId?: string): void {
    // Enforce global SSE connection limit
    if (this.totalClientCount >= SSE.MAX_TOTAL_CLIENTS) {
      res.status(503).json({ error: 'SSE connection limit reached', code: 'SSE_LIMIT' });
      return;
    }

    // Enforce per-session SSE connection limit
    const sessionClients = this.clients.get(sessionId);
    if (sessionClients && sessionClients.size >= SSE.MAX_CLIENTS_PER_SESSION) {
      res.status(503).json({ error: 'Too many connections for this session', code: 'SSE_SESSION_LIMIT' });
      return;
    }

    // Add client to set
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }
    this.clients.get(sessionId)!.add(res);
    this.totalClientCount++;

    // Start watcher if this is the first client for this session
    if (!this.watchers.has(sessionId)) {
      this.startWatcher(sessionId, vaultRoot);
    }

    // Subscribe to relay messages for this client
    if (this.relay && clientId) {
      this.subscribeToRelay(res, clientId);
    }

    // Send sync_connected event
    res.write(`event: sync_connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);

    // Signal to client that relay subscription is active and ready to receive.
    // Sent after sync_connected so clients can rely on ordering.
    if (this.relay && clientId) {
      res.write(`event: stream_ready\ndata: ${JSON.stringify({ clientId })}\n\n`);
    }

    // Auto-deregister on close
    res.on('close', () => {
      this.deregisterClient(sessionId, res);
    });
  }

  /**
   * Register a callback-based listener for session changes.
   * Returns an unsubscribe function.
   * Used by ClaudeCodeRuntime.watchSession() to satisfy the AgentRuntime interface.
   *
   * @param sessionId - Session UUID to watch
   * @param vaultRoot - Vault root path for resolving transcript directory
   * @param callback - Called with each new stream event
   * @param clientId - Optional client identifier (auto-generated if omitted)
   * @returns Unsubscribe function — call to stop watching
   */
  registerCallback(
    sessionId: string,
    vaultRoot: string,
    callback: (event: StreamEvent) => void,
    clientId?: string
  ): () => void {
    const id = clientId ?? `cb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.callbacks.set(id, { callback, sessionId, vaultRoot });

    // Start watcher if this is the first listener (SSE or callback) for this session
    if (!this.watchers.has(sessionId)) {
      this.startWatcher(sessionId, vaultRoot);
    }

    // Subscribe to relay messages if relay is set and clientId is provided
    if (this.relay && clientId) {
      const subject = `relay.human.console.${clientId}`;
      const relayUnsub = this.relay.subscribe(subject, (envelope) => {
        callback({
          type: 'relay_message',
          data: {
            messageId: (envelope as Record<string, unknown>).id,
            payload: (envelope as Record<string, unknown>).payload,
            subject: (envelope as Record<string, unknown>).subject,
          },
        } as StreamEvent);
      });
      this.callbackRelayUnsubs.set(id, relayUnsub);
    }

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(id);

      // Clean up relay subscription for this callback
      const relayUnsub = this.callbackRelayUnsubs.get(id);
      if (relayUnsub) {
        relayUnsub();
        this.callbackRelayUnsubs.delete(id);
      }

      // Stop watcher if no more listeners (SSE clients OR callbacks) for this session
      const hasSSEClients = (this.clients.get(sessionId)?.size ?? 0) > 0;
      const hasCallbacks = Array.from(this.callbacks.values()).some(
        (entry) => entry.sessionId === sessionId
      );

      if (!hasSSEClients && !hasCallbacks) {
        const watcher = this.watchers.get(sessionId);
        if (watcher) {
          watcher.close();
          this.watchers.delete(sessionId);
        }
        this.offsets.delete(sessionId);
        this.offsetInitializing.delete(sessionId);
        const timer = this.debounceTimers.get(sessionId);
        if (timer) {
          clearTimeout(timer);
          this.debounceTimers.delete(sessionId);
        }
      }
    };
  }

  /**
   * Deregister an SSE client from a session.
   *
   * - Removes the response from the client set
   * - Stops the file watcher if no clients remain for this session
   * - Cleans up offsets and timers
   *
   * @param sessionId - Session UUID
   * @param res - Express Response object to remove
   */
  deregisterClient(sessionId: string, res: Response): void {
    // Clean up relay subscription for this client
    this.unsubscribeFromRelay(res);

    const clientSet = this.clients.get(sessionId);
    if (!clientSet) return;

    if (clientSet.has(res)) {
      this.totalClientCount--;
    }
    clientSet.delete(res);

    // Clean up if no SSE clients remain
    if (clientSet.size === 0) {
      this.clients.delete(sessionId);

      // Only stop watcher if no callbacks remain for this session
      const hasCallbacks = Array.from(this.callbacks.values()).some(
        (entry) => entry.sessionId === sessionId
      );

      if (!hasCallbacks) {
        // Stop watcher
        const watcher = this.watchers.get(sessionId);
        if (watcher) {
          watcher.close();
          this.watchers.delete(sessionId);
        }

        // Clean up state
        this.offsets.delete(sessionId);
        this.offsetInitializing.delete(sessionId);

        const timer = this.debounceTimers.get(sessionId);
        if (timer) {
          clearTimeout(timer);
          this.debounceTimers.delete(sessionId);
        }
      }
    }
  }

  /**
   * Subscribe an SSE client to relay messages on `relay.human.console.{clientId}`.
   *
   * Incoming relay envelopes are forwarded as SSE `relay_message` events.
   *
   * @param res - The SSE response to write relay events to
   * @param clientId - Client identifier used to build the relay subject
   */
  private subscribeToRelay(res: Response, clientId: string): void {
    const subject = `relay.human.console.${clientId}`;
    let writing = false;
    const queue: string[] = [];
    let unsubFn: (() => void) | null = null;

    const flush = async () => {
      if (writing) return;
      writing = true;
      while (queue.length > 0) {
        const data = queue.shift()!;
        // Detect done events in the SSE payload for tracing purposes
        const isDoneWrite = data.includes('"type":"done"');
        if (isDoneWrite) {
          logger.debug('[SSE] done event writing to stream for client %s', clientId);
        }
        try {
          const ok = res.write(data);
          if (!ok) {
            await new Promise<void>((resolve) => res.once('drain', resolve));
          }
          if (isDoneWrite) {
            logger.debug('[SSE] done event written to stream for client %s', clientId);
          }
        } catch (err) {
          if (isDoneWrite) {
            logger.warn(
              '[SSE] done event write FAILED for client %s: %s',
              clientId,
              (err as Error).message
            );
          }
          logger.error('[SessionBroadcaster] Write error, unsubscribing relay:', err);
          // Clean up the relay subscription — no more events should queue
          if (unsubFn) {
            unsubFn();
            unsubFn = null;
          }
          this.relaySubscriptions.delete(res);
          queue.length = 0; // Discard remaining queued events
          break;
        }
      }
      writing = false;
    };

    unsubFn = this.relay!.subscribe(subject, (envelope) => {
      const payload = envelope.payload as Record<string, unknown> | null | undefined;
      const isDone = typeof payload === 'object' && payload !== null && payload['type'] === 'done';
      const correlationId =
        typeof payload === 'object' && payload !== null
          ? (payload['correlationId'] as string | undefined)
          : undefined;

      if (isDone) {
        logger.debug('[SSE] done event queued for client %s', clientId);
      }

      const eventData = `event: relay_message\ndata: ${JSON.stringify({
        messageId: envelope.id,
        payload: envelope.payload,
        subject: envelope.subject,
        ...(correlationId ? { correlationId } : {}),
      })}\n\n`;
      queue.push(eventData);
      void flush();
    });

    this.relaySubscriptions.set(res, unsubFn);
  }

  /**
   * Unsubscribe an SSE client from its relay subject.
   *
   * @param res - The SSE response to unsubscribe
   */
  private unsubscribeFromRelay(res: Response): void {
    const unsub = this.relaySubscriptions.get(res);
    if (unsub) {
      unsub();
      this.relaySubscriptions.delete(res);
    }
  }

  /**
   * Start a chokidar file watcher for a session's JSONL transcript.
   *
   * Watches the SDK transcript file and broadcasts updates on change events.
   * Changes are debounced (100ms) to batch rapid writes during streaming.
   *
   * @param sessionId - Session UUID
   * @param vaultRoot - Vault root path for resolving transcript directory
   */
  private startWatcher(sessionId: string, vaultRoot: string): void {
    const transcriptsDir = this.transcriptReader.getTranscriptsDir(vaultRoot);
    const filePath = join(transcriptsDir, `${sessionId}.jsonl`);

    // Initialize offset to current file size (only new content).
    // Mark as initializing so broadcastUpdate skips events until the offset is resolved.
    this.offsetInitializing.add(sessionId);
    this.initializeOffset(vaultRoot, sessionId).finally(() => {
      this.offsetInitializing.delete(sessionId);
    });

    // Create watcher
    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true, // Don't fire for initial file scan
      awaitWriteFinish: {
        stabilityThreshold: WATCHER.STABILITY_THRESHOLD_MS,
        pollInterval: WATCHER.POLL_INTERVAL_MS,
      },
    });

    watcher.on('change', () => {
      // Debounce rapid changes
      const existingTimer = this.debounceTimers.get(sessionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.debounceTimers.delete(sessionId);
        this.broadcastUpdate(sessionId, vaultRoot).catch((err) => {
          logger.error(
            `[SessionBroadcaster] Failed to broadcast update for session ${sessionId}:`,
            err
          );
        });
      }, WATCHER.DEBOUNCE_MS);

      this.debounceTimers.set(sessionId, timer);
    });

    this.watchers.set(sessionId, watcher);
  }

  /**
   * Initialize the byte offset for a session to the current file size.
   * This ensures we only broadcast new content, not existing history.
   *
   * @param vaultRoot - Vault root path
   * @param sessionId - Session UUID
   */
  private async initializeOffset(vaultRoot: string, sessionId: string): Promise<void> {
    try {
      const { newOffset } = await this.transcriptReader.readFromOffset(vaultRoot, sessionId, 0);
      this.offsets.set(sessionId, newOffset);
    } catch (_err) {
      // File may not exist yet, start at 0
      this.offsets.set(sessionId, 0);
    }
  }

  /**
   * Broadcast a sync_update event to all connected clients for a session.
   *
   * Reads new content from the transcript file since the last offset and
   * sends a sync_update SSE event if new content exists.
   *
   * @param sessionId - Session UUID
   * @param vaultRoot - Vault root path
   */
  private async broadcastUpdate(sessionId: string, vaultRoot: string): Promise<void> {
    // Skip broadcast while offset initialization is in progress to avoid
    // replaying the entire file as a "new" update on first connection.
    if (this.offsetInitializing.has(sessionId)) return;

    const currentOffset = this.offsets.get(sessionId) ?? 0;

    try {
      const { content, newOffset } = await this.transcriptReader.readFromOffset(
        vaultRoot,
        sessionId,
        currentOffset
      );

      // Update offset
      this.offsets.set(sessionId, newOffset);

      // Only broadcast if there's new content
      if (content.length === 0) {
        return;
      }

      // Check if there are any listeners (SSE clients or callbacks)
      const clientSet = this.clients.get(sessionId);
      const hasCallbacks = Array.from(this.callbacks.values()).some(
        (entry) => entry.sessionId === sessionId
      );
      if ((!clientSet || clientSet.size === 0) && !hasCallbacks) {
        return;
      }

      const event = {
        sessionId,
        timestamp: new Date().toISOString(),
      };

      const eventData = `event: sync_update\ndata: ${JSON.stringify(event)}\n\n`;

      // Send to SSE clients
      if (clientSet) {
        for (const client of Array.from(clientSet)) {
          try {
            const ok = client.write(eventData);
            if (!ok) {
              await new Promise<void>((resolve) => client.once('drain', resolve));
            }
          } catch (err) {
            // Client may have disconnected, will be cleaned up on 'close' event
            logger.error(
              `[SessionBroadcaster] Failed to write to client for session ${sessionId}:`,
              err
            );
          }
        }
      }

      // Invoke registered callbacks for this session
      for (const [, entry] of this.callbacks) {
        if (entry.sessionId === sessionId) {
          try {
            entry.callback({
              type: 'sync_update',
              data: { sessionId, timestamp: new Date().toISOString() },
            } as StreamEvent);
          } catch (err) {
            logger.error(
              `[SessionBroadcaster] Callback error for session ${sessionId}:`,
              err
            );
          }
        }
      }
    } catch (err) {
      logger.error(`[SessionBroadcaster] Failed to read offset for session ${sessionId}:`, err);
    }
  }

  /**
   * Shutdown the broadcaster, closing all watchers and client connections.
   * Should be called on server shutdown.
   */
  shutdown(): void {
    // Clear all timers
    Array.from(this.debounceTimers.values()).forEach((timer) => {
      clearTimeout(timer);
    });
    this.debounceTimers.clear();

    // Close all watchers
    Array.from(this.watchers.values()).forEach((watcher) => {
      watcher.close();
    });
    this.watchers.clear();

    // Unsubscribe all relay subscriptions
    for (const unsub of this.relaySubscriptions.values()) {
      unsub();
    }
    this.relaySubscriptions.clear();

    // Unsubscribe all callback relay subscriptions
    for (const unsub of this.callbackRelayUnsubs.values()) {
      unsub();
    }
    this.callbackRelayUnsubs.clear();

    // Clear all callbacks
    this.callbacks.clear();

    // End all client responses
    Array.from(this.clients.values()).forEach((clientSet) => {
      Array.from(clientSet).forEach((client) => {
        try {
          client.end();
        } catch {
          // Ignore errors on close
        }
      });
    });
    this.clients.clear();
    this.totalClientCount = 0;

    // Clear offsets
    this.offsets.clear();
    this.offsetInitializing.clear();
  }
}
