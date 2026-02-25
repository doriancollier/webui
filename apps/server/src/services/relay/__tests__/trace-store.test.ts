import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TraceStore } from '../trace-store.js';
import type { TraceSpan } from '@dorkos/shared/relay-schemas';
import os from 'os';
import path from 'path';
import fs from 'fs';

function makeTmpDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-store-test-'));
  return path.join(dir, 'test-index.db');
}

function makeSpan(overrides: Partial<TraceSpan> = {}): TraceSpan {
  return {
    messageId: 'msg-001',
    traceId: 'trace-001',
    spanId: 'span-001',
    parentSpanId: null,
    subject: 'relay.agent.session-1',
    fromEndpoint: 'relay.human.console.client-1',
    toEndpoint: 'relay.agent.session-1',
    status: 'pending',
    budgetHopsUsed: null,
    budgetTtlRemainingMs: null,
    sentAt: 1000,
    deliveredAt: null,
    processedAt: null,
    error: null,
    ...overrides,
  };
}

describe('TraceStore', () => {
  let store: TraceStore;
  let dbPath: string;

  beforeEach(() => {
    dbPath = makeTmpDbPath();
    store = new TraceStore({ dbPath });
  });

  afterEach(() => {
    store.close();
    // Clean up temp files
    try {
      const dir = path.dirname(dbPath);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('inserts a span and retrieves by messageId', () => {
    const span = makeSpan();
    store.insertSpan(span);

    const result = store.getSpanByMessageId('msg-001');
    expect(result).toEqual(span);
  });

  it('returns null for non-existent messageId', () => {
    const result = store.getSpanByMessageId('nonexistent');
    expect(result).toBeNull();
  });

  it('updates span status and deliveredAt', () => {
    store.insertSpan(makeSpan());

    store.updateSpan('msg-001', {
      status: 'delivered',
      deliveredAt: 1050,
    });

    const result = store.getSpanByMessageId('msg-001');
    expect(result?.status).toBe('delivered');
    expect(result?.deliveredAt).toBe(1050);
  });

  it('retrieves multiple spans by traceId', () => {
    store.insertSpan(makeSpan({ messageId: 'msg-001', traceId: 'trace-A', sentAt: 1000 }));
    store.insertSpan(makeSpan({ messageId: 'msg-002', traceId: 'trace-A', spanId: 'span-002', sentAt: 1100 }));
    store.insertSpan(makeSpan({ messageId: 'msg-003', traceId: 'trace-B', spanId: 'span-003', sentAt: 1200 }));

    const trace = store.getTrace('trace-A');
    expect(trace).toHaveLength(2);
    expect(trace[0].messageId).toBe('msg-001');
    expect(trace[1].messageId).toBe('msg-002');
  });

  it('returns correct metrics with counts and latency', () => {
    store.insertSpan(makeSpan({
      messageId: 'msg-001',
      status: 'delivered',
      sentAt: 1000,
      deliveredAt: 1050,
    }));
    store.insertSpan(makeSpan({
      messageId: 'msg-002',
      spanId: 'span-002',
      status: 'delivered',
      sentAt: 2000,
      deliveredAt: 2200,
    }));
    store.insertSpan(makeSpan({
      messageId: 'msg-003',
      spanId: 'span-003',
      status: 'failed',
      sentAt: 3000,
      error: 'timeout',
    }));
    store.insertSpan(makeSpan({
      messageId: 'msg-004',
      spanId: 'span-004',
      status: 'dead_lettered',
      sentAt: 4000,
    }));

    const metrics = store.getMetrics();
    expect(metrics.totalMessages).toBe(4);
    expect(metrics.deliveredCount).toBe(2);
    expect(metrics.failedCount).toBe(1);
    expect(metrics.deadLetteredCount).toBe(1);
    expect(metrics.avgDeliveryLatencyMs).toBe(125); // (50 + 200) / 2
    expect(metrics.activeEndpoints).toBe(1);
  });

  it('returns empty metrics with no data', () => {
    const metrics = store.getMetrics();
    expect(metrics.totalMessages).toBe(0);
    expect(metrics.deliveredCount).toBe(0);
    expect(metrics.avgDeliveryLatencyMs).toBeNull();
    expect(metrics.p95DeliveryLatencyMs).toBeNull();
  });

  it('handles updateSpan with no fields gracefully', () => {
    store.insertSpan(makeSpan());
    store.updateSpan('msg-001', {});
    const result = store.getSpanByMessageId('msg-001');
    expect(result?.status).toBe('pending');
  });
});
