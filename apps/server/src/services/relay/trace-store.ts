/**
 * SQLite trace storage for Relay message delivery tracking.
 *
 * Stores message trace spans in the existing Relay index database
 * (`~/.dork/relay/index.db`) following OpenTelemetry-inspired fields.
 * Provides delivery metrics via live SQL aggregates.
 *
 * @module services/relay/trace-store
 */
import Database from 'better-sqlite3';
import type { TraceSpan, DeliveryMetrics } from '@dorkos/shared/relay-schemas';
import { logger } from '../../lib/logger.js';

/** Raw row shape from the `message_traces` SQLite table (snake_case). */
interface TraceRow {
  message_id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  subject: string;
  from_endpoint: string;
  to_endpoint: string;
  status: string;
  budget_hops_used: number | null;
  budget_ttl_remaining_ms: number | null;
  sent_at: number;
  delivered_at: number | null;
  processed_at: number | null;
  error: string | null;
}

/** Fields that can be updated on a trace span. */
export interface TraceSpanUpdate {
  status?: TraceSpan['status'];
  deliveredAt?: number;
  processedAt?: number;
  error?: string;
  budgetHopsUsed?: number;
  budgetTtlRemainingMs?: number;
}

/** Options for creating a TraceStore. */
export interface TraceStoreOptions {
  /** Absolute path to the SQLite database file. */
  dbPath: string;
}

const MIGRATION = `
CREATE TABLE IF NOT EXISTS message_traces (
  message_id     TEXT PRIMARY KEY,
  trace_id       TEXT NOT NULL,
  span_id        TEXT NOT NULL,
  parent_span_id TEXT,
  subject        TEXT NOT NULL,
  from_endpoint  TEXT NOT NULL,
  to_endpoint    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  budget_hops_used       INTEGER,
  budget_ttl_remaining_ms INTEGER,
  sent_at        INTEGER NOT NULL,
  delivered_at   INTEGER,
  processed_at   INTEGER,
  error          TEXT
);

CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON message_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_subject ON message_traces(subject);
CREATE INDEX IF NOT EXISTS idx_traces_sent_at ON message_traces(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_status ON message_traces(status) WHERE status = 'dead_lettered';
`;

/** Map a snake_case DB row to a camelCase TraceSpan. */
function rowToSpan(row: TraceRow): TraceSpan {
  return {
    messageId: row.message_id,
    traceId: row.trace_id,
    spanId: row.span_id,
    parentSpanId: row.parent_span_id,
    subject: row.subject,
    fromEndpoint: row.from_endpoint,
    toEndpoint: row.to_endpoint,
    status: row.status as TraceSpan['status'],
    budgetHopsUsed: row.budget_hops_used,
    budgetTtlRemainingMs: row.budget_ttl_remaining_ms,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    processedAt: row.processed_at,
    error: row.error,
  };
}

/**
 * Persistent trace storage for Relay message delivery tracking.
 *
 * Adds a `message_traces` table to the existing Relay SQLite database.
 * Follows the same better-sqlite3 patterns as PulseStore: WAL mode,
 * `PRAGMA user_version` migrations, prepared statements.
 */
export class TraceStore {
  private readonly db: Database.Database;
  private readonly stmts: {
    insert: Database.Statement;
    getByMessageId: Database.Statement;
    getByTraceId: Database.Statement;
  };

  constructor(options: TraceStoreOptions) {
    this.db = new Database(options.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('busy_timeout = 5000');

    this.runMigration();

    this.stmts = {
      insert: this.db.prepare(`
        INSERT OR REPLACE INTO message_traces
        (message_id, trace_id, span_id, parent_span_id, subject, from_endpoint, to_endpoint,
         status, budget_hops_used, budget_ttl_remaining_ms, sent_at, delivered_at, processed_at, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getByMessageId: this.db.prepare(
        `SELECT * FROM message_traces WHERE message_id = ?`
      ),
      getByTraceId: this.db.prepare(
        `SELECT * FROM message_traces WHERE trace_id = ? ORDER BY sent_at ASC`
      ),
    };

    logger.debug('[TraceStore] Initialized');
  }

  /**
   * Run the trace table migration if it doesn't exist yet.
   *
   * Uses a simple existence check rather than user_version since we share
   * the database with SqliteIndex which manages its own version.
   */
  private runMigration(): void {
    const tableExists = this.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='message_traces'`
      )
      .get();

    if (!tableExists) {
      this.db.exec(MIGRATION);
      logger.info('[TraceStore] Created message_traces table');
    }
  }

  /** Insert a new trace span. */
  insertSpan(span: TraceSpan): void {
    this.stmts.insert.run(
      span.messageId,
      span.traceId,
      span.spanId,
      span.parentSpanId,
      span.subject,
      span.fromEndpoint,
      span.toEndpoint,
      span.status,
      span.budgetHopsUsed,
      span.budgetTtlRemainingMs,
      span.sentAt,
      span.deliveredAt,
      span.processedAt,
      span.error
    );
  }

  /** Update fields on an existing trace span. */
  updateSpan(messageId: string, update: TraceSpanUpdate): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    const fieldMap: Record<string, string> = {
      status: 'status',
      deliveredAt: 'delivered_at',
      processedAt: 'processed_at',
      error: 'error',
      budgetHopsUsed: 'budget_hops_used',
      budgetTtlRemainingMs: 'budget_ttl_remaining_ms',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      const val = update[camel as keyof TraceSpanUpdate];
      if (val !== undefined) {
        setClauses.push(`${snake} = ?`);
        values.push(val);
      }
    }

    if (setClauses.length === 0) return;

    values.push(messageId);
    this.db
      .prepare(`UPDATE message_traces SET ${setClauses.join(', ')} WHERE message_id = ?`)
      .run(...values);
  }

  /** Get a single span by message ID, or null if not found. */
  getSpanByMessageId(messageId: string): TraceSpan | null {
    const row = this.stmts.getByMessageId.get(messageId) as TraceRow | undefined;
    return row ? rowToSpan(row) : null;
  }

  /** Get all spans for a trace ID, ordered by sent_at ascending. */
  getTrace(traceId: string): TraceSpan[] {
    const rows = this.stmts.getByTraceId.all(traceId) as TraceRow[];
    return rows.map(rowToSpan);
  }

  /** Compute live delivery metrics from SQL aggregates. */
  getMetrics(): DeliveryMetrics {
    const counts = this.db
      .prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status = 'delivered' OR status = 'processed' THEN 1 ELSE 0 END) as delivered,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN status = 'dead_lettered' THEN 1 ELSE 0 END) as dead_lettered
         FROM message_traces`
      )
      .get() as { total: number; delivered: number | null; failed: number | null; dead_lettered: number | null };

    const latency = this.db
      .prepare(
        `SELECT
           AVG(delivered_at - sent_at) as avg_ms,
           MAX(delivered_at - sent_at) as max_ms
         FROM message_traces
         WHERE delivered_at IS NOT NULL`
      )
      .get() as { avg_ms: number | null; max_ms: number | null };

    // p95 approximation via OFFSET-based percentile
    const p95Row = this.db
      .prepare(
        `SELECT (delivered_at - sent_at) as latency_ms
         FROM message_traces
         WHERE delivered_at IS NOT NULL
         ORDER BY latency_ms ASC
         LIMIT 1
         OFFSET (
           SELECT CAST(COUNT(*) * 0.95 AS INTEGER)
           FROM message_traces
           WHERE delivered_at IS NOT NULL
         )`
      )
      .get() as { latency_ms: number } | undefined;

    const endpointCount = this.db
      .prepare(
        `SELECT COUNT(DISTINCT to_endpoint) as cnt FROM message_traces`
      )
      .get() as { cnt: number };

    return {
      totalMessages: counts.total,
      deliveredCount: counts.delivered ?? 0,
      failedCount: counts.failed ?? 0,
      deadLetteredCount: counts.dead_lettered ?? 0,
      avgDeliveryLatencyMs: latency.avg_ms,
      p95DeliveryLatencyMs: p95Row?.latency_ms ?? null,
      activeEndpoints: endpointCount.cnt,
      budgetRejections: {
        hopLimit: 0,
        ttlExpired: 0,
        cycleDetected: 0,
        budgetExhausted: 0,
      },
    };
  }

  /** Close the database connection. */
  close(): void {
    this.db.close();
  }
}
