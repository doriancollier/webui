import { describe, it, expect } from 'vitest';
import {
  ActivityCategorySchema,
  ActorTypeSchema,
  ActivityItemSchema,
  ListActivityQuerySchema,
  ListActivityResponseSchema,
} from '../activity-schemas.js';

// Minimal valid ActivityItem fixture
const baseItem = {
  id: '01JARQ1234ABCDEF',
  occurredAt: '2026-03-29T10:00:00.000Z',
  actorType: 'user' as const,
  actorId: null,
  actorLabel: 'You',
  category: 'tasks' as const,
  eventType: 'tasks.run_success',
  resourceType: 'schedule',
  resourceId: 'sched-001',
  resourceLabel: 'daily-digest',
  summary: 'daily-digest ran successfully (2m 14s)',
  linkPath: '/',
  metadata: null,
};

describe('ActivityCategorySchema', () => {
  it('accepts all valid categories', () => {
    for (const cat of ['tasks', 'relay', 'agent', 'config', 'system']) {
      expect(ActivityCategorySchema.parse(cat)).toBe(cat);
    }
  });

  it('rejects invalid category', () => {
    expect(() => ActivityCategorySchema.parse('invalid')).toThrow();
  });
});

describe('ActorTypeSchema', () => {
  it('accepts all valid actor types', () => {
    for (const actor of ['user', 'agent', 'system', 'tasks']) {
      expect(ActorTypeSchema.parse(actor)).toBe(actor);
    }
  });

  it('rejects invalid actor type', () => {
    expect(() => ActorTypeSchema.parse('unknown')).toThrow();
  });
});

describe('ActivityItemSchema', () => {
  it('parses a valid activity item', () => {
    const result = ActivityItemSchema.parse(baseItem);
    expect(result).toEqual(baseItem);
  });

  it('accepts metadata as a record', () => {
    const result = ActivityItemSchema.parse({
      ...baseItem,
      metadata: { error: 'timeout', duration: 120 },
    });
    expect(result.metadata).toEqual({ error: 'timeout', duration: 120 });
  });

  it('accepts null for all nullable fields', () => {
    const result = ActivityItemSchema.parse({
      ...baseItem,
      actorId: null,
      resourceType: null,
      resourceId: null,
      resourceLabel: null,
      linkPath: null,
      metadata: null,
    });
    expect(result.actorId).toBeNull();
    expect(result.resourceType).toBeNull();
    expect(result.resourceId).toBeNull();
    expect(result.resourceLabel).toBeNull();
    expect(result.linkPath).toBeNull();
    expect(result.metadata).toBeNull();
  });

  it('rejects missing required fields', () => {
    expect(() => ActivityItemSchema.parse({ id: '01JARQ' })).toThrow();
  });

  it('rejects invalid actorType', () => {
    expect(() => ActivityItemSchema.parse({ ...baseItem, actorType: 'robot' })).toThrow();
  });

  it('rejects invalid category', () => {
    expect(() => ActivityItemSchema.parse({ ...baseItem, category: 'unknown' })).toThrow();
  });
});

describe('ListActivityQuerySchema', () => {
  it('applies default limit of 50 when omitted', () => {
    const result = ListActivityQuerySchema.parse({});
    expect(result.limit).toBe(50);
  });

  it('coerces string limit to number', () => {
    const result = ListActivityQuerySchema.parse({ limit: '25' });
    expect(result.limit).toBe(25);
  });

  it('rejects limit below 1', () => {
    expect(() => ListActivityQuerySchema.parse({ limit: '0' })).toThrow();
  });

  it('rejects limit above 100', () => {
    expect(() => ListActivityQuerySchema.parse({ limit: '101' })).toThrow();
  });

  it('accepts all optional filter parameters', () => {
    const result = ListActivityQuerySchema.parse({
      limit: '10',
      before: '2026-03-29T09:00:00.000Z',
      categories: 'tasks,relay',
      actorType: 'agent',
      actorId: 'agent-001',
      since: '2026-03-28T00:00:00.000Z',
    });
    expect(result).toEqual({
      limit: 10,
      before: '2026-03-29T09:00:00.000Z',
      categories: 'tasks,relay',
      actorType: 'agent',
      actorId: 'agent-001',
      since: '2026-03-28T00:00:00.000Z',
    });
  });

  it('rejects invalid actorType filter', () => {
    expect(() => ListActivityQuerySchema.parse({ actorType: 'robot' })).toThrow();
  });

  it('rejects non-integer limit', () => {
    expect(() => ListActivityQuerySchema.parse({ limit: '3.5' })).toThrow();
  });
});

describe('ListActivityResponseSchema', () => {
  it('parses a valid response with items', () => {
    const result = ListActivityResponseSchema.parse({
      items: [baseItem],
      nextCursor: '2026-03-29T09:00:00.000Z',
    });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe('2026-03-29T09:00:00.000Z');
  });

  it('accepts null nextCursor for last page', () => {
    const result = ListActivityResponseSchema.parse({
      items: [],
      nextCursor: null,
    });
    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it('rejects missing items field', () => {
    expect(() => ListActivityResponseSchema.parse({ nextCursor: null })).toThrow();
  });
});
