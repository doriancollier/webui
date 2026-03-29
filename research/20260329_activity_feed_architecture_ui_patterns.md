---
title: 'Activity Feed — Architecture, Data Model, and UI Patterns'
date: 2026-03-29
type: external-best-practices
status: active
tags:
  [
    activity-feed,
    audit-log,
    event-log,
    timeline,
    actor-model,
    SQLite,
    drizzle,
    TanStack-Query,
    shadcn,
    time-grouping,
    virtual-list,
  ]
feature_slug: activity-feed
searches_performed: 12
sources_count: 35
---

# Activity Feed — Architecture, Data Model, and UI Patterns

## Research Summary

This report synthesizes external best practices, prior DorkOS research, and direct analysis of the existing codebase to produce concrete architecture and UX direction for the DorkOS `/activity` route. The core finding: DorkOS should use a **hybrid architecture** — a new `activity_events` append-only SQLite table for config and system events, plus derivation from existing data sources (JSONL sessions, `pulse_runs`, `relay_traces`, `agents`) for events those systems already record. This avoids duplicating data that already exists while providing a unified query surface. The UI should follow the "morning briefing" mental model: reverse-chronological, time-grouped, filterable, with compact single-line rows that link to the relevant detail surface. Pagination (load more) beats infinite scroll for this use case — it preserves scroll position and orientation, which matters when Kai returns after 8 hours of agent activity.

---

## Prior Research Incorporated

The following existing DorkOS research reports are directly relevant and are incorporated throughout:

- `research/20260320_dashboard_content_design_patterns.md` — activity feed patterns for the dashboard, time grouping, event taxonomy, real-time update strategy, "what happened while you were away" detection
- `research/20260316_subagent_activity_streaming_ui_patterns.md` — collapsible blocks, tool call summary formats, actor attribution
- `research/20260301_logging_review.md` — existing server logging infrastructure, `~/.dork/logs/` path, consola + NDJSON file reporter
- `research/20260301_ai_parseable_logging.md` — NDJSON field schema, structured log format, AI-consumable log sizing
- `research/20260216_logging_strategy.md` — logging library decisions, file transport patterns

---

## Key Findings

### 1. Architecture: Hybrid Append-Only Table + Derived Sources

The optimal approach for DorkOS is a **hybrid** that does not force a full event-sourcing rewrite but adds targeted instrumentation:

**New table** (`activity_events` in `packages/db`): captures events that have no other storage home:

- Config changes: adapter added/edited/removed, bindings added/edited/removed, extensions added/edited/removed
- Agent registry events: agent added, agent removed, agent status changes
- System events: DorkOS started, config reloaded

**Derived from existing tables** (read-only joins, no new writes):

- Session events → derived from JSONL session files (already read by `transcript-reader.ts`)
- Pulse run events → derived from `pulse_runs` table (already exists with `status`, `startedAt`, `finishedAt`, `trigger`)
- Relay activity → derived from `relay_traces` table (already exists with `status`, `sentAt`, `subject`)

This approach means the activity page is mostly a **view layer** over data that already exists, with a small new table for events that have no other home. It avoids double-writing data and keeps the `activity_events` table small and focused.

### 2. Data Model: The Actor-Verb-Resource Pattern

Industry consensus (Stream, Infisical, EnterpriseReady, Azure Activity Log) converges on the same four-part model:

```
actor → verb → resource → [metadata]
```

Examples:

- `user → created → session (researcher)`
- `agent (researcher) → started → session (researcher-xyz123)`
- `system → added → adapter (telegram)`
- `pulse → ran → schedule (daily-digest)` (failed)

Every row answers: **who** (actor), **what** (verb/event_type), **which** (resource_type + resource_id), **when** (timestamp).

### 3. UI Pattern: Morning Briefing, Not Log Viewer

The activity page serves Kai's "wake up and see what agents did overnight" use case. This is a **briefing**, not a debugger. The correct mental model is GitHub's contribution activity or Linear's issue history — compact, scannable, time-grouped, filterable by category. Not a log tail (that's a dev tool feature), not a full session transcript (that's `/session`).

Key UI decisions:

- **Reverse chronological** (newest first, always)
- **Time-grouped** into Today / Yesterday / This Week / Older
- **Load more button** (not infinite scroll) for stability and orientation
- **Filter bar**: by event category (session, pulse, relay, config, system), by actor (user, agent name, system), by date range
- **Compact single-line rows** with: timestamp | actor badge | event description | resource link
- **Empty state**: deliberate and reassuring, not blank

### 4. Event Taxonomy for DorkOS

Based on the feature brief and what each subsystem tracks, the complete event taxonomy is:

| Category  | Events                                                                                                        | Source                       |
| --------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `session` | created, started, completed, failed, abandoned                                                                | JSONL + session service      |
| `pulse`   | ran-success, ran-failed, ran-cancelled, schedule-created, schedule-deleted, schedule-paused, schedule-enabled | `pulse_runs` + route hooks   |
| `relay`   | adapter-added, adapter-removed, adapter-connected, adapter-disconnected, message-delivered, message-failed    | `relay_traces` + route hooks |
| `agent`   | registered, removed, status-changed, session-started (long-inactivity)                                        | `agents` table + route hooks |
| `config`  | extension-added, extension-removed, extension-updated, binding-added, binding-removed, binding-updated        | New `activity_events` table  |
| `system`  | started, stopped, config-reloaded                                                                             | New `activity_events` table  |

### 5. Actor Model: Three Types

| Actor Type | Examples                        | Attribution Display    |
| ---------- | ------------------------------- | ---------------------- |
| `user`     | Human at keyboard               | "You"                  |
| `agent`    | Named agent (researcher, coder) | Agent name + color dot |
| `system`   | Scheduled pulse, auto-reconnect | "Pulse" / "System"     |

The actor is stored as `actor_type + actor_id + actor_label`. For the activity page, most events are attributed to agents (they did the work). Config changes are attributed to `user`. Scheduled pulse runs are attributed to `system/pulse`.

### 6. Retention: 30 Days Default, Configurable

Unlike the operational NDJSON logs (7-day rotation), activity events are the user-facing history — Kai cares about what happened 3 weeks ago more than what log lines were emitted. Recommended defaults:

- `activity_events` table: 30 days retention, pruned by a scheduled cleanup (Pulse can own this)
- Derived session/pulse events: already have their own retention in their source tables
- The activity feed query joins across all sources with a `WHERE timestamp > now - 30d` filter

---

## Detailed Analysis

### Architecture Option Comparison

#### Option A: Full Event Sourcing (Append-Only Event Log)

Store every state change as an immutable event. The `agents` table, `pulse_schedules` table, and all other data derive from replaying the event log.

**Pros:**

- Complete audit trail by design
- Can reconstruct state at any point in time
- True immutability

**Cons:**

- Requires rewriting all existing write paths (relay, mesh, pulse, agents) to emit events instead of mutating records
- Adds projection complexity (read models must be derived)
- Overkill for a local single-user developer tool
- SQLite is not optimized for event sourcing at scale (row counts matter for replay)
- Would take weeks to implement and touches every subsystem

**Verdict for DorkOS: Not recommended.** The existing stateful tables are the right design for a local tool. Full event sourcing is appropriate for distributed systems needing audit compliance — not a local desktop app.

#### Option B: Derived Activity Table (New `activity_events` table + triggers/hooks)

Add a new `activity_events` table. All mutations to `agents`, `pulse_schedules`, `relay`, and extensions emit a row to this table as a side effect.

**Pros:**

- Simple to query (single table, standard SQL)
- Append-only by design (never update rows)
- Easy to filter, paginate, and join
- Does not require restructuring existing tables
- Can be added incrementally — start with config events, add session events later

**Cons:**

- Must instrument every write path to emit activity rows
- Some events (session completion) require reading JSONL metadata
- Potential for gaps if a write path is missed

**Verdict: Recommended as the foundation for config/agent/system events.** The new `activity_events` table captures events that have no current storage home.

#### Option C: File-Based Activity Log (JSONL like sessions)

Append activity events to a JSONL file in `~/.dork/activity/`.

**Pros:**

- Consistent with the existing session JSONL pattern
- Simple append-only writes
- Human-readable on disk

**Cons:**

- No indexed queries — filtering requires full file scan
- Pagination requires parsing the file backwards
- No schema enforcement
- Harder to join with relational data for filtering
- Already have NDJSON at `~/.dork/logs/dorkos.log` — adding another log file adds confusion

**Verdict: Not recommended.** The NDJSON logs at `~/.dork/logs/` already serve operational logging. A SQLite table is the right primitive for queryable, filterable, paginated activity data.

#### Option D: Hybrid — New Table + Derived from Existing (Recommended)

New `activity_events` table for config/system events + read queries against `pulse_runs`, `relay_traces`, `agents`, and JSONL session data for their respective events.

**Pros:**

- Minimal new writes (only config/system events are new)
- Leverages existing data that already exists (pulse runs, relay traces, sessions)
- No risk of double-writing session data
- Unified API: one endpoint that queries all sources and merges/sorts
- Incremental — ship the config events first, add more sources over time

**Cons:**

- Server-side merge/sort required (query multiple tables, unify to one list)
- Some complexity in the `/api/activity` endpoint logic
- Session events require JSONL parsing (already done by `transcript-reader.ts`)

**Verdict: Recommended.** This is the pragmatic, DorkOS-first approach. It respects existing data ownership and minimizes new writes.

---

### Recommended `activity_events` Table Schema

```typescript
// packages/db/src/schema/activity.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Append-only activity event log.
 * Stores config changes, agent registry events, and system events.
 * Session, pulse, and relay events are derived from their source tables.
 * Never update rows — only insert and prune old rows.
 */
export const activityEvents = sqliteTable('activity_events', {
  id: text('id').primaryKey(), // ULID

  // When
  occurredAt: text('occurred_at').notNull(), // ISO 8601 TEXT, server time

  // Who
  actorType: text('actor_type', {
    enum: ['user', 'agent', 'system', 'pulse'],
  }).notNull(),
  actorId: text('actor_id'), // agent id, 'user', 'system', schedule id
  actorLabel: text('actor_label'), // human-readable: agent name, 'You', 'Pulse'

  // What
  category: text('category', {
    enum: ['session', 'pulse', 'relay', 'agent', 'config', 'system'],
  }).notNull(),
  eventType: text('event_type').notNull(), // 'adapter.added', 'extension.removed', etc.

  // Which
  resourceType: text('resource_type'), // 'adapter', 'extension', 'binding', 'agent'
  resourceId: text('resource_id'), // stable ID to link back to the resource
  resourceLabel: text('resource_label'), // human-readable: adapter name, agent name

  // Details
  metadata: text('metadata'), // JSON blob for event-specific extra fields
  // e.g., { before: {...}, after: {...} } for config changes

  createdAt: text('created_at').notNull(), // insert time (same as occurredAt for synchronous events)
});
```

**Index recommendations:**

- `CREATE INDEX idx_activity_occurred_at ON activity_events(occurred_at DESC)` — primary sort
- `CREATE INDEX idx_activity_category ON activity_events(category)` — category filter
- `CREATE INDEX idx_activity_actor_id ON activity_events(actor_id)` — actor filter

**Event type naming convention:** `{resourceType}.{verb}` in dot notation:

- `adapter.added`, `adapter.removed`, `adapter.disconnected`
- `extension.installed`, `extension.removed`, `extension.updated`
- `binding.created`, `binding.deleted`, `binding.updated`
- `agent.registered`, `agent.removed`, `agent.status_changed`
- `system.started`, `system.config_reloaded`

---

### Unified Activity Query Strategy

The `/api/activity` endpoint merges multiple sources:

```typescript
// Conceptual server-side merge (simplified)

async function getActivityFeed(options: {
  limit: number;
  cursor?: string; // ISO timestamp for cursor-based pagination
  categories?: string[];
  actorId?: string;
  since?: string; // ISO date
}): Promise<ActivityItem[]> {
  // Source 1: activity_events table (config, system, agent-registry events)
  const configEvents = await db
    .select()
    .from(activityEvents)
    .where(/* filter */)
    .orderBy(desc(activityEvents.occurredAt))
    .limit(options.limit);

  // Source 2: pulse_runs (already stored with rich metadata)
  const pulseEvents = await db
    .select({
      id: pulseRuns.id,
      occurredAt: pulseRuns.startedAt,
      status: pulseRuns.status,
      scheduleName: pulseSchedules.name,
      trigger: pulseRuns.trigger,
    })
    .from(pulseRuns)
    .leftJoin(pulseSchedules, eq(pulseRuns.scheduleId, pulseSchedules.id))
    .where(/* filter */)
    .orderBy(desc(pulseRuns.startedAt))
    .limit(options.limit);

  // Source 3: session events — from JSONL-derived session list
  // (already available via transcript-reader; use createdAt + status)
  const sessionEvents = await sessionService.getRecentSessions({
    limit: options.limit,
    since: options.since,
  });

  // Merge + sort + paginate (in memory, bounded by limit)
  return mergeAndSort([configEvents, pulseEvents, sessionEvents], options.limit);
}
```

**Pagination strategy: cursor-based using ISO timestamp.** Because events come from multiple tables, offset-based pagination would produce inconsistent results when new events are inserted. Cursor-based (give me events older than timestamp X) is stable across inserts.

---

### API Shape

```
GET /api/activity
  ?limit=50           # items per page, max 100
  &before=ISO_TS      # cursor: events older than this timestamp
  &categories=session,pulse,config  # comma-separated filter
  &actorId=agent-id   # filter by actor
  &since=ISO_TS       # lower bound (don't go earlier than)

Response:
{
  items: ActivityItem[],
  nextCursor: string | null,  // null = no more pages
  total: number | null        // optional count (omit if expensive)
}
```

The response shape should be stable whether items come from `activity_events`, `pulse_runs`, or session JSONL. A server-side normalizer maps each source to:

```typescript
interface ActivityItem {
  id: string; // unique across all sources (prefixed by source)
  occurredAt: string; // ISO 8601
  category: ActivityCategory;
  eventType: string; // 'session.completed', 'pulse.ran_failed', etc.
  actorType: 'user' | 'agent' | 'system' | 'pulse';
  actorId?: string;
  actorLabel: string; // "researcher", "You", "Pulse"
  resourceType?: string;
  resourceId?: string;
  resourceLabel?: string;
  summary: string; // human-readable one-liner: "researcher completed (47m)"
  linkPath?: string; // e.g., "/session?session=abc&dir=..."
  metadata?: Record<string, unknown>;
}
```

---

### UI Pattern Details

#### Row Anatomy

Every activity row is a **single line** with up to 5 elements. No multi-line rows in the feed.

```
[time]  [actor badge]  [summary text]         [resource link]
2:14 PM  ● researcher   completed (47m)        Open session →
9:02 AM  ◆ Pulse        daily-digest ran OK
11:30 PM ● coder        started new session    Open session →
3 days   ⚙ You         added Telegram adapter  View adapter →
```

**Time display rules:**

- Events today: `HH:MM` (12h with am/pm for US locale, 24h otherwise)
- Events yesterday: "Yesterday 2:14 PM"
- Events this week: "Monday 2:14 PM"
- Events older: "Mar 15" or "Mar 15, 2025" (if different year)
- Hover for absolute ISO timestamp tooltip

**Actor badge:**

- `user` → neutral ghost pill "You"
- `agent` → colored dot + agent name (uses agent's `color` field from `agents` table)
- `system` → gear icon, muted
- `pulse` → clock icon, muted purple

**Summary text**: Verb-first, concise. Should fit in ~50 characters.

- ✓ "completed (47m)"
- ✓ "daily-digest ran successfully"
- ✓ "added Telegram adapter"
- ✗ "The researcher agent has completed its session after running for 47 minutes"

**Resource link**: right-aligned, subtle. Navigates to the relevant detail view.

- Sessions → `/session?session=ID`
- Pulse runs → Pulse panel with run details
- Adapters → Relay panel

#### Time Grouping

```
TODAY ─────────────────────────────────────
2:14 PM  ● researcher   completed (47m)     Open →
9:02 AM  ◆ Pulse        daily-digest ran OK

YESTERDAY ─────────────────────────────────
11:30 PM ● coder        completed (1h 12m)  Open →
8:15 AM  ⚙ You          installed Linear extension

THIS WEEK ──────────────────────────────────
Monday   ◆ Pulse        weekly-report ran OK
Monday   ● researcher   new session started

EARLIER ───────────────────────────────────
Mar 25   ⚙ You          added Slack adapter  View →
Mar 22   ● coder        session completed    Open →
[Load more]
```

Group boundary labels are sticky headers as the user scrolls. Use `position: sticky` at `top: 0` within a scroll container, or render as non-sticky section headers inside a virtual list (if virtualizing).

#### Filter Bar

Above the timeline, a horizontal chip/pill filter bar:

```
[All] [Sessions] [Pulse] [Relay] [Config] [System]    [Date range ▾] [Actor ▾]
```

- Default: "All" selected
- Category chips: toggle-style, multiple can be active simultaneously
- Date range: popover with preset ranges (Today, Yesterday, Last 7 days, Last 30 days, Custom)
- Actor: dropdown populated from seen actors in the data
- Filter state is reflected in the URL (`?categories=session,pulse&since=...`)

Active filters shown as dismissible chips below the filter bar (GitHub-style):

```
Filtered by: [Sessions ×] [researcher ×]   Clear all
```

#### Pagination: Load More

```
[Most recent 50 events shown]

    ┌─────────────────────────────┐
    │     Load 50 more events     │
    └─────────────────────────────┘

    Showing events from the last 30 days.
```

**Why not infinite scroll:**

- Kai returns after 8 hours and wants to scan what happened — orientation matters (he wants to know where in time he is)
- Infinite scroll provides no landmarks; "Load more" is explicit and predictable
- Filter + search on infinite scroll is confusing (is the filter applied to all data or loaded data?)
- NNGroup: infinite scroll is for browsing/discovery (social feeds, Pinterest), not for audit-style lists where users seek specific events

**Why not classic pagination:**

- "Page 3 of 14" is meaningless for time-based data
- Inserting new events while paginating would shift item positions
- Cursor-based "Load more" is the industry standard for activity feeds (GitHub, Linear, Vercel)

#### Empty States

| Condition                 | Content                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| No events ever            | Icon + "No activity yet. Your agent history will appear here once sessions start." |
| Filtered, no results      | "No [category] events in this time range." + "Clear filters" link                  |
| No events in last 30 days | "No activity in the last 30 days." + link to extend range                          |
| Loading initial data      | 5-row skeleton shimmer (same row anatomy as real rows)                             |

#### "Since last visit" Indicator

Track the last-visited timestamp in localStorage (`dorkos-activity-last-visited`). On load:

```
┌─ Since your last visit (8h ago) ──────────────────────────────────────┐
│ 3 sessions completed · 2 Pulse runs · 1 config change                 │
└───────────────────────────────────────────────────────────────────────┘
2:14 AM  ● researcher   completed (3h 12m)   Open →
...
```

The summary bar shows a compact digest of what happened. Events after the separator are visually distinguished (thin amber-ish left border or slightly highlighted background). After the user has scrolled past the separator, update the last-visited timestamp.

---

### Where to Instrument Write Paths

Events requiring new instrumentation (writes to `activity_events`):

**Config events** — route-level, in `apps/server/src/routes/`:

- `routes/extensions.ts`: after `POST /`, `DELETE /:id`, `PATCH /:id` → `extension.installed`, `extension.removed`, `extension.updated`
- `routes/relay.ts` (adapter routes): after adapter CRUD → `adapter.added`, `adapter.removed`, `adapter.updated`
- `routes/relay.ts` (binding routes): after binding CRUD → `binding.created`, `binding.deleted`, `binding.updated`

**Agent registry events** — in `services/mesh/` or `agents.ts` route:

- After `agent.json` file-first write → `agent.registered`, `agent.removed`
- After status change reconciliation → `agent.status_changed`

**System events** — in `apps/server/src/index.ts`:

- After server init → `system.started`

**Pattern**: A small `activityService.emit(event)` helper that inserts to `activity_events`. Make it fire-and-forget (non-blocking) — log any errors but never fail the primary operation because of an activity write failure.

```typescript
// apps/server/src/services/activity/activity-service.ts
export async function emitActivityEvent(
  event: Omit<NewActivityEvent, 'id' | 'createdAt'>
): Promise<void> {
  try {
    await db.insert(activityEvents).values({
      id: ulid(),
      createdAt: new Date().toISOString(),
      ...event,
    });
  } catch (err) {
    // Never throw — activity tracking must not block primary operations
    logger.warn('[Activity] Failed to emit activity event', { err, event });
  }
}
```

---

### Derived Source: Session Events

Sessions come from JSONL files. The `transcript-reader.ts` already knows how to read them. For the activity feed:

- **Session started**: when a session JSONL file first appears (or when `createdAt` is near `updatedAt`)
- **Session completed**: derive from `isCompleted` + the final message timestamp
- **Session long-inactivity restart**: compare `lastActivity` gap >24h to `startedAt`

The sessions query in the activity endpoint calls the existing session service, not JSONL directly. Use `GET /api/sessions` and map to `ActivityItem[]`.

---

### FSD Layer Placement

```
apps/client/src/layers/
  widgets/
    activity/
      index.ts
      ActivityPage.tsx          ← page orchestrator
      ui/
        ActivityHeader.tsx      ← title + filter bar
        ActivityTimeline.tsx    ← time-grouped list of rows
        ActivityLoadMore.tsx    ← "Load more" button + count
  features/
    activity-feed/
      model/
        use-activity-feed.ts    ← TanStack Query infinite query, cursor pagination
        activity-filters.ts     ← Zustand slice or URL state for active filters
      ui/
        ActivityRow.tsx         ← single activity row (compact, 1-line)
        ActivityGroupHeader.tsx ← "Today" / "Yesterday" sticky header
        ActivityFilterBar.tsx   ← category chips + date range + actor filter
        ActivityEmptyState.tsx
        ActivitySinceLastVisit.tsx  ← "since your last visit" digest banner
  entities/
    activity/
      model/
        activity-types.ts       ← ActivityItem interface, ActivityCategory union type
      ui/
        ActorBadge.tsx          ← colored dot + actor name
        EventTypeBadge.tsx      ← category pill (session=blue, pulse=purple, etc.)
```

**TanStack Query infinite query pattern:**

```typescript
// features/activity-feed/model/use-activity-feed.ts

export function useActivityFeed(filters: ActivityFilters) {
  return useInfiniteQuery({
    queryKey: ['activity', filters],
    queryFn: ({ pageParam }) =>
      transport.get('/api/activity', {
        params: {
          ...filters,
          before: pageParam,
          limit: 50,
        },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Activity is read-once / historical — no need to refetch constantly
    staleTime: 30_000,
    // Refetch when window regains focus (Kai comes back to DorkOS)
    refetchOnWindowFocus: true,
  });
}
```

**Conditional live updates**: When the user is viewing the "Today" group, a SSE subscription can push new events without a full refetch. Use `queryClient.setQueryData` to prepend new items. This is optional for v1 — polling on focus is sufficient.

---

### Real-Time Update Strategy

| Scenario                                     | Strategy                                                             |
| -------------------------------------------- | -------------------------------------------------------------------- |
| User has activity page open while agents run | `refetchOnWindowFocus: true` + optional SSE for new-item push        |
| User returns after hours away                | `refetchOnWindowFocus: true` handles this automatically              |
| "Since last visit" banner                    | Compute from localStorage timestamp on mount                         |
| Live config change notification              | SSE event from server, `queryClient.invalidateQueries(['activity'])` |

For v1: polling on window focus (TanStack Query's default behavior) is sufficient. SSE is additive.

---

### Color Coding for Event Categories

Consistent with the dashboard's event badge system (from `research/20260320_dashboard_content_design_patterns.md`):

| Category  | Color Token                           | Usage                      |
| --------- | ------------------------------------- | -------------------------- |
| `session` | `text-blue-500` / `bg-blue-50`        | Sessions started/completed |
| `pulse`   | `text-purple-500` / `bg-purple-50`    | Schedule runs              |
| `relay`   | `text-teal-500` / `bg-teal-50`        | Adapter/message events     |
| `agent`   | `text-indigo-500` / `bg-indigo-50`    | Agent registry changes     |
| `config`  | `text-amber-500` / `bg-amber-50`      | Extensions, bindings       |
| `system`  | `text-neutral-500` / `bg-neutral-100` | DorkOS start/stop, reloads |

Use Tailwind v4 tokens only (no hardcoded hex). Keep badge sizes minimal — small pill `text-xs px-1.5 py-0.5 rounded-sm`.

---

### Linking to Detail Views

The `linkPath` on each `ActivityItem` should route to the most contextually appropriate detail:

| Event Category          | Link Target                                        |
| ----------------------- | -------------------------------------------------- |
| Session events          | `/session?session={sessionId}&dir={cwd}`           |
| Pulse runs              | Pulse panel, filtered to the run (or URL hash)     |
| Relay adapter events    | Relay panel                                        |
| Config/extension events | Settings → Extensions panel                        |
| Config/binding events   | Settings → Bindings panel                          |
| Agent events            | `/agents` (fleet view), with the agent highlighted |
| System events           | No link (system events are informational)          |

Links render as a subtle right-aligned `Open →` or `View →` anchor. They should navigate without opening a new tab — the user is in the DorkOS SPA.

---

### Sensitivity and Privacy

DorkOS is local-first and single-user, so access control is not a concern. However, there are sensitivity considerations:

1. **Session message content**: Never store message content in `activity_events`. The summary row says "researcher completed (47m)" — not what was discussed. Full content stays in JSONL.
2. **Config secrets**: Extension secrets and adapter API keys must never appear in `metadata` JSON. Store only names and types — not values.
3. **Metadata field-level diff**: For config changes, `metadata.before`/`metadata.after` should strip credential fields before storing.
4. **Retention and cleanup**: A cleanup job (Pulse-scheduled or startup-time) prunes `activity_events` rows older than 30 days. This is a configuration option (`DORKOS_ACTIVITY_RETENTION_DAYS`, default `30`).

---

### Retention and Pruning

```typescript
// Called at server startup and/or by a scheduled Pulse job
async function pruneOldActivityEvents(daysToKeep: number = 30): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  await db.delete(activityEvents).where(lt(activityEvents.occurredAt, cutoff.toISOString()));
}
```

For derived sources (pulse_runs, relay_traces, agents), retention is governed by those tables' own policies. The activity feed query simply adds a `WHERE occurred_at > cutoff` filter when reading them.

---

## Recommendation: Overall Approach for DorkOS

**Architecture**: Hybrid — new `activity_events` table for config/system events + read-through queries on existing `pulse_runs`, `relay_traces`, and session data.

**Data model**: `ActivityItem` interface with `actor_type`, `actor_id`, `actor_label`, `category`, `event_type`, `resource_type`, `resource_id`, `resource_label`, `summary`, `link_path`, `metadata`.

**API**: Cursor-based pagination at `/api/activity`, merge-sort across sources server-side, filter by category/actor/date-range.

**UI**: Reverse-chronological, time-grouped (Today/Yesterday/This Week/Older), load-more pagination, filter bar, compact single-line rows, "since last visit" digest banner.

**Instrumentation priority** (implement in order):

1. Config events (extensions, bindings, adapters) — these have no other storage home and are highest value for understanding "what changed"
2. Session events — derive from existing session service (low implementation cost)
3. Pulse run events — derive from `pulse_runs` table (already rich with metadata)
4. Agent registry events — instrument the agent write paths
5. Relay events — derive from `relay_traces`
6. System events — instrument `index.ts` startup

**What makes this world-class for Kai:**

- He opens DorkOS at 8am, sees "Since your last visit (8h): 3 sessions completed · 2 Pulse runs"
- He can filter to just sessions, see each one with a direct "Open →" link
- Config changes (he added an adapter last week) are visible without reading logs
- Each row is one line — he can scan 30 events in 20 seconds
- The page doesn't require him to understand event sourcing or log formats

**What is explicitly excluded from v1:**

- Real-time push updates to the activity page (refetch-on-focus is sufficient)
- Per-event comments or annotations
- Activity export (CSV/JSON) — add in v2
- Search by free text — add in v2 (index `summary` field)
- Agent-to-agent attribution (which agent triggered another) — complex, v2

---

## Research Gaps and Limitations

- **Session "long inactivity" detection**: The spec mentions "sessions started after long inactivity" as an event. The definition of "long" needs a product decision. Research suggests >24 hours for agent activity (vs. <2h for "recently active" on the dashboard). This should be a configurable threshold.
- **Multi-source merge performance**: The server-side merge of multiple data sources is bounded by `limit` but involves N separate DB queries. For v1 with small data volumes this is fine. If activity volumes grow, a materialized view or periodic batch denormalization may be needed.
- **JSONL session read path**: The activity endpoint needs to call the existing session service to get session events. The exact API surface (`transcript-reader.ts` vs `session service`) should be clarified during implementation.
- **Exact pagination cursor shape**: The cursor needs to be deterministic when multiple events have the same `occurred_at` millisecond. A compound cursor (timestamp + id) may be needed. This is a common problem with cursor pagination on non-unique timestamps.

---

## Contradictions and Disputes

- **Load more vs. infinite scroll**: Most social-app research favors infinite scroll for engagement. DorkOS's use case is the opposite — a user revisiting history after a known absence, not browsing to discover. NNGroup's guidance is clear: infinite scroll for browsing, pagination for task-oriented history review. Load more is the right choice.
- **Event sourcing for audit logs**: The event-sourcing community argues that event sourcing is the "correct" foundation for audit logs. This is architecturally true but operationally overkill for a local tool. The audit log community (Infisical, EnterpriseReady) recommends a simpler append-only table approach, which is what DorkOS should use.
- **Derive from existing vs. new writes**: The hybrid approach means the activity feed can have gaps if an existing service fails to produce data (e.g., a session JSONL is corrupted). Full duplication would be more reliable but wastes storage and creates sync risk. The hybrid approach is correct for DorkOS's scale.

---

## Sources and Evidence

- [Audit Logging for Internal Tools: Clean Change History Patterns — AppMaster](https://appmaster.io/blog/audit-logging-internal-tools-activity-feed) — actor_type differentiation, field-level diff storage, coverage failure patterns
- [Enterprise Ready SaaS App Guide to Audit Logging — EnterpriseReady](https://www.enterpriseready.io/features/audit-log/) — actor/group/where/when/target/action schema, immutability requirement, NTP-synced timestamps
- [Building Event Sourcing Systems with SQLite: CQRS Guide — SQLite Forum](https://www.sqliteforum.com/p/building-event-sourcing-systems-with) — SQLite append-only table schema, event_id/aggregate_type/event_type/created_at pattern, optimistic concurrency
- [Is the Audit Log a Proper Architecture Driver for Event Sourcing? — Event-Driven.io](https://event-driven.io/en/audit_log_event_sourcing/) — why event sourcing and audit logs are related but distinct; audit logs don't require full ES
- [Activity Feeds: Architecture, Data Models, and Design Patterns — GetStream.io](https://getstream.io/blog/activity-feed-design/) — actor→verb→object→target model, aggregated vs flat feeds, zero-state design
- [A Guide to Designing Chronological Activity Feeds — Aubergine](https://www.aubergine.co/insights/a-guide-to-designing-chronological-activity-feeds) — row anatomy (avatar, icon, description, timestamp, location), lazy loading, scalable architecture
- [Infinite Scrolling: When to Use It, When to Avoid It — Nielsen Norman Group](https://www.nngroup.com/articles/infinite-scrolling-tips/) — scroll for browsing/discovery, pagination for task-oriented history; orientation loss in infinite scroll
- [React TanStack Virtual Infinite Scroll Example — TanStack Virtual Docs](https://tanstack.com/virtual/latest/docs/framework/react/examples/infinite-scroll) — `useInfiniteQuery` + TanStack Virtual integration pattern
- [Using the Activity Log — Vercel Docs](https://vercel.com/docs/activity-log) — Vercel's event taxonomy (user involved, event type, account type, time); CLI-queryable; hover for exact timestamp
- [Activity Log Now Tracks 100% of Team and Project Changes — Vercel Changelog](https://vercel.com/changelog/activity-log-now-tracks-100-of-team-and-project-changes) — what events are captured in a production activity log
- [Feed Activity Is Now Sorted Chronologically — GitHub Changelog](https://github.blog/changelog/2025-02-14-reverting-feed-activity-sorting-back-to-chronological-ordering/) — GitHub's explicit decision to revert to chronological (not algorithmic) sorting for developer activity feeds
- [DorkOS Dashboard Content Design Patterns — Prior Research](research/20260320_dashboard_content_design_patterns.md) — time-grouping (Today/Yesterday/Last 7 days), event type color badges, aggregation rules, "since last visit" detection, capped result sets
- [Subagent Activity & Streaming UI Patterns — Prior Research](research/20260316_subagent_activity_streaming_ui_patterns.md) — tool call categorization, actor attribution, collapsible summary patterns
- [DorkOS Logging System Code Review — Prior Research](research/20260301_logging_review.md) — existing `~/.dork/logs/` path, consola NDJSON file reporter, existing server infrastructure
- [AI-Parseable Log Design — Prior Research](research/20260301_ai_parseable_logging.md) — NDJSON field schema with `event` stable-type field for AI-consumable analysis

---

## Search Methodology

- Searches performed: 12
- Most productive search terms: `"audit log" "actor_type" "resource_type" SQLite activity events schema`, `"activity feed" design chronological grouping timeline developer tool`, `TanStack Query infinite query cursor pagination activity feed`, `Vercel activity log event types CLI`
- Primary source categories: Prior DorkOS research (highest value), Enterprise audit log guides (schema/data model), UX research (NNGroup for pagination decision), TanStack docs (implementation), Vercel docs (production reference)
