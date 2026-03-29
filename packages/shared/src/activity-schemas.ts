/**
 * Zod schemas for the Activity Feed.
 *
 * Defines schemas for activity events, query parameters, and paginated
 * responses. Used by both server (event emission, API validation) and
 * client (response parsing, type safety).
 *
 * @module shared/activity-schemas
 */
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// === Enums ===

/** Event category for filtering activity events by subsystem. */
export const ActivityCategorySchema = z
  .enum(['pulse', 'relay', 'agent', 'config', 'system'])
  .openapi('ActivityCategory');

export type ActivityCategory = z.infer<typeof ActivityCategorySchema>;

/** Actor type: who triggered the event. */
export const ActorTypeSchema = z.enum(['user', 'agent', 'system', 'pulse']).openapi('ActorType');

export type ActorType = z.infer<typeof ActorTypeSchema>;

// === Response Schemas ===

/** Single activity event returned by the API. */
export const ActivityItemSchema = z
  .object({
    id: z.string(),
    occurredAt: z.string(),
    actorType: ActorTypeSchema,
    actorId: z.string().nullable(),
    actorLabel: z.string(),
    category: ActivityCategorySchema,
    eventType: z.string(),
    resourceType: z.string().nullable(),
    resourceId: z.string().nullable(),
    resourceLabel: z.string().nullable(),
    summary: z.string(),
    linkPath: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
  })
  .openapi('ActivityItem');

export type ActivityItem = z.infer<typeof ActivityItemSchema>;

// === Query Schemas ===

/**
 * Query parameters for `GET /api/activity`.
 *
 * Uses `z.coerce.number()` for `limit` because Express query params arrive as strings.
 * `categories` is a comma-separated string that the service splits — keeping the
 * query param flat avoids array-in-URL complexity.
 */
export const ListActivityQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    before: z.string().optional(),
    /** Comma-separated category names for filtering. */
    categories: z.string().optional(),
    actorType: ActorTypeSchema.optional(),
    actorId: z.string().optional(),
    since: z.string().optional(),
  })
  .openapi('ListActivityQuery');

export type ListActivityQuery = z.infer<typeof ListActivityQuerySchema>;

/** Paginated activity response with cursor-based pagination. */
export const ListActivityResponseSchema = z
  .object({
    items: z.array(ActivityItemSchema),
    nextCursor: z.string().nullable(),
  })
  .openapi('ListActivityResponse');

export type ListActivityResponse = z.infer<typeof ListActivityResponseSchema>;
