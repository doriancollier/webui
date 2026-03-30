# Background Agent Concept Definition

**Date:** 2026-03-29
**Linear issue:** DOR-60
**Status:** Complete
**Author:** Agent (research)
**Depends on:** DOR-59 (file-based task definitions)

## Summary

The "Background Agent" is a **singleton system agent** that runs global tasks — work not scoped to any specific project. It uses the same infrastructure as project agents (Mesh registry, AgentRuntime, Pulse scheduler) but is auto-created for every DorkOS installation automatically. It's navigable and viewable like any other agent — just not deletable.

**Recommended name: Damon** — the Greek mythological figure who pledged his life for his friend Pythias. A near-homophone of "daemon" (the Unix background process concept), but with a human name and a story about loyalty and working on behalf of others.

## 1. Concept Definition

### What It Is

Damon is a system-level agent that:

- Runs global tasks stored at `{dorkHome}/tasks/*.md`
- Handles cross-project background work (activity summaries, prompt suggestions, digest generation)
- Is auto-created for every DorkOS installation — not optional, everyone gets one
- Is a singleton — exactly one per installation
- Uses the same `AgentRuntime` interface as every other agent
- Is navigable and viewable in the UI like any other agent
- Cannot be deleted or unregistered (system-protected)

### What It Is Not

- Not a replacement for project-scoped agents
- Not a separate service or process — it runs within the existing server, dispatched by the scheduler

### Name: "Damon"

| Candidate        | Verdict         | Rationale                                                                                                                                                                                                           |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Damon**        | **Recommended** | Greek myth: Damon pledged his life for Pythias — absolute loyalty, working on behalf of others. Near-homophone of "daemon." A real human name gives the agent personality. Clean UI: "Damon ran your health check." |
| Argus            | Runner-up       | Greek myth: the all-seeing giant with 100 eyes, never fully slept. Strong "watcher" metaphor. But feels slightly pretentious and harder to connect emotionally.                                                     |
| Radar            | Considered      | M\*A\*S\*H's Radar O'Reilly — anticipated everyone's needs before they asked. Approachable, fits the role. But less mythological weight, more casual than DorkOS brand voice.                                       |
| Daemon           | Rejected        | Technically precise but impersonal. A concept, not a character. Giving a background process a human name is more on-brand and cheeky.                                                                               |
| Background Agent | Rejected        | Descriptive but bland. "Background" is an implementation detail, not a concept.                                                                                                                                     |

Damon gives us natural UI language: "Damon ran your health check", "Damon's tasks", "Damon is summarizing activity".

## 2. Architecture

### How It Fits in the Mesh

```
┌─────────────────────────────────────────────────────────┐
│                      Mesh Registry                       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ web-dashboard │  │ api-service  │  │   damon       │  │
│  │ (project)     │  │ (project)    │  │ (system)      │  │
│  │ ns: home      │  │ ns: home     │  │ ns: system    │  │
│  │ path: ~/proj1 │  │ path: ~/proj2│  │ path: {dorkH} │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  Project agents: discovered, user-managed                │
│  Daemon: auto-registered, system-managed                 │
└─────────────────────────────────────────────────────────┘
         │                    │                   │
         ▼                    ▼                   ▼
  .dork/tasks/*.md     .dork/tasks/*.md    {dorkHome}/tasks/*.md
  (project tasks)      (project tasks)     (global tasks)
```

### Key Properties

| Property                 | Value                            | Rationale                                                 |
| ------------------------ | -------------------------------- | --------------------------------------------------------- |
| `id`                     | `damon` (fixed string, not ULID) | Singleton — always the same ID, survives server restarts  |
| `name`                   | `Damon`                          | Display name with capital, matches the character          |
| `runtime`                | `claude-code`                    | Same runtime as all other agents                          |
| `namespace`              | `system`                         | Separate from user agents in `home`/`projects` namespaces |
| `isSystem`               | `true`                           | DB designation — marks this as a system agent (see below) |
| `projectPath`            | `{dorkHome}`                     | The dork home directory is its "project"                  |
| `behavior.responseMode`  | `silent`                         | No interactive responses                                  |
| `budget.maxCallsPerHour` | Configurable (default: 20)       | Prevents runaway resource consumption                     |
| `status`                 | `active`                         | Always active while server is running                     |
| `capabilities`           | `['tasks', 'summaries']`         | Describes what it does                                    |

### DB Designation

Add an `isSystem` boolean column to the `agents` table:

```typescript
isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
```

This is the canonical way to identify Damon (and any future system agents). Benefits:

- **Query-friendly**: `WHERE is_system = true` to find system agents
- **Protection**: API delete/unregister handlers check `isSystem` and reject
- **UI filtering**: Agent list can show/hide system agents or display them differently
- **Forward-compatible**: If we add more system agents later, the pattern is established

The `namespace: 'system'` provides logical grouping, but `isSystem` is the enforcement mechanism.

### Registration Flow

```typescript
// In apps/server/src/index.ts, during startup:
async function ensureDamon(meshCore: MeshCore, dorkHome: string): Promise<void> {
  const existing = meshCore.get('damon');
  if (existing) return; // Already registered

  // Auto-register — every installation gets Damon automatically
  await meshCore.registerByPath(dorkHome, {
    id: 'damon',
    name: 'Damon',
    runtime: 'claude-code',
    namespace: 'system',
    isSystem: true,
    capabilities: ['tasks', 'summaries'],
    behavior: {
      responseMode: 'silent',
    },
    budget: {
      maxHopsPerMessage: 1,
      maxCallsPerHour: 20,
    },
  });
}
```

This runs after MeshCore initialization, before the scheduler starts. Idempotent — if Damon already exists, it's a no-op. Every DorkOS installation gets Damon automatically; it's not optional.

### Delete Protection

```typescript
// In agent unregister/delete handlers:
if (agent.isSystem) {
  throw new HttpError(403, 'System agents cannot be removed');
}
```

The UI should not render a delete option for system agents. The API rejects the attempt as a safety net.

## 3. How It Differs from Project Agents

| Aspect          | Project Agent                    | Damon                                                    |
| --------------- | -------------------------------- | -------------------------------------------------------- |
| **Scope**       | One project/codebase             | Cross-project, global                                    |
| **Discovery**   | Scanned from filesystem          | Auto-created on first startup                            |
| **Task files**  | `{project}/.dork/tasks/*.md`     | `{dorkHome}/tasks/*.md`                                  |
| **Interaction** | Interactive sessions via chat UI | No direct interaction — results visible in Activity feed |
| **Namespace**   | `home`, `projects`, etc.         | `system`                                                 |
| **Lifecycle**   | User registers/unregisters       | Always present, cannot be deleted (`isSystem: true`)     |
| **CWD**         | Its project directory            | Resolved per-task from `cwd` frontmatter field           |
| **Identity**    | ULID, user-chosen name           | Fixed ID `damon`, display name `Damon`                   |
| **Navigable**   | Yes — agent detail page          | Yes — same agent detail page, same UI patterns           |

## 4. Singleton Rationale

**One Damon per installation, not per project.** Why:

1. **Global tasks are global** — they don't belong to any project. Having multiple instances would create ambiguity about which one runs which task.
2. **Resource management is simpler** — one budget, one set of limits, one thing to monitor.
3. **Mental model is clear** — "Damon runs my global tasks." No selection, no configuration.
4. **Not optional** — every DorkOS installation gets Damon automatically. He's part of the OS, like `cron` or `syslog` in Unix.

If users need project-specific background work, that's just a project agent with scheduled tasks. Damon is specifically for work that transcends project boundaries.

## 5. Triggers

Damon is triggered the same way any agent runs tasks:

| Trigger       | How                                 | Example                                      |
| ------------- | ----------------------------------- | -------------------------------------------- |
| **Scheduled** | Cron expression in task frontmatter | `cron: "0 8 * * 1"` — weekly summary         |
| **Manual**    | "Run now" button in UI              | User clicks to generate an activity digest   |
| **On-demand** | API call                            | Another agent triggers a daemon task via API |

No new trigger mechanism is needed. The Pulse scheduler already handles all three.

## 6. CWD Resolution for Global Tasks

Project agents have an implicit CWD (their project directory). Damon doesn't — his "project" is `{dorkHome}`, which isn't a meaningful working directory for most tasks.

Resolution order for Damon's tasks:

1. **Explicit `cwd` in task frontmatter** — task says where to run
2. **Server default CWD** (`DORKOS_DEFAULT_CWD` or repo root) — fallback
3. **No CWD needed** — some tasks (summaries, digests) don't need a project context

This is already how `SchedulerService.resolveEffectiveCwd()` works — it falls back to `schedule.cwd ?? process.cwd()`. No changes needed.

## 7. Resource Management

Damon must not starve project agents of resources. Controls:

| Control                     | Mechanism                                  | Default                 |
| --------------------------- | ------------------------------------------ | ----------------------- |
| **Budget cap**              | `budget.maxCallsPerHour` in agent manifest | 20 calls/hour           |
| **Concurrent run limit**    | Scheduler's global `maxConcurrentRuns`     | Shared with all agents  |
| **Per-task timeout**        | `maxRuntime` in task frontmatter           | Per-task, e.g., `"10m"` |
| **Cron overrun protection** | `croner` with `protect: true`              | Already implemented     |

All of these are existing mechanisms. Damon's `budget` is the only Damon-specific config, and it uses the same schema as every other agent.

## 8. UI Implications

### Damon Is a First-Class Agent

Damon appears in the UI like any other agent — navigable, viewable, clickable. No hidden system tray or separate section. He's in the agent list, with a subtle visual distinction.

| Surface          | Behavior                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| **Agents page**  | Listed alongside project agents. Subtle "System" badge indicates he's auto-managed. No delete option.   |
| **Tasks page**   | Global tasks (Damon's tasks) appear alongside project tasks, filterable by agent.                       |
| **Dashboard**    | Damon's activity appears in the Activity feed like any other agent.                                     |
| **Agent detail** | Clicking Damon shows his task list, run history, and configuration. Same page layout as project agents. |

### What's Different

- **No delete/unregister button** — `isSystem: true` agents can't be removed
- **No discovery flow** — Damon is auto-created, not discovered by the scanner
- **No interactive chat** — Damon doesn't have user-initiated sessions (his sessions are task runs)

### Visual Treatment

Damon should be visually distinct but not segregated:

- **Badge**: Small "System" chip next to his name in lists
- **Color**: A default system color (configurable by user, like any agent)
- **Icon**: A default icon that suggests background work (configurable by user)

## 9. Decisions

| Question                  | Decision                                        | Rationale                                                           |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| Name?                     | **Damon**                                       | Greek myth (loyalty), near-homophone of "daemon", cheeky human name |
| New agent type or config? | **Existing infrastructure + `isSystem` column** | One new boolean column, everything else reuses existing fields      |
| Singleton or multiple?    | **Singleton**                                   | One Damon per installation, global tasks are global                 |
| Optional?                 | **No — auto-created for everyone**              | Part of the OS, like cron in Unix                                   |
| Own registry identity?    | **Yes** — fixed ID `damon`, namespace `system`  | Addressable by scheduler, visible in UI, protected from deletion    |
| Deletable?                | **No** — `isSystem: true` prevents removal      | System agents are part of the infrastructure                        |
| Navigable in UI?          | **Yes** — first-class agent, same UI patterns   | No hidden system tray; Damon is in the agent list like everyone     |
| How triggered?            | **Same as any task** — scheduled, manual, API   | No new trigger mechanism needed                                     |
| Resource management?      | **Existing budget + scheduler controls**        | `maxCallsPerHour`, `maxConcurrentRuns`, `maxRuntime`                |

## 10. Relationship to DOR-59 (File-Based Tasks)

Damon is the consumer of global task files:

- Task files at `{dorkHome}/tasks/*.md` are associated with Damon by default
- The `TaskFileWatcher` watches `{dorkHome}/tasks/` and associates discovered tasks with agent ID `damon`
- If a global task has an explicit `agent` field in frontmatter, it overrides the Damon association (allows routing global tasks to specific project agents)

This creates a clean separation:

- **DOR-59** defined the file format and sync model
- **DOR-60** (this issue) defines who runs the global files
