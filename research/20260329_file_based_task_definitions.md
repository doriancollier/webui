# File-Based Task Definitions with YAML Frontmatter

**Date:** 2026-03-29
**Linear issue:** DOR-59
**Status:** Complete
**Author:** Agent (research)

## Summary

This report recommends a design for file-based task definitions using markdown files with YAML frontmatter. **Files are the sole source of truth for task definitions; the database is a derived cache and query layer** — the same model as ADR-0043 for agent storage. The API creates and edits tasks by writing files. Run history (execution data) lives in the DB only.

The design reuses three proven codebase patterns: ADR-0043 file-first write-through, the extension manifest Zod validation pattern, and chokidar file watching from the session broadcaster. `gray-matter` is already a dependency in both `apps/server` and `packages/cli`.

## 1. Recommended Frontmatter Schema

### Design Principle: Prompt Is the Body

A task is primarily a text prompt. The markdown body IS the prompt — the instruction an agent executes. Metadata lives in YAML frontmatter. This makes tasks natural to read and write for both humans and AI agents.

### Example Task File

```markdown
---
name: Daily Health Check
description: Run lint, tests, and typecheck across the monorepo
cron: '0 8 * * 1-5'
timezone: America/New_York
agent: web-dashboard
enabled: true
maxRuntime: 10m
permissions: acceptEdits
tags:
  - maintenance
  - ci
---

Run the full health check suite for this project:

1. Run `pnpm lint` and report any new warnings
2. Run `pnpm test -- --run` and report failures
3. Run `pnpm typecheck` and report errors
4. If all pass, post a summary. If any fail, create a detailed report with the specific failures and suggested fixes.

Focus on changes since the last successful run. Don't fix issues automatically — report them.
```

### Frontmatter Fields

| Field         | Type     | Required | Default         | Notes                                             |
| ------------- | -------- | -------- | --------------- | ------------------------------------------------- |
| `name`        | string   | **yes**  | —               | Human-readable display name                       |
| `description` | string   | no       | —               | One-line summary for list views                   |
| `cron`        | string   | no       | —               | Cron expression. Absent = on-demand only          |
| `timezone`    | string   | no       | `"UTC"`         | IANA timezone for cron scheduling                 |
| `agent`       | string   | no       | —               | Agent ID or name. Absent = inferred from location |
| `enabled`     | boolean  | no       | `true`          | Whether the task is active                        |
| `maxRuntime`  | string   | no       | —               | Duration string: `"5m"`, `"1h"`, `"30s"`          |
| `permissions` | string   | no       | `"acceptEdits"` | `"acceptEdits"` or `"bypassPermissions"`          |
| `tags`        | string[] | no       | `[]`            | Freeform tags for filtering                       |

### Fields Deliberately Excluded from Frontmatter

| Field                     | Why excluded                          | Where it lives                                                                       |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `id`                      | Derived from filename slug            | Filename: `daily-health-check.md` → ID `daily-health-check`                          |
| `prompt`                  | The entire point of the markdown body | Body of the `.md` file                                                               |
| `cwd`                     | Inferred from file location           | Project-scoped: resolved from project root. Global: explicit in frontmatter as `cwd` |
| `status`                  | Runtime state, not definition         | DB only (`active`, `paused`, `pending_approval`)                                     |
| `createdAt` / `updatedAt` | Git tracks this better                | DB timestamps, git history                                                           |

### Exception: `cwd` for Global Tasks

Global tasks (in `{DORK_HOME}/tasks/`) lack an implicit project context. For these, an optional `cwd` field is needed:

```yaml
---
name: Summarize All Activity
cwd: ~/projects/my-app
---
```

### Zod Schema

```typescript
import { z } from 'zod';

/** Duration strings: "5m", "1h", "30s", "2h30m" */
const DurationSchema = z
  .string()
  .regex(/^(\d+h)?(\d+m)?(\d+s)?$/, 'Duration must be like "5m", "1h", "30s", or "2h30m"');

export const TaskFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  cron: z.string().optional(),
  timezone: z.string().default('UTC'),
  agent: z.string().optional(),
  enabled: z.boolean().default(true),
  maxRuntime: DurationSchema.optional(),
  permissions: z.enum(['acceptEdits', 'bypassPermissions']).default('acceptEdits'),
  tags: z.array(z.string()).default([]),
  // Global tasks only:
  cwd: z.string().optional(),
});

export type TaskFrontmatter = z.infer<typeof TaskFrontmatterSchema>;

/** Full parsed task (frontmatter + body + derived fields). */
export interface TaskDefinition {
  /** Derived from filename slug. */
  id: string;
  /** Parsed and validated frontmatter. */
  meta: TaskFrontmatter;
  /** Markdown body — the agent prompt. */
  prompt: string;
  /** Where the file lives: 'project' or 'global'. */
  scope: 'project' | 'global';
  /** Absolute path to the .md file. */
  filePath: string;
  /** For project-scoped tasks, the project root. */
  projectPath?: string;
}
```

### Parsing

```typescript
import matter from 'gray-matter';

function parseTaskFile(
  filePath: string,
  content: string,
  scope: 'project' | 'global',
  projectPath?: string
): TaskDefinition | { error: string } {
  const { data, content: body } = matter(content);
  const result = TaskFrontmatterSchema.safeParse(data);

  if (!result.success) {
    return { error: result.error.message };
  }

  const slug = path.basename(filePath, '.md');
  // Validate slug format (kebab-case, like extension IDs)
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return { error: `Invalid filename: must be kebab-case (got "${slug}")` };
  }

  return {
    id: slug,
    meta: result.data,
    prompt: body.trim(),
    scope,
    filePath,
    projectPath,
  };
}
```

## 2. File Location and Naming Conventions

### Directory Structure

```
# Project-scoped tasks (run by this project's agent)
my-project/
└── .dork/
    └── tasks/
        ├── daily-health-check.md
        ├── summarize-activity.md
        └── dependency-audit.md

# Global tasks (run by background agent)
~/.dork/
└── tasks/
    ├── cross-project-summary.md
    └── inbox-triage.md
```

### Naming Rules

| Rule                    | Example                                           | Rationale                                                    |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| Kebab-case filenames    | `daily-health-check.md`                           | Matches extension ID convention (`/^[a-z0-9][a-z0-9-]*$/`)   |
| `.md` extension always  | Not `.yaml`, not `.txt`                           | Markdown body is the prompt; editors get syntax highlighting |
| Filename = task ID      | `daily-health-check.md` → ID `daily-health-check` | No separate ID field needed; rename file = rename task       |
| No nested directories   | Flat within `.dork/tasks/`                        | Simplifies scanning, avoids category-by-folder complexity    |
| Tags for categorization | `tags: [maintenance]` in frontmatter              | Flexible filtering without filesystem structure              |

### Scope Resolution

When the server loads tasks, it resolves scope from file location:

1. **Project-scoped**: File is at `{projectPath}/.dork/tasks/*.md` → task belongs to that agent, CWD = projectPath
2. **Global**: File is at `{dorkHome}/tasks/*.md` → task needs explicit `cwd` or runs in a default context
3. **Conflict**: If a global and project task share the same slug, project wins (same as extension discovery's local-overrides-global pattern)

### Agent Resolution

For project-scoped tasks, the agent is resolved in priority order:

1. Explicit `agent` field in frontmatter → look up by ID or name in Mesh registry
2. Agent registered at the project path → auto-associate (most common case)
3. No agent found → task is valid but unrunnable until an agent is registered

This mirrors how the current scheduler resolves CWD from `agentId` via MeshCore.

## 3. Sync Architecture Recommendation

### Core Principle: Files Are the Source of Truth

**Files define tasks. The database is a derived cache.** This is the same model as ADR-0043 for agent storage — no task exists without a corresponding `.md` file on disk. If the DB has a task entry with no file, the reconciler removes it.

| What             | Where                    | Role                             |
| ---------------- | ------------------------ | -------------------------------- |
| Task definitions | `.dork/tasks/*.md` files | **Source of truth**              |
| Task index/cache | `pulse_schedules` table  | Derived cache for fast queries   |
| Run history      | `pulse_runs` table       | Runtime/execution data (DB only) |

### Pattern: File-First Write-Through + Directory Watcher

Reuse ADR-0043's write-through pattern with one enhancement: chokidar directory watching for known `.dork/tasks/` paths (bounded directories, unlike the unbounded agent discovery scan).

```
┌─────────────────────────────────────────────────────────┐
│                    Source of Truth                        │
│              .dork/tasks/*.md files on disk               │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
    ┌──────────▼──────────┐  ┌───────▼────────┐
    │  Chokidar Watcher   │  │  Reconciler    │
    │  (real-time, known  │  │  (5-min poll,  │
    │   directories only) │  │   safety net)  │
    └──────────┬──────────┘  └───────┬────────┘
               │                      │
    ┌──────────▼──────────────────────▼───────┐
    │           Task Store (DB Cache)          │
    │     pulse_schedules table (existing)     │
    │     + filePath column (non-nullable)     │
    └──────────┬──────────────────────────────┘
               │
    ┌──────────▼──────────┐
    │  Scheduler Service  │
    │  (croner, dispatch) │
    └─────────────────────┘
```

### Write Paths

**File → DB (direct file edits by humans or agents):**

1. User/agent edits `.dork/tasks/daily-health-check.md`
2. Chokidar detects change (50ms stability threshold, 100ms debounce — same as session broadcaster)
3. Parse with `gray-matter`, validate with Zod
4. Upsert into `pulse_schedules`
5. Re-register cron job if `cron` field changed

**API → File → DB (UI or API creates/edits a task):**

1. API receives create/update request
2. Write markdown file to `.dork/tasks/{slug}.md` (atomic temp + rename)
3. Chokidar picks it up, or call `syncFromDisk()` immediately
4. DB updated

Every write path goes through the file. The API never writes directly to the DB for task definitions — it writes a file, then the file syncs to the DB. This ensures a single source of truth.

### DB Schema Changes

Replace the current `pulse_schedules` schema. The new table is a **cache of file contents** plus runtime state:

```typescript
filePath: text('file_path').notNull(),  // absolute path to .md file (every task has one)
```

Fields like `name`, `prompt`, `cron`, etc. are copied from the parsed file into the DB for fast queries. The file is always authoritative — if the DB and file disagree, the reconciler overwrites the DB from the file.

### Conflict Resolution

Since the file is always the source of truth, conflicts are straightforward:

| Scenario                          | Resolution                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| File edited, DB has stale data    | File wins → update DB (watcher or reconciler)                                                                 |
| API edits a task                  | API writes to file first → watcher syncs DB                                                                   |
| File deleted                      | Unregister cron. Keep DB row with 24h grace period (matches agent orphan pattern). Old run history preserved. |
| File restored within grace period | Re-activate from file                                                                                         |
| File renamed                      | Old slug: treated as deletion (24h grace, run history preserved). New slug: treated as new task.              |
| Slug conflict (global vs project) | Project-scoped wins (local overrides global)                                                                  |
| DB entry has no file              | Reconciler removes it (orphan cleanup)                                                                        |

### Watcher Lifecycle

```typescript
// In SchedulerService or a new TaskFileWatcher service
class TaskFileWatcher {
  private watchers = new Map<string, FSWatcher>();

  /** Watch a specific .dork/tasks/ directory. */
  watch(tasksDir: string, scope: 'project' | 'global', projectPath?: string): void {
    const watcher = chokidar.watch(path.join(tasksDir, '*.md'), {
      persistent: true,
      ignoreInitial: false, // Process existing files on startup
      awaitWriteFinish: {
        stabilityThreshold: 50, // Same as session broadcaster
        pollInterval: 25,
      },
    });

    watcher.on('add', (filePath) => this.handleFileChange(filePath, scope, projectPath));
    watcher.on('change', (filePath) => this.handleFileChange(filePath, scope, projectPath));
    watcher.on('unlink', (filePath) => this.handleFileRemove(filePath));

    this.watchers.set(tasksDir, watcher);
  }

  /** Called on server shutdown. */
  async stopAll(): Promise<void> {
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();
  }
}
```

**When to start watchers:**

1. Server startup: watch `{dorkHome}/tasks/` (global)
2. When an agent is registered: watch `{agentProjectPath}/.dork/tasks/` (project-scoped)
3. When an agent is unregistered: stop watcher for that project's tasks dir

This ties into MeshCore lifecycle — when `meshCore.register()` is called, also start a task watcher for that project. When `meshCore.unregister()` is called, stop it.

### Reconciler (Safety Net)

The 5-minute reconciler already exists for agents. Extend it (or add a parallel timer) for tasks:

1. Scan all known task directories (global + each registered agent's project)
2. For each `.md` file: parse, validate, compare to DB
3. Update DB if file differs
4. Mark DB entries as paused if file is missing (with grace period)
5. Remove stale entries past grace period

This is identical to the agent reconciler pattern — just applied to task files instead of `agent.json`.

## 4. Performance Analysis

### Scale Estimates

| Metric            | Conservative | Aggressive | Notes                                           |
| ----------------- | ------------ | ---------- | ----------------------------------------------- |
| Tasks per project | 3-10         | 20-50      | Most projects have a handful of recurring tasks |
| Global tasks      | 2-5          | 10-20      | Cross-project summaries, triage                 |
| Registered agents | 5-15         | 30-50      | Each agent = one watched directory              |
| Total task files  | 20-100       | 200-500    | Well within chokidar's comfort zone             |

### Chokidar Cost

Chokidar uses `fs.watch` (FSEvents on macOS, inotify on Linux) which is kernel-level and near-zero CPU cost for small directory counts.

**Benchmark context:**

- Session broadcaster already uses chokidar per active session with no issues
- We're watching N directories where N = number of registered agents + 1 (global)
- Each directory has <50 files
- FSEvents handles thousands of watched paths efficiently

**Risk:** If an agent is registered in a network-mounted directory (NFS, SMB), `fs.watch` may not work. The 5-minute reconciler handles this case as a fallback.

### Parse Cost

- `gray-matter` parse: ~0.1ms per file (trivial for <50 files)
- Zod validation: ~0.05ms per schema
- Total per reconciliation cycle: <10ms for 100 files

### Memory

- Each parsed `TaskDefinition` is ~500 bytes
- 500 tasks = ~250KB in memory
- Chokidar watchers: ~1KB per directory
- Negligible compared to session data

### Conclusion

Performance is a non-issue at realistic scale. The bottleneck would be disk I/O on very slow filesystems (network mounts), which the reconciler handles gracefully.

## 5. Reusable Patterns from Existing Codebase

### Pattern 1: File-as-Source-of-Truth (ADR-0043)

**From:** `packages/mesh/src/mesh-agent-management.ts`
**Reuse:** Identical model — `.dork/tasks/*.md` files are the source of truth, DB is a derived cache. All mutations go through the file. Write order: disk → DB → scheduler.

### Pattern 2: Atomic File Writes

**From:** `packages/shared/src/manifest.ts` — `writeManifest()` uses temp file + `fs.rename()`
**Reuse:** When the API writes a task file, use the same atomic pattern to prevent corruption.

```typescript
// Reuse from packages/shared/src/manifest.ts
const tempPath = path.join(tasksDir, `.task-${randomUUID()}.tmp`);
await fs.writeFile(tempPath, content, 'utf-8');
await fs.rename(tempPath, targetPath);
```

### Pattern 3: Zod safeParse + Structured Errors

**From:** `packages/extension-api/src/manifest-schema.ts` — extension discovery returns structured `{ code, message, details }` errors for invalid manifests.
**Reuse:** When a task file has invalid frontmatter, record the error with the same structure so the UI can show helpful diagnostics.

### Pattern 4: Chokidar with awaitWriteFinish

**From:** `apps/server/src/services/runtimes/claude-code/session-broadcaster.ts` (lines 298-336)
**Reuse:** Same `awaitWriteFinish` config (50ms stability, 25ms poll, 100ms debounce) for task file watching.

### Pattern 5: Local-Overrides-Global Discovery

**From:** `apps/server/src/services/extensions/extension-discovery.ts` — when both global and local extensions share an ID, local wins.
**Reuse:** Same merge strategy for task slugs. Project-scoped tasks override global tasks with the same filename.

### Pattern 6: Reconciler with Grace Period

**From:** `packages/mesh/src/reconciler.ts` — 5-minute interval, 24h orphan grace period, file → DB sync.
**Reuse:** Same interval and grace period for task file reconciliation.

### Pattern 7: gray-matter Parsing

**From:** Already a dependency in `apps/server` and `packages/cli` (`gray-matter@^4.0.3`).
**Reuse:** Direct import — no new dependencies needed.

### Pattern 8: Kebab-case ID from Filename

**From:** Extension IDs use `/^[a-z0-9][a-z0-9-]*$/` regex validation.
**Reuse:** Task filenames follow the same convention. Slug = filename without `.md` extension.

## 6. Migration Strategy

### Phase 1: File-Based Task Infrastructure

1. Add `filePath` column (non-nullable) to `pulse_schedules`
2. Implement `TaskFileParser` (gray-matter + Zod)
3. Implement `TaskFileWatcher` (chokidar for known directories)
4. Implement `TaskFileWriter` (atomic writes for API → file path)
5. Migrate existing DB-only schedules: generate `.md` files from current DB rows, then switch to file-first model
6. API endpoints write files instead of DB directly

### Phase 2: UI Integration

1. Task creation dialog writes `.md` files (no "file vs DB" choice — it's always a file)
2. Task editing in UI writes to the file, watcher syncs DB
3. Show parse errors for invalid task files in the UI
4. File path shown in task detail view (so users know where to find/edit it)

### Phase 3: Background Agent Concept

This connects to DOR-60 (which DOR-59 blocks). The "background agent" that runs global tasks needs:

- A dedicated agent registration (auto-created, not discovered)
- Default CWD resolution for global tasks
- Its own session management

This is out of scope for the current research but the file-based task system is designed to support it.

## 7. Resolved Questions

1. **Should the API be able to create file-backed tasks?** **Yes.** The API creates tasks by writing `.md` files. This is the only way to create tasks — there is no DB-only path.

2. **What happens to run history when a task file is renamed?** A rename = delete old + create new. Old run history stays under the old slug (the DB row enters the 24h grace period). The new filename creates a fresh task with no history.

## 8. Remaining Open Questions

1. **Should we support task templates/presets as markdown files?** The current `pulse-presets.ts` system uses JSON. We could migrate presets to be markdown templates too, but that's a separate concern.

2. **Should we watch for new `.dork/tasks/` directories appearing?** When a user creates `.dork/tasks/` in a project that already has an agent, we'd need to detect the new directory. The reconciler handles this — on its next cycle, it checks for the directory's existence.

3. **What should the migration path be for existing DB-only schedules?** Recommendation: generate `.md` files from existing DB rows during the migration, so all tasks become file-backed. This is a one-time operation.
