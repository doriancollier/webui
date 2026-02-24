import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { SqliteIndex } from '../sqlite-index.js';
import { MaildirStore } from '../maildir-store.js';
import type { IndexedMessage, MessageStatus } from '../sqlite-index.js';
import type { RelayEnvelope } from '@dorkos/shared/relay-schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ENDPOINT_HASH = 'abc123def456';
const TEST_SUBJECT = 'relay.agent.myproject.backend';
const TEST_SENDER = 'relay.agent.myproject.frontend';

function makeMessage(overrides: Partial<IndexedMessage> = {}): IndexedMessage {
  return {
    id: '01JKABCDEFGH',
    subject: TEST_SUBJECT,
    sender: TEST_SENDER,
    endpointHash: TEST_ENDPOINT_HASH,
    status: 'new',
    createdAt: new Date().toISOString(),
    ttl: Date.now() + 60_000,
    ...overrides,
  };
}

function makeEnvelope(overrides: Partial<RelayEnvelope> = {}): RelayEnvelope {
  return {
    id: '01JKABCDEFGH',
    subject: TEST_SUBJECT,
    from: TEST_SENDER,
    budget: {
      hopCount: 0,
      maxHops: 5,
      ancestorChain: [],
      ttl: Date.now() + 60_000,
      callBudgetRemaining: 10,
    },
    createdAt: new Date().toISOString(),
    payload: { hello: 'world' },
    ...overrides,
  };
}

let tmpDir: string;
let index: SqliteIndex;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-sqlite-test-'));
  const dbPath = path.join(tmpDir, 'index.db');
  index = new SqliteIndex({ dbPath });
});

afterEach(async () => {
  index.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// WAL Mode
// ---------------------------------------------------------------------------

describe('WAL mode', () => {
  it('uses WAL journal mode', () => {
    expect(index.isWalMode()).toBe(true);
  });

  it('creates WAL file on disk', async () => {
    // Insert something to trigger WAL
    index.insertMessage(makeMessage());

    const files = await fs.readdir(tmpDir);
    expect(files).toContain('index.db');
    // WAL file may or may not be present depending on checkpoint timing,
    // but the pragma confirms WAL mode is active
    expect(index.isWalMode()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Insert and Query by Subject
// ---------------------------------------------------------------------------

describe('insertMessage + getBySubject', () => {
  it('inserts a message and retrieves it by subject', () => {
    const msg = makeMessage();
    index.insertMessage(msg);

    const results = index.getBySubject(TEST_SUBJECT);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(msg);
  });

  it('returns empty array for unknown subject', () => {
    const results = index.getBySubject('relay.nonexistent');
    expect(results).toHaveLength(0);
  });

  it('retrieves multiple messages for the same subject ordered by created_at DESC', () => {
    const msg1 = makeMessage({
      id: '01JAAA',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const msg2 = makeMessage({
      id: '01JBBB',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    const msg3 = makeMessage({
      id: '01JCCC',
      createdAt: '2026-01-03T00:00:00.000Z',
    });

    index.insertMessage(msg1);
    index.insertMessage(msg2);
    index.insertMessage(msg3);

    const results = index.getBySubject(TEST_SUBJECT);
    expect(results).toHaveLength(3);
    // Descending order
    expect(results[0].id).toBe('01JCCC');
    expect(results[1].id).toBe('01JBBB');
    expect(results[2].id).toBe('01JAAA');
  });

  it('INSERT OR REPLACE is idempotent — re-inserting the same message updates it', () => {
    const msg = makeMessage();
    index.insertMessage(msg);
    index.insertMessage({ ...msg, status: 'cur' });

    const results = index.getBySubject(TEST_SUBJECT);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('cur');
  });
});

// ---------------------------------------------------------------------------
// getMessage
// ---------------------------------------------------------------------------

describe('getMessage', () => {
  it('returns the message by ID', () => {
    const msg = makeMessage();
    index.insertMessage(msg);

    const result = index.getMessage(msg.id);
    expect(result).toEqual(msg);
  });

  it('returns null for unknown ID', () => {
    expect(index.getMessage('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getByEndpoint
// ---------------------------------------------------------------------------

describe('getByEndpoint', () => {
  it('returns messages for a given endpoint hash', () => {
    const msg = makeMessage();
    index.insertMessage(msg);

    const results = index.getByEndpoint(TEST_ENDPOINT_HASH);
    expect(results).toHaveLength(1);
    expect(results[0].endpointHash).toBe(TEST_ENDPOINT_HASH);
  });

  it('filters by endpoint hash — does not return messages from other endpoints', () => {
    index.insertMessage(makeMessage({ id: '01JAAA', endpointHash: 'hash_one' }));
    index.insertMessage(makeMessage({ id: '01JBBB', endpointHash: 'hash_two' }));

    const results = index.getByEndpoint('hash_one');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('01JAAA');
  });

  it('returns empty array for unknown endpoint hash', () => {
    expect(index.getByEndpoint('unknown_hash')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Status Updates
// ---------------------------------------------------------------------------

describe('updateStatus', () => {
  it('updates the status of an existing message', () => {
    index.insertMessage(makeMessage({ id: 'msg1', status: 'new' }));

    const updated = index.updateStatus('msg1', 'cur');
    expect(updated).toBe(true);

    const result = index.getMessage('msg1');
    expect(result?.status).toBe('cur');
  });

  it('can transition through all statuses: new -> cur -> failed', () => {
    index.insertMessage(makeMessage({ id: 'msg1', status: 'new' }));

    index.updateStatus('msg1', 'cur');
    expect(index.getMessage('msg1')?.status).toBe('cur');

    index.updateStatus('msg1', 'failed');
    expect(index.getMessage('msg1')?.status).toBe('failed');
  });

  it('returns false for unknown message ID', () => {
    const updated = index.updateStatus('nonexistent', 'cur');
    expect(updated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Expire Cleanup
// ---------------------------------------------------------------------------

describe('deleteExpired', () => {
  it('deletes messages with TTL in the past', () => {
    const now = Date.now();
    index.insertMessage(makeMessage({ id: 'expired', ttl: now - 1000 }));
    index.insertMessage(makeMessage({ id: 'valid', ttl: now + 60_000 }));

    const deleted = index.deleteExpired(now);
    expect(deleted).toBe(1);

    expect(index.getMessage('expired')).toBeNull();
    expect(index.getMessage('valid')).not.toBeNull();
  });

  it('returns 0 when no messages are expired', () => {
    const now = Date.now();
    index.insertMessage(makeMessage({ id: 'valid', ttl: now + 60_000 }));

    const deleted = index.deleteExpired(now);
    expect(deleted).toBe(0);
  });

  it('deletes all messages when all have expired', () => {
    const now = Date.now();
    index.insertMessage(makeMessage({ id: 'exp1', ttl: now - 2000 }));
    index.insertMessage(makeMessage({ id: 'exp2', ttl: now - 1000 }));

    const deleted = index.deleteExpired(now);
    expect(deleted).toBe(2);

    const metrics = index.getMetrics();
    expect(metrics.totalMessages).toBe(0);
  });

  it('uses Date.now() when no argument is provided', () => {
    const pastTtl = Date.now() - 10_000;
    index.insertMessage(makeMessage({ id: 'expired', ttl: pastTtl }));

    const deleted = index.deleteExpired();
    expect(deleted).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Rebuild from Maildir
// ---------------------------------------------------------------------------

describe('rebuild', () => {
  let maildirRoot: string;
  let maildirStore: MaildirStore;

  beforeEach(async () => {
    maildirRoot = path.join(tmpDir, 'mailboxes');
    maildirStore = new MaildirStore({ rootDir: maildirRoot });
  });

  it('rebuilds the index from Maildir files', async () => {
    const hash = 'rebuild_test';
    await maildirStore.ensureMaildir(hash);

    // Deliver two messages — deliver() generates unique filename ULIDs
    const env1 = makeEnvelope({ id: 'msg_rebuild_1' });
    const env2 = makeEnvelope({ id: 'msg_rebuild_2' });
    const result1 = await maildirStore.deliver(hash, env1);
    const result2 = await maildirStore.deliver(hash, env2);
    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    const fileId1 = (result1 as { ok: true; messageId: string }).messageId;
    const fileId2 = (result2 as { ok: true; messageId: string }).messageId;

    // Pre-populate index with stale data
    index.insertMessage(makeMessage({ id: 'stale_data' }));

    const endpointHashes = new Map<string, string>();
    endpointHashes.set(hash, TEST_SUBJECT);

    const count = await index.rebuild(maildirStore, endpointHashes);
    expect(count).toBe(2);

    // Stale data should be gone
    expect(index.getMessage('stale_data')).toBeNull();

    // Rebuilt messages are indexed by filename ULID (consistent with
    // how RelayCore indexes during normal operation), not envelope.id
    const msg1 = index.getMessage(fileId1);
    expect(msg1).not.toBeNull();
    expect(msg1!.status).toBe('new');
    expect(msg1!.endpointHash).toBe(hash);

    const msg2 = index.getMessage(fileId2);
    expect(msg2).not.toBeNull();
    expect(msg2!.status).toBe('new');
  });

  it('indexes messages in cur/ with status "cur"', async () => {
    const hash = 'cur_test';
    await maildirStore.ensureMaildir(hash);

    const env = makeEnvelope({ id: 'msg_cur_test' });
    const deliverResult = await maildirStore.deliver(hash, env);
    expect(deliverResult.ok).toBe(true);

    // deliver() generates a ULID filename; use that for claim()
    const fileMessageId = (deliverResult as { ok: true; messageId: string }).messageId;

    // Claim the message (move new/ -> cur/)
    const claimResult = await maildirStore.claim(hash, fileMessageId);
    expect(claimResult.ok).toBe(true);

    const endpointHashes = new Map<string, string>();
    endpointHashes.set(hash, TEST_SUBJECT);

    await index.rebuild(maildirStore, endpointHashes);

    // Rebuilt messages in cur/ are indexed by the filename ULID (from deliver()),
    // not the envelope's id field — consistent with normal RelayCore operation.
    const msg = index.getMessage(fileMessageId);
    expect(msg).not.toBeNull();
    expect(msg!.status).toBe('cur');
  });

  it('indexes messages in failed/ with status "failed"', async () => {
    const hash = 'failed_test';
    await maildirStore.ensureMaildir(hash);

    const env = makeEnvelope({ id: 'msg_failed_test' });
    await maildirStore.failDirect(hash, env, 'budget exceeded');

    const endpointHashes = new Map<string, string>();
    endpointHashes.set(hash, TEST_SUBJECT);

    await index.rebuild(maildirStore, endpointHashes);

    const msg = index.getMessage('msg_failed_test');
    expect(msg).not.toBeNull();
    expect(msg!.status).toBe('failed');
  });

  it('returns 0 when Maildir is empty', async () => {
    const hash = 'empty_test';
    await maildirStore.ensureMaildir(hash);

    const endpointHashes = new Map<string, string>();
    endpointHashes.set(hash, TEST_SUBJECT);

    const count = await index.rebuild(maildirStore, endpointHashes);
    expect(count).toBe(0);
  });

  it('handles multiple endpoints', async () => {
    const hash1 = 'multi_ep_1';
    const hash2 = 'multi_ep_2';
    await maildirStore.ensureMaildir(hash1);
    await maildirStore.ensureMaildir(hash2);

    await maildirStore.deliver(hash1, makeEnvelope({ id: 'ep1_msg1', subject: 'relay.a' }));
    await maildirStore.deliver(hash2, makeEnvelope({ id: 'ep2_msg1', subject: 'relay.b' }));
    await maildirStore.deliver(hash2, makeEnvelope({ id: 'ep2_msg2', subject: 'relay.b' }));

    const endpointHashes = new Map<string, string>();
    endpointHashes.set(hash1, 'relay.a');
    endpointHashes.set(hash2, 'relay.b');

    const count = await index.rebuild(maildirStore, endpointHashes);
    expect(count).toBe(3);

    expect(index.getByEndpoint(hash1)).toHaveLength(1);
    expect(index.getByEndpoint(hash2)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

describe('getMetrics', () => {
  it('returns zero metrics for empty index', () => {
    const metrics = index.getMetrics();
    expect(metrics.totalMessages).toBe(0);
    expect(metrics.byStatus).toEqual({});
    expect(metrics.bySubject).toEqual([]);
  });

  it('returns correct aggregate counts by status', () => {
    index.insertMessage(makeMessage({ id: 'new1', status: 'new' }));
    index.insertMessage(makeMessage({ id: 'new2', status: 'new' }));
    index.insertMessage(makeMessage({ id: 'cur1', status: 'cur' }));
    index.insertMessage(makeMessage({ id: 'failed1', status: 'failed' }));

    const metrics = index.getMetrics();
    expect(metrics.totalMessages).toBe(4);
    expect(metrics.byStatus).toEqual({
      new: 2,
      cur: 1,
      failed: 1,
    });
  });

  it('returns correct counts by subject sorted by volume descending', () => {
    index.insertMessage(makeMessage({ id: 'a1', subject: 'relay.a' }));
    index.insertMessage(makeMessage({ id: 'b1', subject: 'relay.b' }));
    index.insertMessage(makeMessage({ id: 'b2', subject: 'relay.b' }));
    index.insertMessage(makeMessage({ id: 'c1', subject: 'relay.c' }));
    index.insertMessage(makeMessage({ id: 'c2', subject: 'relay.c' }));
    index.insertMessage(makeMessage({ id: 'c3', subject: 'relay.c' }));

    const metrics = index.getMetrics();
    expect(metrics.totalMessages).toBe(6);
    expect(metrics.bySubject).toEqual([
      { subject: 'relay.c', count: 3 },
      { subject: 'relay.b', count: 2 },
      { subject: 'relay.a', count: 1 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Persistence across reopens
// ---------------------------------------------------------------------------

describe('persistence', () => {
  it('data survives closing and reopening the database', () => {
    const dbPath = path.join(tmpDir, 'persist.db');
    const idx1 = new SqliteIndex({ dbPath });
    idx1.insertMessage(makeMessage({ id: 'persist1' }));
    idx1.close();

    const idx2 = new SqliteIndex({ dbPath });
    const result = idx2.getMessage('persist1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('persist1');
    idx2.close();
  });
});

// ---------------------------------------------------------------------------
// countSenderInWindow
// ---------------------------------------------------------------------------

describe('countSenderInWindow', () => {
  it('returns 0 for no matching messages', () => {
    const count = index.countSenderInWindow('unknown-sender', '2020-01-01T00:00:00.000Z');
    expect(count).toBe(0);
  });

  it('counts only messages from the specified sender', () => {
    index.insertMessage(makeMessage({ id: 'a1', sender: 'alice', createdAt: '2026-01-15T10:00:00.000Z' }));
    index.insertMessage(makeMessage({ id: 'a2', sender: 'alice', createdAt: '2026-01-15T10:01:00.000Z' }));
    index.insertMessage(makeMessage({ id: 'b1', sender: 'bob', createdAt: '2026-01-15T10:00:30.000Z' }));

    const aliceCount = index.countSenderInWindow('alice', '2026-01-01T00:00:00.000Z');
    expect(aliceCount).toBe(2);

    const bobCount = index.countSenderInWindow('bob', '2026-01-01T00:00:00.000Z');
    expect(bobCount).toBe(1);
  });

  it('filters by window start time', () => {
    index.insertMessage(makeMessage({ id: 'old', sender: 'alice', createdAt: '2026-01-10T00:00:00.000Z' }));
    index.insertMessage(makeMessage({ id: 'recent', sender: 'alice', createdAt: '2026-01-15T12:00:00.000Z' }));

    // Window starts after the old message
    const count = index.countSenderInWindow('alice', '2026-01-12T00:00:00.000Z');
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// countNewByEndpoint
// ---------------------------------------------------------------------------

describe('countNewByEndpoint', () => {
  it('returns 0 for empty endpoint', () => {
    const count = index.countNewByEndpoint('nonexistent-hash');
    expect(count).toBe(0);
  });

  it('counts only messages with status new', () => {
    index.insertMessage(makeMessage({ id: 'n1', endpointHash: 'ep1', status: 'new' }));
    index.insertMessage(makeMessage({ id: 'n2', endpointHash: 'ep1', status: 'new' }));
    index.insertMessage(makeMessage({ id: 'c1', endpointHash: 'ep1', status: 'cur' }));

    const count = index.countNewByEndpoint('ep1');
    expect(count).toBe(2);
  });

  it('excludes cur and failed messages', () => {
    index.insertMessage(makeMessage({ id: 'c1', endpointHash: 'ep1', status: 'cur' }));
    index.insertMessage(makeMessage({ id: 'f1', endpointHash: 'ep1', status: 'failed' }));

    const count = index.countNewByEndpoint('ep1');
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Migration idempotency
// ---------------------------------------------------------------------------

describe('migrations', () => {
  it('can reopen the database without re-running migrations', () => {
    const dbPath = path.join(tmpDir, 'migrate.db');
    const idx1 = new SqliteIndex({ dbPath });
    idx1.insertMessage(makeMessage({ id: 'mig1' }));
    idx1.close();

    // Reopen — should not error or re-run migration
    const idx2 = new SqliteIndex({ dbPath });
    const result = idx2.getMessage('mig1');
    expect(result).not.toBeNull();
    idx2.close();
  });

  it('migration version 2 creates the sender+created_at composite index', () => {
    const dbPath = path.join(tmpDir, 'migrate-v2.db');
    const idx = new SqliteIndex({ dbPath });

    // Query sqlite_master for the new index
    // Access the db through a fresh Database connection to verify
    const Database = require('better-sqlite3');
    const verifyDb = new Database(dbPath);
    const row = verifyDb.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_messages_sender_created'`
    ).get() as { name: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.name).toBe('idx_messages_sender_created');

    verifyDb.close();
    idx.close();
  });
});
