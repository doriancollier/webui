---
slug: activity-feed
number: 210
created: 2026-03-29
status: ideation
---

# Activity Feed

**Slug:** activity-feed
**Author:** Claude Code
**Date:** 2026-03-29

---

## 1) Intent & Assumptions

- **Task brief:** Create a consolidated activity feed at `/activity` showing what agents, tasks, and config changes have been happening — giving Kai a "what did my agents do while I slept?" answer, and giving Priya a persistent audit trail she can review from any client. Each row links to detail views and attributes the action to an actor (agent, user, or system).
- **Assumptions:**
  - Activity data is stored in a single `activity_events` SQLite table, written at point of mutation by each subsystem
  - Session activity is excluded from v1 (sessions live in SDK-managed JSONL files, not SQLite)
  - This is a read-only view — no actions from the feed itself (no undo, no commenting)
  - Activity is local to the DorkOS instance — no cross-instance aggregation
  - The existing dashboard `RecentActivityFeed` becomes a teaser that links to `/activity` via "View all"
- **Out of scope:**
  - Session events in the activity feed (v2 — requires either JSONL instrumentation or a session metadata table)
  - Real-time SSE push to the activity page (v1 uses `refetchOnWindowFocus`)
  - Activity export (CSV/JSON)
  - Free-text search over activity events
  - Agent-to-agent attribution (which agent triggered another)
  - Per-event comments or annotations

## 2) Pre-reading Log

- `apps/client/src/layers/features/dashboard-activity/ui/RecentActivityFeed.tsx`: Existing dashboard-embedded activity feed; shows 20 capped events from sessions and Pulse runs, time-grouped by Today/Yesterday/Last 7 days, with "View all" link to `/session` page.
- `apps/client/src/layers/features/dashboard-activity/model/use-activity-feed.ts`: Hook that aggregates sessions and Pulse runs from last 7 days; defines `ActivityEvent` type with `id, type ('session'|'pulse'|'relay'|'mesh'|'system'), timestamp, title, link?`.
- `apps/client/src/layers/features/dashboard-activity/ui/ActivityFeedItem.tsx`: Single event row component with type dot, label, title, timestamp, and optional link button. Supports `isNew` styling for events since last visit.
- `apps/server/src/routes/events.ts`: Unified SSE stream endpoint (`GET /api/events`) using `EventFanOut` singleton for multiplexed event broadcasting.
- `apps/server/src/services/core/event-fan-out.ts`: In-process broadcaster managing SSE client set and distributing events via `broadcast(eventName, data)` method.
- `apps/client/src/router.tsx`: TanStack Router config with routes: `/` (dashboard), `/session` (chat), `/agents` (fleet).
- `apps/server/src/services/core/config-manager.ts`: Persistent config at `~/.dork/config.json` via `conf` library; handles user settings, adapter bindings, extension config.
- `packages/db/src/schema/pulse.ts`: Drizzle schema for `pulseSchedules` and `pulseRuns` tables; runs track `scheduleId, status, startedAt, finishedAt, durationMs, output, error, sessionId, trigger ('scheduled'|'manual'|'agent'), createdAt`.
- `packages/db/src/schema/relay.ts`: Drizzle schema for `relay_index` and `relay_traces` tables; traces track delivery telemetry.
- `packages/db/src/schema/mesh.ts`: Drizzle schema for `agents` table with `name, runtime, projectPath, status, color, icon, lastSeenAt, lastSeenEvent`.
- `apps/server/src/services/extensions/extension-manager.ts`: Facade for extension lifecycle: discovery, compilation, server-side init/shutdown.
- `specs/dashboard-content/02-specification.md`: Dashboard spec establishing four sections including `RecentActivityFeed`. References extending `useActivityFeed()` to track relay/mesh events.
- `decisions/0162-client-side-activity-feed-aggregation.md`: ADR establishing that the dashboard activity feed is client-side aggregated from existing entity caches.
- `contributing/architecture.md`: Hexagonal architecture with Transport abstraction; sessions derive from SDK JSONL files; agent.json is file-first with SQLite cache.
- `research/20260320_dashboard_content_design_patterns.md`: Activity feed patterns for the dashboard, time grouping, event taxonomy, "what happened while you were away" detection.
- `research/20260316_subagent_activity_streaming_ui_patterns.md`: Collapsible blocks, tool call summary formats, actor attribution patterns.
- `research/20260329_activity_feed_architecture_ui_patterns.md`: Comprehensive research on architecture approaches, data model, UI patterns, and event taxonomy for DorkOS activity feed.

## 3) Codebase Map

**Primary Components/Modules:**

- `apps/client/src/layers/features/dashboard-activity/` — Existing dashboard mini-feed (model + UI). Will be updated to link "View all" to `/activity` instead of `/session`.
- `apps/server/src/routes/events.ts` — Unified SSE endpoint. Can broadcast new activity events for optional real-time updates (v2).
- `apps/server/src/services/core/event-fan-out.ts` — SSE multiplexer singleton.
- `packages/db/src/schema/` — Drizzle schemas for `pulse`, `relay`, `mesh`, `a2a`. New `activity.ts` schema file will be added here.
- `apps/server/src/routes/` — Server routes where activity-emitting instrumentation will be added (extensions, relay, mesh).
- `apps/client/src/router.tsx` — TanStack Router config; needs new `/activity` route.

**Shared Dependencies:**

- Zustand (UI state: filter bar, last-visited timestamp)
- TanStack Query (server state: `useInfiniteQuery` for paginated activity feed)
- TanStack Router (new `/activity` route)
- Drizzle ORM (new `activity_events` table)
- Motion (animations for list transitions, "since last visit" banner)
- shadcn/ui (filter chips, buttons, skeleton loaders)

**Data Flow:**

```
Mutation (config change, pulse run, adapter toggle, agent register, etc.)
  → Service/Route handler performs primary operation
  → Fire-and-forget: activityService.emit({ category, eventType, actor, resource, summary })
  → INSERT INTO activity_events

Activity Page Load:
  → GET /api/activity?limit=50&before=cursor&categories=...
  → SELECT FROM activity_events WHERE ... ORDER BY occurred_at DESC LIMIT 50
  → Response: { items: ActivityItem[], nextCursor: string | null }
  → Client: useInfiniteQuery → time-grouped rendering → "Load more" pagination
```

**Potential Blast Radius:**

- **New files:** ~15 (schema, migration, service, route, client widget + features)
- **Modified files:** ~8 (router.tsx, sidebar navigation, dashboard "View all" link, + 5-6 server routes for instrumentation)
- **No breaking changes** — purely additive feature

## 4) Root Cause Analysis

N/A — this is a new feature, not a bug fix.

## 5) Research

Full research report: `research/20260329_activity_feed_architecture_ui_patterns.md`

**Architecture approaches evaluated:**

1. **Full Event Sourcing** — All state changes as immutable events. Overkill for a local single-user tool; requires rewriting all existing write paths. Not recommended.
2. **Derived Activity Table** — New `activity_events` table, populated by hooks at point of mutation. Simple to query, append-only. Recommended foundation.
3. **File-Based Activity Log** — Append to JSONL. No indexed queries, hard to paginate. Already have NDJSON logs. Not recommended.
4. **Hybrid (Derive + New Table)** — Derive session/pulse events from existing tables, new table for config/system. Evaluated but rejected in favor of single-table simplicity.

**UI patterns researched:**

- Time grouping (Today/Yesterday/This Week/Older) — industry standard for activity feeds
- Load more vs. infinite scroll — Load more wins for audit-style history review (NNGroup)
- Compact single-line rows — actor badge + summary + resource link
- "Since last visit" digest banner — directly serves Kai's "what happened overnight" use case
- Filter bar with category/actor/date range chips

**Sources:** 15 external sources + 5 existing DorkOS research reports. See research report for full bibliography.

**Recommendation:** Single `activity_events` table with write-on-mutation instrumentation. All subsystems write lightweight summary rows. One table, one query, simple cursor pagination. Session events deferred to v2.

## 6) Decisions

| #   | Decision                | Choice                                                     | Rationale                                                                                                                                                                                                                                                |
| --- | ----------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Data architecture       | Single `activity_events` table, write-on-mutation          | Simplest query model — one table, one index, standard cursor pagination. Avoids multi-source merge-sort complexity of hybrid approach. Slight data overlap with `pulse_runs`/`relay_traces` is acceptable since activity rows are lightweight summaries. |
| 2   | Session events in v1    | Excluded                                                   | Sessions live in SDK-managed JSONL files, not SQLite. Including them would require either JSONL instrumentation or a session metadata table — better as a focused v2 follow-up.                                                                          |
| 3   | Navigation placement    | Top-level sidebar item between Dashboard and Agents        | Activity is a primary surface Kai checks daily. Dashboard's `RecentActivityFeed` becomes a teaser linking to `/activity` via "View all."                                                                                                                 |
| 4   | Pagination strategy     | Cursor-based "Load more" button                            | Load more preserves orientation (NNGroup) — critical for Kai scanning 8 hours of agent activity. Cursor-based (timestamp + id) is stable across concurrent inserts.                                                                                      |
| 5   | Real-time updates in v1 | `refetchOnWindowFocus` only                                | TanStack Query's default behavior is sufficient. SSE push is additive for v2.                                                                                                                                                                            |
| 6   | Retention               | 30 days, configurable via `DORKOS_ACTIVITY_RETENTION_DAYS` | Activity events are user-facing history, not operational logs. 30 days covers "what happened last month" without unbounded growth. Pruned at server startup or by Pulse job.                                                                             |
| 7   | Visual design           | To be worked out with visual companion during spec phase   | User requested visual companion for interface design. Defer to `/ideate-to-spec` where mockups can be iterated.                                                                                                                                          |

### Event Taxonomy

| Category | Events                                                                                                                                                             | Instrumentation Point                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `pulse`  | `pulse.ran_success`, `pulse.ran_failed`, `pulse.ran_cancelled`, `pulse.schedule_created`, `pulse.schedule_deleted`, `pulse.schedule_paused`                        | `routes/pulse.ts` after run completion; `routes/schedules.ts` after CRUD |
| `relay`  | `relay.adapter_added`, `relay.adapter_removed`, `relay.adapter_connected`, `relay.adapter_disconnected`, `relay.message_delivered`, `relay.message_failed`         | `routes/relay.ts` after adapter/message mutations                        |
| `agent`  | `agent.registered`, `agent.removed`, `agent.status_changed`                                                                                                        | `routes/agents.ts` and mesh service after registry mutations             |
| `config` | `config.extension_installed`, `config.extension_removed`, `config.extension_updated`, `config.binding_created`, `config.binding_deleted`, `config.binding_updated` | `routes/extensions.ts` and `routes/relay.ts` (binding routes) after CRUD |
| `system` | `system.started`, `system.config_reloaded`                                                                                                                         | `apps/server/src/index.ts` after init                                    |

### Actor Model

| Actor Type | Display                            | Examples                                                  |
| ---------- | ---------------------------------- | --------------------------------------------------------- |
| `user`     | "You" (neutral ghost pill)         | Human at keyboard — config changes, manual pulse triggers |
| `agent`    | Agent name + colored dot           | Named agent that triggered an action                      |
| `system`   | "System" (gear icon, muted)        | Server startup, auto-reconnect                            |
| `pulse`    | "Pulse" (clock icon, muted purple) | Scheduled pulse run execution                             |

### Data Model

```typescript
// packages/db/src/schema/activity.ts
activityEvents = sqliteTable('activity_events', {
  id: text('id').primaryKey(), // ULID
  occurredAt: text('occurred_at').notNull(), // ISO 8601
  actorType: text('actor_type').notNull(), // 'user' | 'agent' | 'system' | 'pulse'
  actorId: text('actor_id'), // agent id, schedule id, 'user', 'system'
  actorLabel: text('actor_label'), // "researcher", "You", "Pulse"
  category: text('category').notNull(), // 'pulse' | 'relay' | 'agent' | 'config' | 'system'
  eventType: text('event_type').notNull(), // 'adapter.added', 'pulse.ran_success', etc.
  resourceType: text('resource_type'), // 'adapter', 'extension', 'schedule', 'agent'
  resourceId: text('resource_id'), // stable ID for linking
  resourceLabel: text('resource_label'), // human-readable name
  summary: text('summary').notNull(), // one-liner: "daily-digest ran successfully"
  linkPath: text('link_path'), // e.g., "/agents"
  metadata: text('metadata'), // JSON blob for event-specific details
  createdAt: text('created_at').notNull(), // insert time
});
```

### UI Structure (FSD Layers)

```
apps/client/src/layers/
  widgets/
    activity/
      ActivityPage.tsx           ← page orchestrator
      ui/
        ActivityHeader.tsx       ← title + filter bar
        ActivityTimeline.tsx     ← time-grouped list of rows
        ActivityLoadMore.tsx     ← "Load more" button + count
  features/
    activity-feed-page/
      model/
        use-full-activity-feed.ts   ← TanStack Query useInfiniteQuery
        activity-filters.ts          ← URL search param state for filters
      ui/
        ActivityRow.tsx              ← single compact row
        ActivityGroupHeader.tsx      ← "Today" / "Yesterday" sticky header
        ActivityFilterBar.tsx        ← category chips + date range + actor
        ActivityEmptyState.tsx
        ActivitySinceLastVisit.tsx   ← "since your last visit" digest banner
  entities/
    activity/
      model/
        activity-types.ts            ← ActivityItem interface, categories
      ui/
        ActorBadge.tsx               ← colored dot + actor name
        CategoryBadge.tsx            ← category pill with color
```

### API Shape

```
GET /api/activity
  ?limit=50              # items per page, max 100
  &before=<cursor>       # ISO timestamp cursor for pagination
  &categories=pulse,relay,config  # comma-separated filter
  &actorId=<agent-id>    # filter by actor
  &since=<ISO_TS>        # lower bound date

Response: {
  items: ActivityItem[],
  nextCursor: string | null
}
```
