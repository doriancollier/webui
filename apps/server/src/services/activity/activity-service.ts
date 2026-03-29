/**
 * Core service for the Activity Feed — write, query, and prune activity events.
 *
 * All public methods are safe to call from any route or service. `emit()` is
 * fire-and-forget: it catches all errors internally so callers never need
 * try/catch wrappers.
 *
 * @module services/activity/activity-service
 */
import { ulid } from 'ulidx';
import { lt, gt, inArray } from 'drizzle-orm';
import { desc, and, eq, activityEvents, type Db } from '@dorkos/db';
import type {
  ActivityItem,
  ListActivityQuery,
  ListActivityResponse,
  ActorType,
  ActivityCategory,
} from '@dorkos/shared/activity-schemas';
import type { SQL } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';

/** Input shape for `emit()`. Only `actorType`, `actorLabel`, `category`, `eventType`, and `summary` are required. */
interface EmitEvent {
  occurredAt?: string;
  actorType: ActorType;
  actorId?: string | null;
  actorLabel: string;
  category: ActivityCategory;
  eventType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceLabel?: string | null;
  summary: string;
  linkPath?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Manages the activity_events table — append-only event log with
 * cursor-based pagination and time-based pruning.
 */
export class ActivityService {
  constructor(private db: Db) {}

  /**
   * Fire-and-forget event emission. Never throws.
   * Call this after the primary operation succeeds.
   *
   * @param event - Activity event fields to persist
   */
  async emit(event: EmitEvent): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.db.insert(activityEvents).values({
        id: ulid(),
        occurredAt: event.occurredAt ?? now,
        actorType: event.actorType,
        actorId: event.actorId ?? null,
        actorLabel: event.actorLabel,
        category: event.category,
        eventType: event.eventType,
        resourceType: event.resourceType ?? null,
        resourceId: event.resourceId ?? null,
        resourceLabel: event.resourceLabel ?? null,
        summary: event.summary,
        linkPath: event.linkPath ?? null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        createdAt: now,
      });
    } catch (err) {
      logger.warn('[Activity] Failed to emit activity event', { err, event: event.eventType });
    }
  }

  /**
   * Query activity events with cursor-based pagination and filtering.
   *
   * @param query - Pagination and filter parameters
   */
  async list(query: ListActivityQuery): Promise<ListActivityResponse> {
    const { limit, before, categories, actorType, actorId, since } = query;
    const conditions: SQL[] = [];

    if (before) {
      conditions.push(lt(activityEvents.occurredAt, before));
    }
    if (categories) {
      const cats = categories.split(',').map((c) => c.trim()) as ActivityCategory[];
      conditions.push(inArray(activityEvents.category, cats));
    }
    if (actorType) {
      conditions.push(eq(activityEvents.actorType, actorType));
    }
    if (actorId) {
      conditions.push(eq(activityEvents.actorId, actorId));
    }
    if (since) {
      conditions.push(gt(activityEvents.occurredAt, since));
    }

    // Fetch limit + 1 to detect whether more pages exist
    const rows = await this.db
      .select()
      .from(activityEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(activityEvents.occurredAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    const mapped: ActivityItem[] = items.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt,
      actorType: row.actorType as ActorType,
      actorId: row.actorId,
      actorLabel: row.actorLabel,
      category: row.category as ActivityCategory,
      eventType: row.eventType,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      resourceLabel: row.resourceLabel,
      summary: row.summary,
      linkPath: row.linkPath,
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    }));

    return {
      items: mapped,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].occurredAt : null,
    };
  }

  /**
   * Prune events older than the retention period.
   * Called at server startup and optionally by a Pulse schedule.
   *
   * @param retentionDays - Days to retain events (default 30)
   * @returns Number of deleted rows
   */
  async prune(retentionDays: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.db
      .delete(activityEvents)
      .where(lt(activityEvents.occurredAt, cutoff.toISOString()));

    return result.changes;
  }
}
