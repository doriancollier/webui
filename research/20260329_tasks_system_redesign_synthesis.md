---
title: 'Tasks System Redesign — Synthesis and Implementation Plan'
date: 2026-03-29
type: internal-architecture
status: active
tags: [tasks, pulse, redesign, damon, file-based, db-migration, tasks-page, rename]
feature_slug: tasks-system-redesign
searches_performed: 0
sources_count: 8
---

# Tasks System Redesign — Synthesis and Implementation Plan

**Date:** 2026-03-29
**Linear issues:** DOR-59 (file-based tasks), DOR-60 (Damon background agent), plus the broader redesign
**Research mode:** Synthesis (no new web searches — all from existing research + codebase inspection)
**Codebase version:** post-5a0d7e21

---

## Research Summary

Two deep research reports (DOR-59, DOR-60) have already resolved the major architectural questions for this redesign. This document synthesizes those findings with the original brief and a live codebase inspection to produce a complete gap analysis and sequenced implementation plan.

The "what" is fully decided. The "how we execute it" has six remaining gaps — each with a clear recommended approach.

---

## 1. What Is Already Decided

### From DOR-59 (File-Based Task Definitions)

- **Files are source of truth.** `.dork/tasks/*.md` files are authoritative; the DB (`pulse_schedules`) is a derived cache. This mirrors ADR-0043 for agents.
- **Frontmatter schema is specified.** `name` (required), `description`, `cron`, `timezone`, `agent`, `enabled`, `maxRuntime`, `permissions`, `tags`, and `cwd` (global tasks only). The markdown body is the prompt.
- **File IDs are derived from filenames.** `daily-health-check.md` → ID `daily-health-check`. Kebab-case enforced.
- **Zod schema is written.** `TaskFrontmatterSchema` with `TaskDefinition` interface — ready to implement.
- **Sync architecture is specified.** Chokidar watcher for real-time + 5-min reconciler as safety net. Identical pattern to agent reconciler.
- **Write path is file-first.** API writes `.md` file first; chokidar triggers DB upsert. Never write DB directly for task definitions.
- **Conflict resolution is defined.** File always wins. Project-scoped overrides global for same slug. 24h grace period on deletion.
- **All 8 reusable codebase patterns are identified.** `gray-matter`, ADR-0043 write-through, atomic temp+rename, chokidar `awaitWriteFinish` settings, local-overrides-global, reconciler grace period, kebab-case IDs, Zod `safeParse` error structs.

### From DOR-60 (Damon Background Agent)

- **Name is Damon.** Greek myth (loyalty), daemon near-homophone, human name gives character.
- **Singleton, auto-created, not optional.** Every installation gets Damon. Fixed ID `damon`, namespace `system`.
- **Implemented via `isSystem: boolean` column on `agents` table.** `isSystem: true` = not deletable, not discoverable, auto-registered on server start.
- **Registration is idempotent startup call.** `ensureDamon(meshCore, dorkHome)` runs after MeshCore init, before scheduler start.
- **Damon's task files live at `{dorkHome}/tasks/*.md`.** The `TaskFileWatcher` associates these with agent ID `damon`.
- **CWD resolution:** task frontmatter `cwd` field → `DORKOS_DEFAULT_CWD` env → no CWD (some tasks don't need one).
- **Resource controls:** `maxCallsPerHour: 20`, `maxConcurrentRuns` shared, `maxRuntime` per task.
- **UI implications:** appears in agent list with "System" badge, no delete option, no interactive chat, navigable agent detail page.

### From the Original Brief

- **"Pulse" → "Tasks" rename.** No product named "Pulse" — it is the Tasks feature.
- **Tasks are not just scheduled.** A task without `cron` is an on-demand task, runnable manually or by API.
- **`/tasks` dedicated page.** With filters (keyword, agent, status) using the same filter system as `/agents`.
- **Standard task component.** One component for displaying tasks, used everywhere (panel, page, agent detail). Has variants for different sizes and contexts.
- **Sidebar navigation item** pointing to `/tasks`.

### From Existing Pulse Implementation (Codebase)

The existing Pulse implementation already has:

- `pulse_schedules` and `pulse_runs` tables in `packages/db/src/schema/pulse.ts`
- `PulseStore` class with full CRUD (already uses Drizzle, not raw SQLite)
- `SchedulerService` with croner integration, concurrency control, `buildPulseAppend`
- `ScheduleRow` component — already handles on-demand tasks (no-cron path shows "Run" button)
- `PulsePanel` with agent-filter Zustand state, edit dialog, create dialog
- `pulse-presets.ts` — factory presets written to `{dorkHome}/pulse/presets.json` on first run
- `AgentPicker`, `ScheduleFormInner`, `TimezoneCombobox`, `ScheduleBuilder`, `PresetGallery` — full UI suite
- `agents` table does NOT have `isSystem` column yet (confirmed from `packages/db/src/schema/mesh.ts`)
- `pulse_schedules` table does NOT have `filePath` column yet (confirmed from schema)

---

## 2. Gap Analysis

The following six areas are not covered by existing research and require decisions or design work before implementation.

---

### Gap 1: DB Migration Strategy

**What needs to happen:**

The current `pulse_schedules` schema has no `filePath` column. The new model requires every task row to have a corresponding `.md` file path. Existing rows (created before this redesign) have no file on disk.

**Recommended approach: dual-phase migration**

**Phase A — Schema migration (server startup):**

Add `filePath TEXT` column to `pulse_schedules` (nullable initially, to be tightened to NOT NULL after Phase B). This is a Drizzle migration file, same pattern as all other schema changes in the codebase.

```sql
ALTER TABLE pulse_schedules ADD COLUMN file_path TEXT;
```

The column is nullable in this migration because existing rows have no file yet.

**Phase B — Data backfill (one-time startup job):**

On first server start after the migration, a backfill job runs:

1. Query all `pulse_schedules` rows where `file_path IS NULL`.
2. For each row: determine target directory (project-scoped if `agentId` or `cwd` is set; global `{dorkHome}/tasks/` otherwise).
3. Serialize the row into a `.md` file using `gray-matter` (frontmatter = all metadata fields; body = `prompt`).
4. Write atomically (temp + rename pattern).
5. Update the DB row with the file path.

After backfill: add a migration that makes `file_path` NOT NULL with a constraint. From this point forward, the column is required.

**Risk:** If a row has a `cwd` that no longer exists on disk, the backfill creates the `.dork/tasks/` directory automatically (same as `mkdir -p`). This is safe — an orphaned directory with task files is acceptable.

**No data loss:** Existing schedules keep all their metadata. Run history (`pulse_runs`) is untouched — it references `schedule_id`, which stays stable.

**Presets migration:** The current `pulse-presets.ts` system writes to `{dorkHome}/pulse/presets.json`. Under the new model, presets become `.md` template files or are kept as in-memory TypeScript constants (per the template gallery research recommendation). The presets file path should change from `{dorkHome}/pulse/presets.json` to either (a) constants in the binary or (b) `{dorkHome}/tasks/templates/*.md`. Since DOR-59 and the template gallery research both recommend bundled constants, option (a) is preferred — presets become in-memory TypeScript objects and `pulse-presets.ts` is deprecated.

---

### Gap 2: "Pulse to Tasks" Rename Scope

**What needs changing:**

This is a pervasive rename touching code, routes, types, file paths, and documentation. The scope must be defined precisely to avoid partial renames.

**Rename inventory:**

| Area                | Current                                            | New                                                                |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| DB table names      | `pulse_schedules`, `pulse_runs`                    | `tasks`, `task_runs`                                               |
| Schema file         | `packages/db/src/schema/pulse.ts`                  | `packages/db/src/schema/tasks.ts`                                  |
| Server service dir  | `apps/server/src/services/pulse/`                  | `apps/server/src/services/tasks/`                                  |
| Server class names  | `PulseStore`, `SchedulerService`                   | `TaskStore`, `TaskSchedulerService`                                |
| Server function     | `buildPulseAppend()`                               | `buildTaskContext()`                                               |
| Shared types        | `PulseSchedule`, `PulseRun`, `CreateScheduleInput` | `Task`, `TaskRun`, `CreateTaskInput`                               |
| Shared schemas      | `PulseDispatchPayload`                             | `TaskDispatchPayload`                                              |
| Client feature dir  | `apps/client/src/layers/features/pulse/`           | `apps/client/src/layers/features/tasks/`                           |
| Client entity dir   | `apps/client/src/layers/entities/pulse/`           | `apps/client/src/layers/entities/tasks/`                           |
| Client route        | `PulsePanel` in session sidebar                    | Moved out of session sidebar (see Gap 4)                           |
| API routes          | `GET/POST /api/pulse/*`                            | `GET/POST /api/tasks/*`                                            |
| Transport interface | `listSchedules`, `createSchedule`, etc.            | `listTasks`, `createTask`, etc.                                    |
| Config key          | `PULSE_ENABLED`                                    | `TASKS_ENABLED` (or remove flag entirely — tasks always available) |
| dork-home path      | `{dorkHome}/pulse/presets.json`                    | `{dorkHome}/tasks/`                                                |
| CLI flag            | `--pulse`                                          | `--tasks` (or always-on)                                           |
| UI labels           | "Pulse", "schedules", "New Schedule"               | "Tasks", "tasks", "New Task"                                       |
| Nav item            | Pulse (HeartPulse icon)                            | Tasks (appropriate icon)                                           |

**Recommendation on `PULSE_ENABLED` / `--pulse` flag:**

The original brief says "Pulse is no longer a separate product." Tasks should be always-on — no `--tasks` flag. The `--pulse` flag should be quietly ignored (backward compatible) or removed. This simplifies the codebase (no feature-disabled state to maintain).

**Approach: rename-in-place vs new files**

Rename in place (Git renames, not copy-and-delete). This preserves git history. The rename is mechanical and can be done as a dedicated commit before adding new functionality.

**DB table rename risk:**

SQLite doesn't support `RENAME TABLE` directly via Drizzle's migration primitives cleanly. The safest path is:

1. Create new `tasks` and `task_runs` tables with the same schema.
2. Copy data from old tables.
3. Drop old tables.
4. This is one Drizzle migration file.

Alternatively, keep `pulse_schedules` and `pulse_runs` as the DB table names (internal implementation detail) but rename all TypeScript identifiers. This avoids a data migration and reduces risk. **Recommendation: keep DB table names as `pulse_schedules` / `pulse_runs` for now** — the table names are an implementation detail not visible to users. Rename TypeScript types and API routes but leave the DB table names for a future cleanup migration.

---

### Gap 3: `/tasks` Page UI Architecture

**What the brief requires:**

- Dedicated `/tasks` route at the top-level navigation
- Lists all tasks across agents
- Filters: keyword, agent, status (same filter system as `/agents`)
- Standard task component (used on this page and elsewhere)

**Recommended architecture:**

The `/tasks` page follows the same FSD pattern as `/agents`:

```
apps/client/src/layers/
├── widgets/
│   └── tasks/
│       ├── ui/
│       │   └── TasksPage.tsx          # Full-page widget (mirrors AgentsPage)
│       └── index.ts
├── features/
│   └── tasks/                         # Renamed from features/pulse/
│       ├── ui/
│       │   ├── TaskRow.tsx            # Standard task component (see Gap 5)
│       │   ├── TasksList.tsx          # List + FilterBar (mirrors AgentsList)
│       │   ├── CreateTaskDialog.tsx   # Renamed + evolved from CreateScheduleDialog
│       │   ├── TaskRunHistoryPanel.tsx
│       │   └── TaskEmptyState.tsx
│       ├── lib/
│       │   └── task-filter-schema.ts  # Mirrors agent-filter-schema.ts
│       └── index.ts
```

**Router integration:**

Add a new route `/_shell/tasks` in `router.tsx`, following the same pattern as `/_shell/agents`:

```typescript
// In router.tsx
const tasksRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'tasks',
  component: TasksPage,
  validateSearch: taskSearchSchema, // keyword, agent, status
});
```

**Filter schema for tasks:**

Mirrors `agent-filter-schema.ts`:

```typescript
export const taskFilterSchema = createFilterSchema<Task>({
  search: textFilter({
    fields: [(t) => t.name, (t) => t.description ?? '', (t) => t.tags.join(' ')],
  }),
  agent: enumFilter({
    field: (t) => t.agentId ?? '',
    options: [],
    dynamic: true,
    label: 'Agent',
  }),
  status: enumFilter({
    field: (t) => t.status,
    options: ['active', 'paused', 'pending_approval'],
    label: 'Status',
    labels: { active: 'Active', paused: 'Paused', pending_approval: 'Pending approval' },
  }),
  scheduled: enumFilter({
    field: (t) => (t.cron ? 'scheduled' : 'on-demand'),
    options: ['scheduled', 'on-demand'],
    label: 'Type',
    labels: { scheduled: 'Scheduled', 'on-demand': 'On-demand' },
  }),
});
```

**DashboardSidebar update:**

Replace the current Pulse nav item (HeartPulse icon, opens a panel) with a Tasks nav item (e.g., `ListTodo` or `ClipboardList` icon from Lucide) that navigates to `/tasks`. The Pulse panel in the session sidebar should be removed or repurposed (tasks are now a full page, not a sidebar panel).

**Question: remove PulsePanel from session sidebar?**

The brief says tasks get a dedicated page. The existing `PulsePanel` lives in the session sidebar. Recommendation: remove it from the session sidebar and instead add a Tasks link in the `DashboardSidebar` (which already exists on both `/` and `/agents` routes). The session sidebar can optionally show "Tasks for this project" as a filtered link.

---

### Gap 4: Standard Task Component Design

**What the brief requires:**

"A standard component for displaying tasks in lists. Similar to how we have a single component for displaying agents, but with different variants/sizes. Used everywhere. Allows run, edit, view runs."

**Current state:**

`ScheduleRow.tsx` already does most of this — it has:

- Status dot, agent display with color/emoji, cron description or "On-demand"
- Run Now button (on-demand tasks), Switch toggle (scheduled tasks)
- Dropdown menu with Edit, Run Now, Delete
- Animated expandable run history panel

**Recommendation: evolve `ScheduleRow` into `TaskRow`**

Rename and extend rather than rebuild. The core structure is correct. Changes needed:

1. **Rename:** `ScheduleRow.tsx` → `TaskRow.tsx`, props `schedule`/`ScheduleRowProps` → `task`/`TaskRowProps`
2. **Add `size` variant:** The brief says the component has variants/sizes. Add a `size?: 'default' | 'compact'` prop. Compact omits the run history expandable and shows fewer metadata fields (useful in agent detail pages or dashboard widgets).
3. **Add `showAgent` prop:** In the agent detail page context, showing the agent name/color on every row is redundant. `showAgent?: boolean` (default `true`) conditionally renders the agent section.
4. **File path indicator:** For file-backed tasks, show the file path (truncated, monospace) in the expanded state — so users know where to find/edit the file directly. This is a new UX surface not currently in `ScheduleRow`.
5. **Tags display:** The new frontmatter schema includes `tags`. Add tag chips in the row metadata (below the cron description line), gated on `meta.tags.length > 0`.
6. **"No file" warning:** If a task has no `filePath` in the DB (legacy/backfill-failed tasks), show a subtle warning icon with tooltip "Task definition file not found."

**Component variants table:**

| Variant   | Where used                           | Features shown                             |
| --------- | ------------------------------------ | ------------------------------------------ |
| `default` | `/tasks` page, `TasksList`           | Full row: agent, name, cron, tags, actions |
| `compact` | Agent detail page, dashboard widgets | Name, cron, run button — no expand         |
| `minimal` | Command palette results              | Name + status dot only                     |

---

### Gap 5: Task File Watcher Integration with Existing Scheduler Service

**Current scheduler service architecture:**

`SchedulerService` (in `apps/server/src/services/pulse/scheduler-service.ts`) currently:

- Reads tasks from `PulseStore` (DB) at startup
- Registers croner jobs for enabled scheduled tasks
- Has no awareness of `.dork/tasks/` directories or file changes

**Recommended integration approach:**

Introduce a `TaskFileWatcher` service that is separate from but coordinated with `SchedulerService`. The two services communicate through `PulseStore` as the shared data layer:

```
TaskFileWatcher → parses .md files → upserts PulseStore → SchedulerService detects changes
```

**TaskFileWatcher responsibilities:**

1. Watch `{dorkHome}/tasks/*.md` on startup (global tasks, always)
2. Watch `{project}/.dork/tasks/*.md` when an agent is registered (project tasks)
3. On file add/change: parse → validate → upsert into `PulseStore` → if `cron` changed, re-register in `SchedulerService`
4. On file delete: mark task as paused in `PulseStore` (grace period), unregister cron job
5. Stop watcher when agent is unregistered (or server stops)

**How SchedulerService learns about file-driven changes:**

Option A (event-based): `TaskFileWatcher` calls `schedulerService.onTaskUpdated(task)` directly.
Option B (store-polling): `SchedulerService` polls `PulseStore` every 30s for enabled scheduled tasks that have no active croner job, and registers them.
Option C (startup-only + watcher callback): Watcher calls a callback `onTaskChange` that triggers re-registration.

**Recommendation: Option C (callback pattern)**

```typescript
class TaskFileWatcher {
  constructor(
    private store: PulseStore,
    private onTaskChange: (taskId: string) => void,
    private dorkHome: string
  ) {}
}

// In SchedulerService:
const watcher = new TaskFileWatcher(
  store,
  (taskId) => {
    const task = store.getSchedule(taskId);
    if (task?.enabled && task.cron && task.status === 'active') {
      this.registerSchedule(task);
    }
  },
  dorkHome
);
```

This keeps `SchedulerService` as the single authority on croner job registration. `TaskFileWatcher` only updates the store and notifies.

**MeshCore lifecycle hookup:**

When `meshCore.register()` is called for a new agent, also call `taskFileWatcher.watchProjectTasks(agentProjectPath)`. When `meshCore.unregister()` is called, call `taskFileWatcher.stopWatching(agentProjectPath)`. This requires passing `taskFileWatcher` into the mesh registration flow — either via DI in `index.ts` or a `meshCore.on('register', ...)` event listener.

**Damon's watcher:**

Damon's `{dorkHome}/tasks/` directory is the global watcher, started unconditionally at server startup (not gated on agent registration). This watcher is started immediately after `ensureDamon()` in `index.ts`.

---

### Gap 6: Presets System Evolution

**Current state:**

`pulse-presets.ts` implements a factory presets system that:

- Defines 4 hardcoded presets as TypeScript constants
- Writes them to `{dorkHome}/pulse/presets.json` on first run
- Reads from that file subsequently (allows user overrides)

**Problem with current approach:**

Per the template gallery research: factory presets written to disk are a maintenance antipattern. If a user deletes/corrupts `presets.json`, factory defaults are gone. Updates to factory presets don't ship to existing installations.

**New approach under the tasks redesign:**

The presets system should evolve in one of two directions:

**Option A (recommended): Presets become in-memory TypeScript constants only**

The 4 (soon to be 6-8) factory presets are kept as TypeScript constants in `services/tasks/task-presets.ts`. They are never written to disk. The UI fetches them from `GET /api/tasks/presets` (a pure in-memory endpoint — no DB, no file I/O).

When a user "applies" a preset in the Create Task Dialog, it pre-fills the form. The resulting task is then saved as a `.md` file. The preset itself is never persisted — it is a template, not a task.

User-defined templates would be stored as `.md` files in `{dorkHome}/tasks/templates/` (a `templates/` subdirectory within the tasks directory), separate from runnable tasks. This is a future concern — for the initial redesign, factory presets as in-memory constants is sufficient.

**Option B: Presets become `.md` template files**

Presets are stored at `{dorkHome}/tasks/templates/*.md` with `enabled: false` in frontmatter (so the scheduler ignores them). The UI reads them alongside regular tasks but displays them differently.

This is elegant (consistent with the "everything is a file" philosophy) but adds complexity: the watcher needs to distinguish template files from runnable tasks.

**Decision: Option A for now, Option B as a future iteration**

For the redesign, replace `pulse-presets.ts` with an in-memory constants file. The `ensureDefaultPresets()` function and the `{dorkHome}/pulse/presets.json` file are removed. The presets API endpoint returns hardcoded constants.

This eliminates a file I/O surface and simplifies the startup sequence.

---

## 3. Risk Areas and Migration Concerns

### Risk 1: Data loss during backfill (Medium)

The Phase B backfill job generates `.md` files from existing DB rows. If a row has `prompt: ''` (empty string), the generated file has an empty markdown body. This is valid but semantically odd — an empty-prompt task does nothing when run. Mitigation: add a warning log for rows with empty prompts. Do not block the backfill.

### Risk 2: Partial rename leaving inconsistent naming (High without a plan)

The "Pulse → Tasks" rename touches ~40 files across 6 packages. A partial rename (TypeScript types renamed but API routes not, or API routes renamed but transport interface not) will cause runtime failures. Mitigation: execute the rename as a single dedicated PR before adding new file-based task infrastructure. Run `pnpm typecheck` and `pnpm build` as verification gates.

### Risk 3: Watcher lifecycle bugs (Medium)

Chokidar watchers that are not stopped correctly leak file descriptors. If an agent is registered and unregistered repeatedly (e.g., in dev), watchers can accumulate. Mitigation: `TaskFileWatcher.stopAll()` in server shutdown handler and in `meshCore.unregister()` callback. Add an assertion in dev mode that verifies no watcher is started twice for the same path.

### Risk 4: Croner + file watcher race condition (Low)

If a `.md` file is rapidly edited (save, save, save), the chokidar debounce (100ms) produces multiple `handleFileChange` calls. Each updates the DB and calls `onTaskChange`, which calls `registerSchedule`. Croner handles this correctly — `registerSchedule` first unregisters any existing croner job for the same schedule ID before registering the new one. But the rapid-fire sequence could leave a stale croner job briefly. Mitigation: the existing `registerSchedule` already unregisters before registering. Verify this is correct in the implementation.

### Risk 5: `isSystem` column migration for Damon (Low)

Adding `isSystem: boolean` to the `agents` table is a simple ALTER TABLE migration. The risk is that existing agent rows have `isSystem = false` by default (correct), and the Damon row is created with `isSystem = true` on first startup after migration. Since `ensureDamon()` is idempotent, this is safe even if the server restarts during migration.

### Risk 6: Sidebar navigation restructuring (Low)

Removing `PulsePanel` from the session sidebar and adding a Tasks route breaks existing navigation flows where users access tasks from the session view. Mitigation: add a "View tasks for this project" contextual link in the session sidebar that navigates to `/tasks?agent={agentId}`. This preserves discoverability.

---

## 4. Implementation Sequencing

Based on dependency analysis, the work should proceed in four phases:

### Phase 1: Rename (1-2 days, no new functionality)

1. Rename all TypeScript identifiers: `Pulse*` → `Task*`, `Schedule*` → `Task*`
2. Rename files and directories
3. Update API routes: `/api/pulse/*` → `/api/tasks/*`
4. Update transport interface methods
5. Update nav item label and icon
6. Keep DB table names as `pulse_schedules`/`pulse_runs` (rename later)
7. Remove `--pulse` flag (tasks always enabled)
8. **Verification gate:** `pnpm typecheck && pnpm build && pnpm test`

### Phase 2: DB schema + backfill (1 day)

1. Add `file_path TEXT` column to `pulse_schedules` (nullable migration)
2. Add `is_system BOOLEAN DEFAULT false` column to `agents` table
3. Write and run backfill job for existing tasks → generate `.md` files
4. Tighten `file_path` to NOT NULL after backfill (second migration)
5. Update `PulseStore` → `TaskStore` to include `filePath` in all CRUD

### Phase 3: File-based infrastructure (3-4 days)

1. Implement `TaskFrontmatterSchema` (Zod) and `parseTaskFile()` in shared package or server
2. Implement `TaskFileWatcher` service (chokidar, `awaitWriteFinish`, per DOR-59 spec)
3. Implement `TaskFileWriter` (atomic writes, per ADR-0043 pattern)
4. Implement `ensureDamon()` in server startup
5. Extend reconciler to cover task files (5-min safety net)
6. Wire `TaskFileWatcher` into `meshCore` registration/unregistration lifecycle
7. Update `TaskStore` create/update/delete to write files first, then DB
8. Replace `pulse-presets.ts` with in-memory constants

### Phase 4: `/tasks` page + standard component (3-4 days)

1. Create `TaskRow` component (evolve `ScheduleRow`, add `size` variant, file path indicator, tags)
2. Create `task-filter-schema.ts` (mirrors `agent-filter-schema.ts`)
3. Create `TasksList` component with `FilterBar` integration
4. Create `TasksPage` widget component
5. Add `/_shell/tasks` route to `router.tsx`
6. Add Tasks item to `DashboardSidebar`
7. Update agent detail page to use `TaskRow` in compact mode
8. Remove `PulsePanel` from session sidebar; add "View project tasks" contextual link
9. Update tests for renamed components and new task page

**Total estimated effort: 8-11 days of focused implementation**

---

## 5. Open Questions (Require Product Decision)

1. **Should `--pulse` / `--tasks` feature flag be removed entirely?** Recommendation: yes — tasks are core infrastructure, not optional. But this removes the ability to run a minimal server without the scheduler. Decision needed before Phase 1.

2. **Should the `/tasks` page replace `PulsePanel` in the session sidebar entirely, or coexist?** Recommendation: replace (tasks are a top-level page), with a contextual "View project tasks" link in the session sidebar as a bridge.

3. **Should the tasks page show Damon's global tasks alongside project tasks?** Recommendation: yes, filterable by agent. Damon's tasks appear like any other agent's tasks, with his "System" badge on the agent column.

4. **What icon should represent Tasks in the nav?** Current Pulse icon is `HeartPulse`. Options: `ListTodo`, `ClipboardList`, `CheckSquare`, `Zap`. `ListTodo` from Lucide is the clearest semantic choice.

5. **Should the backfill generate files in `{agentProjectPath}/.dork/tasks/` for project tasks, or all in `{dorkHome}/tasks/`?** Recommendation: project-scoped tasks go to the agent's project directory, global tasks (no `agentId`, no `cwd`) go to `{dorkHome}/tasks/`. This matches the DOR-59 architecture.

---

## 6. Dependency Graph

```
Phase 1 (Rename)
    └── Phase 2 (DB schema)
            └── Phase 3 (File infrastructure)
                    └── Phase 4 (/tasks page)
```

Phase 3 depends on Phase 2 because `TaskStore` needs the `filePath` column before file-first writes are implemented.

Phase 4 depends on Phase 3 because `TaskRow` needs to display `filePath` information and the task model may have changed.

Phases 1 and 2 can be parallelized (separate PRs) since the rename is purely cosmetic and the schema migration is additive.

---

## 7. What This Doesn't Cover (Explicit Non-Goals)

The following were mentioned in prior research but are explicitly out of scope for this redesign:

- **Task template marketplace / community templates** — future concern
- **Task dependencies / chaining** — future concern
- **Visual cron builder** (`CronVisualBuilder.tsx`) — already designed in DOR-20260221 V2 research, can be added as an enhancement after the rename
- **Tab title badge / Sonner notifications for task completion** — existing design (V2 enhancements research), not blocked, can be added in Phase 4 as a polish item
- **Ambient "completed run" badge on nav item** — same as above
- **Rename DB table names** (`pulse_schedules` → `tasks`) — low priority, can be a cleanup migration after the main work ships

---

## Sources & Evidence

All findings are synthesized from existing research and codebase inspection. No new web searches were performed.

- `research/20260329_file_based_task_definitions.md` — DOR-59 complete spec
- `research/20260329_background_agent_concept.md` — DOR-60 complete spec
- `research/20260221_pulse_implementation_gaps.md` — Gap analysis for current Pulse
- `research/20260221_pulse_scheduler_ux_redesign.md` — UX patterns
- `research/20260221_pulse_v2_enhancements.md` — V2 enhancements
- `research/20260311_pulse_template_gallery_ux.md` — Template/preset patterns
- `research/pulse-scheduler-design.md` — Original scheduler design
- Codebase: `packages/db/src/schema/pulse.ts`, `packages/db/src/schema/mesh.ts`, `apps/server/src/services/pulse/`, `apps/client/src/layers/features/pulse/`, `apps/client/src/layers/features/agents-list/lib/agent-filter-schema.ts`
