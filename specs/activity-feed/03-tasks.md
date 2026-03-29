# Task Breakdown: Activity Feed

Generated: 2026-03-29
Source: specs/activity-feed/02-specification.md
Last Decompose: 2026-03-29

## Overview

A consolidated activity feed at `/activity` that shows what happened across the DorkOS instance — Pulse runs, Relay events, agent registry changes, config mutations, and system events. Each row attributes the action to an actor (user, agent, or system) and links to the relevant detail view. The primary use case is Kai opening DorkOS after 8 hours away and scanning "what did my agents do while I slept?" in 20 seconds.

The implementation spans 4 phases: Data Layer (server schema, service, route, transport), Instrumentation (emit calls across all subsystems), Client UI (entities, features, widgets, routing), and Polish (animations, skeletons, keyboard nav).

---

## Phase 1: Data Layer (Server)

### Task 1.1: Create activity_events Drizzle schema and migration

**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.2

Create the `activity_events` SQLite table schema in `packages/db/src/schema/activity.ts` using Drizzle ORM. The table is append-only with ULID primary keys, ISO 8601 timestamps, actor/category enums, dot-notation event types, and JSON metadata. Three indexes on `occurred_at`, `category`, and `actor_type`. Export from the schema barrel and generate the Drizzle migration.

**Acceptance Criteria**:

- [ ] `packages/db/src/schema/activity.ts` exists with full table definition
- [ ] `packages/db/src/schema/index.ts` re-exports `./activity.js`
- [ ] Migration SQL file generated in `packages/db/drizzle/`
- [ ] `pnpm typecheck --filter=@dorkos/db` passes

---

### Task 1.2: Create shared Zod schemas and types in packages/shared

**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1

Create `packages/shared/src/activity-schemas.ts` with Zod schemas for `ActivityItem`, `ListActivityQuery` (with coerced `limit`, comma-separated `categories`), and `ListActivityResponse`. Export types and schemas via the shared package barrel or subpath.

**Acceptance Criteria**:

- [ ] `packages/shared/src/activity-schemas.ts` exists with all schemas
- [ ] Types importable from `@dorkos/shared`
- [ ] `ListActivityQuerySchema.parse({ limit: '25' })` returns `{ limit: 25 }`
- [ ] `ListActivityQuerySchema.parse({})` returns `{ limit: 50 }`
- [ ] `pnpm typecheck --filter=@dorkos/shared` passes

---

### Task 1.3: Create ActivityService with emit, list, and prune methods

**Size**: Medium
**Priority**: High
**Dependencies**: 1.1, 1.2
**Can run parallel with**: None

Create `apps/server/src/services/activity/activity-service.ts` with three methods: `emit()` (fire-and-forget, never throws), `list()` (cursor-based pagination with category/actor/time filters), and `prune()` (retention-based deletion). Includes 12 test scenarios covering insert, error handling, pagination, filtering, and pruning.

**Acceptance Criteria**:

- [ ] `ActivityService` class exists with `emit()`, `list()`, `prune()` methods
- [ ] `emit()` catches all errors internally and logs warnings
- [ ] `list()` uses cursor-based pagination with `limit + 1` detection
- [ ] `prune()` deletes events older than configured retention period
- [ ] All 12 test scenarios pass
- [ ] `pnpm typecheck --filter=@dorkos/server` passes

---

### Task 1.4: Create activity route and mount at /api/activity

**Size**: Medium
**Priority**: High
**Dependencies**: 1.3
**Can run parallel with**: None

Create `apps/server/src/routes/activity.ts` with `GET /` endpoint, mount at `/api/activity`. Wire `ActivityService` into `index.ts` with DB construction, startup pruning (configurable via `DORKOS_ACTIVITY_RETENTION_DAYS`), and `app.locals` storage for instrumentation access. Includes 4 route test scenarios.

**Acceptance Criteria**:

- [ ] Route mounted at `/api/activity`
- [ ] `ActivityService` instantiated with DB in `index.ts`
- [ ] Startup pruning runs with configurable retention days
- [ ] `activityService` stored on `app.locals`
- [ ] All 4 route tests pass
- [ ] `pnpm typecheck --filter=@dorkos/server` passes

---

### Task 1.5: Add listActivityEvents to Transport interface and implement in HttpTransport

**Size**: Medium
**Priority**: High
**Dependencies**: 1.2
**Can run parallel with**: None

Extend the `Transport` interface with `listActivityEvents(query?)`. Implement in `HttpTransport` as `GET /api/activity` with query param serialization. Implement in `DirectTransport` as direct service delegation.

**Acceptance Criteria**:

- [ ] `Transport` interface includes `listActivityEvents` method
- [ ] `HttpTransport` implements with proper query param serialization
- [ ] `DirectTransport` implements with direct service delegation
- [ ] `pnpm typecheck` passes across all packages

---

## Phase 2: Instrumentation (Server)

All Phase 2 tasks can run in parallel. Each depends only on Task 1.4.

### Task 2.1: Instrument Pulse subsystem with activity events

**Size**: Medium
**Priority**: Medium
**Dependencies**: 1.4
**Can run parallel with**: 2.2, 2.3, 2.4, 2.5, 2.6

Add `activityService.emit()` calls for: run completion (`pulse.ran_success`/`pulse.ran_failed`), schedule creation/deletion/pause, and run cancellation. Includes a `formatDuration` helper for human-readable durations.

**Acceptance Criteria**:

- [ ] 5 event types instrumented: `ran_success`, `ran_failed`, `schedule_created`, `schedule_deleted`, `schedule_paused`, `ran_cancelled`
- [ ] No Pulse operation blocked by activity emission

---

### Task 2.2: Instrument Relay subsystem with activity events

**Size**: Medium
**Priority**: Medium
**Dependencies**: 1.4
**Can run parallel with**: 2.1, 2.3, 2.4, 2.5, 2.6

Add `activityService.emit()` calls for: adapter CRUD (`relay.adapter_added`/`removed`), connection lifecycle (`relay.adapter_connected`/`disconnected`), and message delivery/failure (`relay.message_delivered`/`relay.message_failed`).

**Acceptance Criteria**:

- [ ] 6 event types instrumented across adapter lifecycle and message delivery
- [ ] No Relay operation blocked by activity emission

---

### Task 2.3: Instrument Mesh agent registry with activity events

**Size**: Small
**Priority**: Medium
**Dependencies**: 1.4
**Can run parallel with**: 2.1, 2.2, 2.4, 2.5, 2.6

Add `activityService.emit()` calls for: agent registration (`agent.registered`), removal (`agent.removed`), and status change (`agent.status_changed`). Status change only emits on actual transitions.

**Acceptance Criteria**:

- [ ] 3 event types instrumented: `registered`, `removed`, `status_changed`
- [ ] Status change only emits on actual transitions

---

### Task 2.4: Instrument Extensions with activity events

**Size**: Small
**Priority**: Medium
**Dependencies**: 1.4
**Can run parallel with**: 2.1, 2.2, 2.3, 2.5, 2.6

Add `activityService.emit()` calls for: extension install (`config.extension_installed`), removal (`config.extension_removed`), and update (`config.extension_updated`). Guard with `if (activityService)` check.

**Acceptance Criteria**:

- [ ] 3 event types instrumented: `extension_installed`, `extension_removed`, `extension_updated`
- [ ] Emit calls guarded for safety

---

### Task 2.5: Instrument Bindings with activity events

**Size**: Small
**Priority**: Medium
**Dependencies**: 1.4
**Can run parallel with**: 2.1, 2.2, 2.3, 2.4, 2.6

Add `activityService.emit()` calls for: binding creation (`config.binding_created`), deletion (`config.binding_deleted`), and update (`config.binding_updated`). Summary includes subject and adapter name.

**Acceptance Criteria**:

- [ ] 3 event types instrumented: `binding_created`, `binding_deleted`, `binding_updated`
- [ ] Summary text includes both subject and adapter name

---

### Task 2.6: Instrument system startup with activity event

**Size**: Small
**Priority**: Medium
**Dependencies**: 1.4
**Can run parallel with**: 2.1, 2.2, 2.3, 2.4, 2.5

Emit `system.started` event after all server initialization completes. Optionally emit `system.config_reloaded` on config reload.

**Acceptance Criteria**:

- [ ] `system.started` event emitted after server startup
- [ ] Server startup not blocked if emit fails

---

## Phase 3: Client UI

### Task 3.1: Create entities/activity with ActorBadge and CategoryBadge components

**Size**: Medium
**Priority**: High
**Dependencies**: 1.2
**Can run parallel with**: 3.2

Create the activity entity layer: `activity-types.ts` (re-exports + display config maps for categories and actors), `ActorBadge.tsx` (colored dot/icon + label per actor type), `CategoryBadge.tsx` (colored pill per category), and barrel `index.ts`. Includes ActorBadge tests.

**Acceptance Criteria**:

- [ ] All files under `entities/activity/` with correct structure
- [ ] `ActorBadge` renders correct icon/dot per actor type
- [ ] `CategoryBadge` renders with correct color classes per category
- [ ] Tests pass for ActorBadge
- [ ] FSD layer imports only from `shared`

---

### Task 3.2: Create features/activity-feed-page hooks and time-grouping utility

**Size**: Large
**Priority**: High
**Dependencies**: 1.2, 1.5
**Can run parallel with**: 3.1

Create four model files: `useFullActivityFeed` (infinite query with cursor pagination), `useActivityFilters` (URL search param filter management), `useLastVisitedActivity` (localStorage timestamp tracking), and `groupByTime` (Today/Yesterday/This Week/Earlier grouping). Includes comprehensive time-grouping tests and hook tests.

**Acceptance Criteria**:

- [ ] All four model files exist under `features/activity-feed-page/model/`
- [ ] `useFullActivityFeed` returns infinite query with correct pagination
- [ ] `useActivityFilters` reads/writes URL search params
- [ ] `useLastVisitedActivity` tracks visit time via localStorage
- [ ] `groupByTime` correctly groups items
- [ ] All time-grouping tests pass

---

### Task 3.3: Create activity feed UI components

**Size**: Large
**Priority**: High
**Dependencies**: 3.1, 3.2
**Can run parallel with**: None

Create 5 UI components: `ActivityRow` (compact one-line with time/actor/summary/link), `ActivityGroupHeader` (sticky time group label), `ActivityFilterBar` (category toggle chips + clear), `ActivitySinceLastVisit` (digest banner with category counts), `ActivityEmptyState` (no-events and filtered-no-results states). Create barrel `index.ts`.

**Acceptance Criteria**:

- [ ] All 5 UI components exist under `features/activity-feed-page/ui/`
- [ ] Barrel exports all hooks, utility, and UI components
- [ ] FSD layer imports only from `entities` and `shared`

---

### Task 3.4: Create widgets/activity with ActivityPage, ActivityHeader, and ActivityTimeline

**Size**: Large
**Priority**: High
**Dependencies**: 3.3
**Can run parallel with**: None

Create the widget layer: `ActivityPage` (page orchestrator composing header, digest banner, timeline, load-more), `ActivityHeader` (title + filter bar), `ActivityTimeline` (time-grouped rows). Includes skeleton loading state and page-level tests.

**Acceptance Criteria**:

- [ ] All widget files under `widgets/activity/`
- [ ] `ActivityPage` composes all sub-components correctly
- [ ] Skeleton loading renders 5 rows matching real anatomy
- [ ] Empty state renders appropriately
- [ ] Load-more button fetches next page

---

### Task 3.5: Add /activity route, sidebar navigation, and dashboard link update

**Size**: Medium
**Priority**: High
**Dependencies**: 3.4
**Can run parallel with**: None

Three changes: (1) Add `/activity` route with `activitySearchSchema` validation to `router.tsx`, (2) Add Activity nav item with `Activity` icon between Dashboard and Agents in `DashboardSidebar.tsx`, (3) Change `RecentActivityFeed.tsx` "View all" from `/session` to `/activity`.

**Acceptance Criteria**:

- [ ] `/activity` route renders ActivityPage
- [ ] Activity search params validated by route
- [ ] Sidebar shows Activity between Dashboard and Agents
- [ ] Dashboard "View all" navigates to `/activity`
- [ ] All existing tests pass
- [ ] `pnpm typecheck --filter=@dorkos/client` passes

---

## Phase 4: Polish

All Phase 4 tasks can run in parallel. Each depends only on Task 3.4.

### Task 4.1: Add motion animations for list items and banner transitions

**Size**: Small
**Priority**: Low
**Dependencies**: 3.4
**Can run parallel with**: 4.2, 4.3

Add staggered entry animations (fade + slide, 30ms stagger, 150ms duration) to timeline rows. Add chip transition for filter bar. Verify digest banner animation. Add fade-in for load-more button.

**Acceptance Criteria**:

- [ ] Activity rows animate with staggered fade + slide
- [ ] Animations under 300ms, subtle and non-distracting
- [ ] No layout shift or janky transitions

---

### Task 4.2: Add skeleton loading states for initial load

**Size**: Small
**Priority**: Low
**Dependencies**: 3.4
**Can run parallel with**: 4.1, 4.3

Refine skeleton to use `React.useId()` for deterministic widths (no `Math.random()`). Add group header skeleton. Enhance load-more loading indicator.

**Acceptance Criteria**:

- [ ] Skeleton rows have same visual structure as real rows
- [ ] Uses `React.useId()` for deterministic widths
- [ ] Load-more shows clear loading indicator

---

### Task 4.3: Add keyboard navigation for activity rows

**Size**: Small
**Priority**: Low
**Dependencies**: 3.4
**Can run parallel with**: 4.1, 4.2

Create `useActivityKeyboardNav` hook for Arrow Up/Down row navigation, Enter to open link, Escape to clear focus. Add `tabIndex={0}` and `data-activity-row` to rows. Use `focus-visible:ring-2` for keyboard focus styles.

**Acceptance Criteria**:

- [ ] Arrow Up/Down moves focus between rows
- [ ] Enter navigates to row's linkPath
- [ ] Escape clears row focus
- [ ] Focus state uses `focus-visible:ring-2`
- [ ] Rows have `tabIndex={0}` for accessibility

---

## Dependency Graph

```
Phase 1:
  1.1 ─┬──→ 1.3 ──→ 1.4 ──→ Phase 2 (all tasks parallel)
  1.2 ─┤         ↗
       ├──→ 1.5 ─┘
       └──→ 3.1 (parallel with 3.2)

Phase 3:
  3.1 ─┬──→ 3.3 ──→ 3.4 ──→ 3.5
  3.2 ─┘                ↘──→ Phase 4 (all tasks parallel)

Phase 4:
  4.1, 4.2, 4.3 (all parallel, depend on 3.4)
```

## Parallel Opportunities

- **Batch 1**: Tasks 1.1 and 1.2 (schema + shared types, no dependencies)
- **Batch 2**: Tasks 3.1 and 3.2 (entity layer + feature hooks, independent)
- **Batch 3**: All Phase 2 tasks (2.1-2.6, all depend only on 1.4)
- **Batch 4**: All Phase 4 tasks (4.1-4.3, all depend only on 3.4)

## Critical Path

1.1 → 1.3 → 1.4 → 3.3 (needs 3.1 + 3.2) → 3.4 → 3.5
