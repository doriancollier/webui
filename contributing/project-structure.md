# Project Structure Guide

## Overview

DorkOS uses Feature-Sliced Design (FSD) to organize frontend code by business domains with clear layer boundaries. The server uses a layered architecture (routes + services) with size-aware guidance for when to adopt domain grouping. The monorepo structure (Turborepo + npm workspaces) is orthogonal to FSD — FSD applies _within_ each app.

## Monorepo Layout

```
dorkos/
├── apps/
│   ├── client/           # @dorkos/client — React 19 SPA with FSD layers
│   ├── server/           # @dorkos/server — Express API (flat services)
│   ├── site/             # @dorkos/site — Marketing site & docs (Next.js 16, Fumadocs)
│   ├── obsidian-plugin/  # @dorkos/obsidian-plugin — Obsidian plugin
│   └── e2e/              # @dorkos/e2e — Playwright browser tests
├── packages/
│   ├── cli/              # dorkos — Publishable npm CLI
│   ├── shared/           # @dorkos/shared — Zod schemas, types, Transport interface
│   ├── db/               # @dorkos/db — Drizzle ORM schemas (SQLite)
│   ├── relay/            # @dorkos/relay — Inter-agent message bus
│   ├── mesh/             # @dorkos/mesh — Agent discovery & registry
│   ├── typescript-config/ # Shared tsconfig presets
│   ├── eslint-config/    # @dorkos/eslint-config — Shared ESLint presets
│   ├── icons/            # @dorkos/icons — SVG icon & logo registry
│   └── test-utils/       # Mock factories, test helpers
├── turbo.json
├── vitest.workspace.ts
└── package.json
```

**Key distinction:** `packages/shared` is monorepo-level infrastructure (Transport interface, Zod schemas). `apps/client/src/layers/shared/` is client-level FSD shared layer (UI primitives, utilities).

## Client FSD Structure (`apps/client/src/`)

```
src/
├── App.tsx              # App entry — embedded vs standalone mode switch
├── AppShell.tsx         # Standalone shell (sidebar, header, Outlet) — layout route component
├── router.tsx           # TanStack Router route tree (/, /session, _shell layout)
├── main.tsx             # Vite entry point — RouterProvider
├── index.css            # Global styles
├── app/
│   └── init-extensions.ts  # Registers all built-in contributions into the extension registry at startup
├── layers/              # FSD architecture layers
│   ├── shared/          # Reusable utilities, UI primitives, hooks & stores
│   │   ├── ui/          # Shadcn components (button, card, dialog, etc.)
│   │   ├── model/       # TransportContext, app-store, extension-registry, hooks (useTheme, useIsMobile, etc.)
│   │   └── lib/         # cn(), Transports, font-config, favicon-utils, celebrations, ui-action-dispatcher
│   ├── entities/        # Business domain objects
│   │   ├── session/     # Session types, hooks, transport calls
│   │   │   ├── ui/
│   │   │   ├── model/
│   │   │   ├── api/
│   │   │   └── index.ts
│   │   ├── command/     # Command types, hooks
│   │   │   ├── model/
│   │   │   ├── api/
│   │   │   └── index.ts
│   │   ├── agent/       # Agent identity hooks (useCurrentAgent, useAgentToolStatus, etc.)
│   │   ├── tasks/       # Task scheduler hooks (useSchedules, useRuns, etc.)
│   │   ├── relay/       # Relay messaging hooks (useRelayMessages, useRelayAdapters, etc.)
│   │   ├── mesh/        # Mesh discovery hooks (useRegisteredAgents, useDiscoverAgents, etc.)
│   │   ├── discovery/   # Shared discovery scan state (Zustand store + useDiscoveryScan hook)
│   │   ├── runtime/     # Runtime capabilities (useRuntimeCapabilities, useDefaultCapabilities)
│   │   ├── tunnel/      # Tunnel state hooks
│   │   └── binding/     # Adapter-agent binding hooks (useBindings, useCreateBinding, etc.)
│   ├── features/        # Complete user-facing functionality
│   │   ├── chat/        # ChatPanel, MessageList, streaming, useChatSession
│   │   │   ├── ui/
│   │   │   ├── model/
│   │   │   ├── api/
│   │   │   └── index.ts
│   │   ├── command-palette/ # Global Cmd+K palette (Fuse.js search, agent preview, sub-menus)
│   │   ├── commands/    # Inline slash command palette (chat input)
│   │   ├── session-list/ # SessionSidebar, SidebarTabRow, tabbed views
│   │   ├── dashboard-sidebar/ # DashboardSidebar — navigation + recent agents list at /
│   │   ├── dashboard-attention/ # NeedsAttentionSection — conditional zero-DOM attention zone
│   │   ├── dashboard-sessions/ # ActiveSessionsSection — active session cards grid (2h window)
│   │   ├── dashboard-status/ # SystemStatusRow — Tasks/Relay/Mesh health cards + activity sparkline
│   │   ├── dashboard-activity/ # RecentActivityFeed — time-grouped event feed with last-visit tracking
│   │   ├── settings/    # SettingsDialog (Appearance, Preferences, Status Bar, Server, Tools, Advanced)
│   │   ├── agent-settings/ # AgentDialog (IdentityTab, PersonaTab, CapabilitiesTab, ConnectionsTab)
│   │   ├── files/       # FileBrowser
│   │   ├── tasks/        # TasksPanel, ScheduleRow, CronVisualBuilder, AgentCombobox
│   │   ├── relay/       # RelayPanel, ActivityFeed, AdapterCard, AdapterSetupWizard
│   │   ├── mesh/        # MeshPanel, TopologyGraph, AgentNode, BindingDialog
│   │   ├── onboarding/  # OnboardingFlow, AgentDiscoveryStep, TaskPresetsStep
│   │   ├── canvas/      # AgentCanvas split-view panel (JSON, Markdown, URL content renderers)
│   │   └── status/      # StatusLine, GitStatusItem, ModelItem
│   └── widgets/         # Large UI compositions
│       ├── app-layout/  # Header, Layout, main workspace
│       │   ├── ui/
│       │   └── index.ts
│       ├── dashboard/   # DashboardPage — status overview at /
│       │   ├── ui/
│       │   └── index.ts
│       └── session/     # SessionPage — agent chat wrapper at /session
│           ├── ui/
│           └── index.ts
└── contexts/            # React Context (TransportProvider)
```

## FSD Layer Hierarchy

Unidirectional dependencies from top to bottom:

```
app → widgets → features → entities → shared
```

| Layer       | Purpose                                                         | Can Import From            |
| ----------- | --------------------------------------------------------------- | -------------------------- |
| `app/`      | App.tsx, AppShell.tsx, router.tsx, main.tsx, init-extensions.ts | All lower layers           |
| `widgets/`  | Large compositions (layout, workspace)                          | features, entities, shared |
| `features/` | Complete user functionality (chat, commands)                    | entities, shared           |
| `entities/` | Business domain objects (Session, Command)                      | shared only                |
| `shared/`   | UI primitives, utilities, Transport                             | Nothing (base layer)       |

**Critical rules:**

- Higher layers import from lower layers only
- Never import upward (entities cannot import features)
- Never import across same-level modules (feature A cannot import feature B)
- Compose cross-feature interactions at the widget or app level

## Standard Segments

Each FSD module uses these directories by purpose:

```
[layer]/[module-name]/
├── ui/          # React components (.tsx)
├── model/       # Business logic, hooks, stores, types (.ts)
├── api/         # Transport calls, data fetching (.ts)
├── lib/         # Pure utilities, helpers (.ts)
├── config/      # Constants, configuration (.ts)
├── __tests__/   # Tests (co-located)
└── index.ts     # Public API exports (REQUIRED)
```

Not all segments are needed — create only what the module requires.

## Public API via index.ts

Every module MUST have an `index.ts` that exports its public API. Other layers import from this file only.

```typescript
// entities/session/index.ts
export { SessionBadge } from './ui/SessionBadge';
export { useSession, useSessions } from './model/hooks';
export type { Session, SessionMetadata } from './model/types';

// DON'T export internals
// export { parseTranscript } from './lib/transcript-parser'  // Keep internal
```

```typescript
// Consumer imports from index
import { SessionBadge, useSession } from '@/layers/entities/session';

// NEVER import internal paths
import { SessionBadge } from '@/layers/entities/session/ui/SessionBadge'; // WRONG
```

## Adding a New Feature

1. **Create directory structure:**

   ```bash
   mkdir -p apps/client/src/layers/features/my-feature/{ui,model,api}
   touch apps/client/src/layers/features/my-feature/index.ts
   ```

2. **Add types** in `model/types.ts`:

   ```typescript
   export interface MyFeatureState {
     isActive: boolean;
     data: SomeEntity[];
   }
   ```

3. **Add hooks** in `model/`:

   ```typescript
   // model/use-my-feature.ts
   import { useTransport } from '@/layers/shared/model';
   import type { Session } from '@/layers/entities/session';
   ```

4. **Build UI** in `ui/`:

   ```typescript
   // ui/MyFeature.tsx
   import { Button } from '@/layers/shared/ui';
   import { useSession } from '@/layers/entities/session';
   import { useMyFeature } from '../model/use-my-feature';
   ```

5. **Export public API** in `index.ts`:

   ```typescript
   export { MyFeature } from './ui/MyFeature';
   export { useMyFeature } from './model/use-my-feature';
   ```

6. **Use in widget or app:**
   ```typescript
   // widgets/app-layout/ui/Layout.tsx
   import { MyFeature } from '@/layers/features/my-feature';
   ```

## Adding a New Entity

1. **Create directory:**

   ```bash
   mkdir -p apps/client/src/layers/entities/my-entity/{ui,model,api}
   touch apps/client/src/layers/entities/my-entity/index.ts
   ```

2. **Define types** (typically mirrors `@dorkos/shared` schemas):

   ```typescript
   // model/types.ts
   import type { Session } from '@dorkos/shared/types';
   export type { Session }; // Re-export for layer consumers
   ```

3. **Add data access** via Transport:

   ```typescript
   // api/queries.ts
   import { useTransport } from '@/layers/shared/model';

   export function useSessionQuery(id: string) {
     const transport = useTransport();
     // TanStack Query integration
   }
   ```

4. **Export public API.**

## Server Structure (`apps/server/src/`)

The server uses flat routes + domain-grouped services (not FSD layers):

```
apps/server/src/
├── app.ts           # Express app configuration
├── index.ts         # Server entry point
├── env.ts           # Zod-validated environment config
├── routes/          # HTTP endpoint handlers (thin, delegate to services)
│   ├── sessions.ts
│   ├── commands.ts
│   ├── health.ts
│   ├── directory.ts
│   ├── config.ts
│   ├── files.ts
│   ├── git.ts
│   ├── tunnel.ts
│   ├── pulse.ts
│   ├── relay.ts
│   ├── mesh.ts
│   ├── agents.ts
│   ├── models.ts
│   ├── capabilities.ts
│   ├── discovery.ts
│   └── admin.ts
├── services/
│   ├── core/                    # Shared infrastructure services
│   │   ├── runtime-registry.ts  # Registry of AgentRuntime instances (keyed by type)
│   │   ├── config-manager.ts    # Persistent user config (~/.dork/config.json)
│   │   ├── stream-adapter.ts    # SSE helpers (initSSEStream, sendSSEEvent, endSSEStream)
│   │   ├── openapi-registry.ts  # Auto-generated OpenAPI spec from Zod schemas
│   │   ├── file-lister.ts       # Directory file listing
│   │   ├── git-status.ts        # Git status/branch info
│   │   ├── tunnel-manager.ts    # ngrok tunnel lifecycle
│   │   └── update-checker.ts    # npm registry version check (1-hour cache)
│   ├── runtimes/                # Agent backend implementations
│   │   └── claude-code/         # ClaudeCodeRuntime — the only current backend
│   │       ├── claude-code-runtime.ts  # Implements AgentRuntime interface
│   │       ├── agent-types.ts          # AgentSession, ToolState interfaces
│   │       ├── sdk-event-mapper.ts     # SDK message → StreamEvent mapper
│   │       ├── context-builder.ts      # Runtime context for systemPrompt (XML blocks)
│   │       ├── tool-filter.ts          # Per-agent MCP tool filtering
│   │       ├── interactive-handlers.ts # Tool approval & AskUserQuestion flows
│   │       ├── message-sender.ts       # Extracted send-message logic
│   │       ├── command-registry.ts     # Slash command discovery
│   │       ├── transcript-reader.ts    # JSONL session reader (single source of truth)
│   │       ├── transcript-parser.ts    # JSONL line → HistoryMessage parser
│   │       ├── session-broadcaster.ts  # Cross-client session sync via chokidar
│   │       ├── session-lock.ts         # Session write locks with auto-expiry
│   │       ├── build-task-event.ts     # TaskUpdateEvent builder
│   │       ├── task-reader.ts          # Task state parser from JSONL
│   │       ├── sdk-utils.ts            # makeUserPrompt(), resolveClaudeCliPath()
│   │       ├── mcp-tools/              # In-process MCP tool server for Claude Agent SDK
│   │       └── index.ts                # Barrel export for ClaudeCodeRuntime
│   ├── tasks/                   # Task scheduler services
│   │   ├── tasks-store.ts       # SQLite + JSON schedule/run state
│   │   ├── scheduler-service.ts # Cron engine (croner) with overrun protection
│   │   ├── task-presets.ts      # Default task presets
│   │   └── tasks-state.ts       # DORKOS_TASKS_ENABLED feature flag holder
│   ├── relay/                   # Relay messaging services
│   │   ├── adapter-manager.ts   # Server-side adapter lifecycle management
│   │   ├── adapter-factory.ts   # Adapter instantiation from config
│   │   ├── adapter-config.ts    # Config load/save/watch, sensitive field masking
│   │   ├── adapter-error.ts     # AdapterError typed error class
│   │   ├── binding-store.ts     # JSON-backed adapter-agent binding store
│   │   ├── binding-router.ts    # relay.human.> → relay.agent.{sessionId} routing
│   │   ├── trace-store.ts       # SQLite delivery trace storage (message_traces table)
│   │   ├── relay-state.ts       # DORKOS_RELAY_ENABLED feature flag holder
│   │   └── subject-resolver.ts  # Subject pattern resolution helpers
│   ├── mesh/                    # Mesh state
│   │   └── mesh-state.ts        # Internal state tracking (Mesh is always-on)
│   └── discovery/               # Agent discovery (delegates to @dorkos/mesh unified scanner)
├── lib/             # Shared utilities
│   ├── resolve-root.ts  # DEFAULT_CWD (prefers DORKOS_DEFAULT_CWD, falls back to repo root)
│   ├── boundary.ts      # Directory boundary validation (403 for out-of-boundary paths)
│   ├── dork-home.ts     # resolveDorkHome() — single source of truth for data directory
│   └── feature-flag.ts  # Generic feature flag helpers
└── middleware/
```

Routes are thin HTTP handlers — they delegate to services. Routes obtain the active runtime via `runtimeRegistry.getDefault()`, never referencing `ClaudeCodeRuntime` directly.

## Import Patterns

```typescript
// FSD layer imports (within apps/client)
import { ChatPanel } from '@/layers/features/chat';
import { useSession } from '@/layers/entities/session';
import { Button } from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib/utils';

// Cross-package imports (monorepo level — always allowed)
import type { Session, StreamEvent } from '@dorkos/shared/types';
import { SessionSchema } from '@dorkos/shared/schemas';
```

## File Naming

| Type             | Convention                  | Example                             |
| ---------------- | --------------------------- | ----------------------------------- |
| React components | PascalCase                  | `ChatPanel.tsx`, `SessionBadge.tsx` |
| Hooks            | `use-` prefix, kebab-case   | `use-chat-session.ts`               |
| Stores           | `-store` suffix, kebab-case | `app-store.ts`                      |
| Types            | `types.ts` in `model/`      | `entities/session/model/types.ts`   |
| Utilities        | kebab-case                  | `stream-parser.ts`                  |
| Index            | `index.ts`                  | Public API barrel export            |

## Anti-Patterns

```typescript
// NEVER import upward in layer hierarchy
// In entities/session/model/hooks.ts
import { ChatPanel } from '@/layers/features/chat'; // features is higher!

// NEVER import across same-level modules
// In features/chat/ui/ChatPanel.tsx
import { CommandPalette } from '@/layers/features/commands'; // Cross-feature!
// FIX: Compose both in widgets/app-layout/

// NEVER import from internal paths
import { Button } from '@/layers/shared/ui/button'; // WRONG
import { Button } from '@/layers/shared/ui'; // CORRECT (from index)

// NEVER put business logic in shared/
// shared/lib/session-utils.ts → WRONG
// entities/session/model/helpers.ts → CORRECT
```

## Transport & FSD Integration

The hexagonal Transport interface bridges FSD and the monorepo:

```
packages/shared/transport.ts    → Transport interface (port)
layers/shared/lib/              → HttpTransport, DirectTransport (adapters)
layers/shared/model/            → TransportContext (React DI), app-store, hooks
layers/entities/*/api/          → Transport consumption (queries/mutations)
layers/features/*/model/        → Hooks composing entity data
```

## Troubleshooting

### "Cannot find module '@/layers/...'"

Verify `tsconfig.json` has `"@/*": ["./src/*"]` path alias and `vite.config.ts` has matching resolve alias.

### Circular dependency detected

Usually indicates wrong layer placement. Check for upward imports or cross-module imports at the same level.

### "Where does this code go?"

Use the layer decision tree in the `organizing-fsd-architecture` skill.

## References

- [Feature-Sliced Design Documentation](https://feature-sliced.design/)
- `contributing/architecture.md` — Hexagonal architecture, Transport interface
- `.claude/skills/organizing-fsd-architecture/` — Layer placement skill
