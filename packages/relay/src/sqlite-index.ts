/**
 * SQLite index derived from Maildir files for the Relay message bus.
 *
 * Provides fast structured queries (by subject, endpoint, status) on top
 * of the Maildir source-of-truth storage. The index is fully rebuildable
 * from Maildir files -- if it corrupts, call `rebuild()` to recreate it
 * from scratch.
 *
 * Follows the same better-sqlite3 patterns as `apps/server/src/services/pulse-store.ts`:
 * WAL mode, PRAGMA user_version migrations, prepared statements.
 *
 * @module relay/sqlite-index
 */
import Database from 'better-sqlite3';
import type { RelayMetrics } from './types.js';
import type { MaildirStore } from './maildir-store.js';

// === Types ===

/** Status of a message in the index. */
export type MessageStatus = 'new' | 'cur' | 'failed';

/** Raw row shape from the `messages` SQLite table (snake_case). */
interface MessageRow {
  id: string;
  subject: string;
  sender: string;
  endpoint_hash: string;
  status: string;
  created_at: string;
  ttl: number;
}

/** Mapped message record (camelCase). */
export interface IndexedMessage {
  id: string;
  subject: string;
  sender: string;
  endpointHash: string;
  status: MessageStatus;
  createdAt: string;
  ttl: number;
}

/** Options for creating a SqliteIndex. */
export interface SqliteIndexOptions {
  /** Absolute path to the SQLite database file (e.g. `~/.dork/relay/index.db`). */
  dbPath: string;
}

// === Migrations ===

const MIGRATIONS = [
  // Version 1: initial schema
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    sender TEXT NOT NULL,
    endpoint_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    ttl INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_subject ON messages(subject);
  CREATE INDEX IF NOT EXISTS idx_messages_endpoint_hash ON messages(endpoint_hash, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
  CREATE INDEX IF NOT EXISTS idx_messages_ttl ON messages(ttl);`,
];

// === SqliteIndex ===

/**
 * SQLite-based index for Relay messages.
 *
 * This is a derived index over Maildir files -- not the source of truth.
 * If the index becomes corrupted, call {@link rebuild} to recreate it
 * from the Maildir directories on disk.
 *
 * @example
 * ```ts
 * const index = new SqliteIndex({ dbPath: '/home/user/.dork/relay/index.db' });
 * index.insertMessage({
 *   id: '01JABC',
 *   subject: 'relay.agent.proj.backend',
 *   sender: 'relay.agent.proj.frontend',
 *   endpointHash: 'a1b2c3d4e5f6',
 *   status: 'new',
 *   createdAt: new Date().toISOString(),
 *   ttl: Date.now() + 60000,
 * });
 * const messages = index.getBySubject('relay.agent.proj.backend');
 * ```
 */
export class SqliteIndex {
  private readonly db: Database.Database;
  private readonly stmts: {
    insertMessage: Database.Statement;
    updateStatus: Database.Statement;
    getBySubject: Database.Statement;
    getByEndpoint: Database.Statement;
    deleteExpired: Database.Statement;
    deleteAll: Database.Statement;
    countByStatus: Database.Statement;
    countBySubject: Database.Statement;
    totalCount: Database.Statement;
    getMessage: Database.Statement;
  };

  constructor(options: SqliteIndexOptions) {
    this.db = new Database(options.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('foreign_keys = ON');

    this.runMigrations();

    this.stmts = {
      insertMessage: this.db.prepare(
        `INSERT OR REPLACE INTO messages (id, subject, sender, endpoint_hash, status, created_at, ttl)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ),
      updateStatus: this.db.prepare(
        `UPDATE messages SET status = ? WHERE id = ?`
      ),
      getBySubject: this.db.prepare(
        `SELECT * FROM messages WHERE subject = ? ORDER BY created_at DESC`
      ),
      getByEndpoint: this.db.prepare(
        `SELECT * FROM messages WHERE endpoint_hash = ? ORDER BY created_at DESC`
      ),
      deleteExpired: this.db.prepare(
        `DELETE FROM messages WHERE ttl < ?`
      ),
      deleteAll: this.db.prepare(
        `DELETE FROM messages`
      ),
      countByStatus: this.db.prepare(
        `SELECT status, COUNT(*) as count FROM messages GROUP BY status`
      ),
      countBySubject: this.db.prepare(
        `SELECT subject, COUNT(*) as count FROM messages GROUP BY subject ORDER BY count DESC`
      ),
      totalCount: this.db.prepare(
        `SELECT COUNT(*) as count FROM messages`
      ),
      getMessage: this.db.prepare(
        `SELECT * FROM messages WHERE id = ?`
      ),
    };
  }

  // --- Write Operations ---

  /**
   * Insert or replace a message in the index.
   *
   * Uses INSERT OR REPLACE so re-indexing is idempotent -- the same
   * message can be inserted multiple times without error.
   *
   * @param message - The indexed message record to insert.
   */
  insertMessage(message: IndexedMessage): void {
    this.stmts.insertMessage.run(
      message.id,
      message.subject,
      message.sender,
      message.endpointHash,
      message.status,
      message.createdAt,
      message.ttl,
    );
  }

  /**
   * Update the status of an existing message.
   *
   * @param id - The ULID of the message to update.
   * @param status - The new status (`new`, `cur`, or `failed`).
   * @returns `true` if a row was updated, `false` if the message was not found.
   */
  updateStatus(id: string, status: MessageStatus): boolean {
    const result = this.stmts.updateStatus.run(status, id);
    return result.changes > 0;
  }

  // --- Read Operations ---

  /**
   * Get a single message by ID.
   *
   * @param id - The ULID of the message.
   * @returns The indexed message, or `null` if not found.
   */
  getMessage(id: string): IndexedMessage | null {
    const row = this.stmts.getMessage.get(id) as MessageRow | undefined;
    return row ? mapMessageRow(row) : null;
  }

  /**
   * Get all messages for a given subject, ordered by creation time descending.
   *
   * @param subject - The message subject to query.
   * @returns An array of indexed messages matching the subject.
   */
  getBySubject(subject: string): IndexedMessage[] {
    const rows = this.stmts.getBySubject.all(subject) as MessageRow[];
    return rows.map(mapMessageRow);
  }

  /**
   * Get all messages for a given endpoint hash, ordered by creation time descending.
   *
   * @param endpointHash - The endpoint hash to query.
   * @returns An array of indexed messages for the endpoint.
   */
  getByEndpoint(endpointHash: string): IndexedMessage[] {
    const rows = this.stmts.getByEndpoint.all(endpointHash) as MessageRow[];
    return rows.map(mapMessageRow);
  }

  // --- Maintenance Operations ---

  /**
   * Delete all messages whose TTL has expired.
   *
   * Compares the stored TTL (Unix timestamp in ms) against the provided
   * current time. Messages with `ttl < now` are removed.
   *
   * @param now - Current time as Unix timestamp in milliseconds. Defaults to `Date.now()`.
   * @returns The number of expired messages deleted.
   */
  deleteExpired(now?: number): number {
    const timestamp = now ?? Date.now();
    const result = this.stmts.deleteExpired.run(timestamp);
    return result.changes;
  }

  /**
   * Rebuild the entire index from Maildir files on disk.
   *
   * Drops all existing data and re-scans every endpoint's Maildir
   * directories (`new/`, `cur/`, `failed/`), reading each envelope
   * JSON file and inserting it into the index.
   *
   * This is the "nuclear option" for index corruption recovery.
   *
   * @param maildirStore - The MaildirStore to read envelopes from.
   * @param endpointHashes - Map of endpoint hash to subject. Needed to
   *        associate Maildir directories with their subjects.
   * @returns The number of messages re-indexed.
   */
  async rebuild(
    maildirStore: MaildirStore,
    endpointHashes: Map<string, string>,
  ): Promise<number> {
    // Drop all existing data
    this.stmts.deleteAll.run();

    let count = 0;
    const subdirs = ['new', 'cur', 'failed'] as const;

    for (const [hash, subject] of endpointHashes) {
      // Suppress unused variable warning — subject is used for documentation clarity
      void subject;

      for (const subdir of subdirs) {
        const messageIds = await listMessageIds(maildirStore, hash, subdir);

        for (const messageId of messageIds) {
          const envelope = await maildirStore.readEnvelope(hash, subdir, messageId);
          if (!envelope) continue;

          // Use the Maildir filename ULID as the index ID (not envelope.id)
          // to stay consistent with how RelayCore indexes during normal operation.
          // In fan-out, one envelope goes to multiple endpoints — each gets a
          // unique filename ULID, so using it preserves per-delivery rows.
          this.insertMessage({
            id: messageId,
            subject: envelope.subject,
            sender: envelope.from,
            endpointHash: hash,
            status: subdir === 'failed' ? 'failed' : subdir === 'cur' ? 'cur' : 'new',
            createdAt: envelope.createdAt,
            ttl: envelope.budget.ttl,
          });
          count++;
        }
      }
    }

    return count;
  }

  // --- Metrics ---

  /**
   * Get aggregate metrics from the index.
   *
   * Returns total message count, counts by status, and counts by subject
   * (sorted by volume descending).
   *
   * @returns Aggregate relay metrics.
   */
  getMetrics(): RelayMetrics {
    const totalResult = this.stmts.totalCount.get() as { count: number };
    const totalMessages = totalResult.count;

    const statusRows = this.stmts.countByStatus.all() as Array<{ status: string; count: number }>;
    const byStatus: Record<string, number> = {};
    for (const row of statusRows) {
      byStatus[row.status] = row.count;
    }

    const subjectRows = this.stmts.countBySubject.all() as Array<{ subject: string; count: number }>;
    const bySubject = subjectRows.map((row) => ({
      subject: row.subject,
      count: row.count,
    }));

    return { totalMessages, byStatus, bySubject };
  }

  // --- Lifecycle ---

  /**
   * Close the database connection.
   *
   * Should be called during graceful shutdown to release the WAL file.
   */
  close(): void {
    this.db.close();
  }

  /**
   * Check whether the database is using WAL journal mode.
   *
   * @returns `true` if WAL mode is active.
   */
  isWalMode(): boolean {
    const result = this.db.pragma('journal_mode', { simple: true }) as string;
    return result === 'wal';
  }

  // --- Internal Helpers ---

  /** Run schema migrations based on PRAGMA user_version. */
  private runMigrations(): void {
    const currentVersion = (this.db.pragma('user_version', { simple: true }) as number) ?? 0;
    if (currentVersion >= MIGRATIONS.length) return;

    const migrate = this.db.transaction(() => {
      for (let i = currentVersion; i < MIGRATIONS.length; i++) {
        this.db.exec(MIGRATIONS[i]);
      }
      this.db.pragma(`user_version = ${MIGRATIONS.length}`);
    });

    migrate();
  }
}

// === Helpers ===

/**
 * Convert a snake_case SQLite row to a camelCase IndexedMessage.
 *
 * @param row - Raw database row.
 */
function mapMessageRow(row: MessageRow): IndexedMessage {
  return {
    id: row.id,
    subject: row.subject,
    sender: row.sender,
    endpointHash: row.endpoint_hash,
    status: row.status as MessageStatus,
    createdAt: row.created_at,
    ttl: row.ttl,
  };
}

/**
 * List message IDs from a Maildir subdirectory.
 *
 * Delegates to the appropriate MaildirStore list method based on the
 * subdirectory name.
 *
 * @param store - The MaildirStore to query.
 * @param hash - The endpoint hash.
 * @param subdir - The Maildir subdirectory to list.
 */
async function listMessageIds(
  store: MaildirStore,
  hash: string,
  subdir: 'new' | 'cur' | 'failed',
): Promise<string[]> {
  switch (subdir) {
    case 'new':
      return store.listNew(hash);
    case 'cur':
      return store.listCurrent(hash);
    case 'failed':
      return store.listFailed(hash);
  }
}
