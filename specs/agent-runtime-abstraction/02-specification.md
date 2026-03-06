# Agent Runtime Abstraction

**Status:** Draft
**Authors:** Claude (spec), Dorian Collier (decisions)
**Created:** 2026-03-06
**Spec Number:** 97
**Ideation:** [01-ideation.md](./01-ideation.md) (Claude Code Adapter Audit)

---

## Overview

Extract a universal `AgentRuntime` interface from the existing `AgentManager` to decouple DorkOS from the Claude Agent SDK. All Claude Code-specific logic moves behind `ClaudeCodeRuntime implements AgentRuntime`. A `RuntimeRegistry` holds multiple runtimes keyed by type, enabling future multi-agent backends (OpenCode, Aider, etc.) without touching routes, client, or shared schemas.

This is a refactor — no user-visible behavior changes. Every existing feature continues to work identically.

## Background / Problem Statement

DorkOS has **two parallel paths** to Claude Code:

1. **Direct path:** `sessions.ts` → `AgentManager` → SDK `query()` — used by the web UI
2. **Relay path:** `sessions.ts` → Relay bus → `ClaudeCodeAdapter` → `AgentManager` → SDK `query()` — used when Relay is enabled

Both converge at `AgentManager`, which is a monolithic Claude SDK wrapper with no abstraction. The `ClaudeCodeAdapter` only covers the Relay path (~40% of interactions). Beyond messaging, Claude Code coupling runs deep: JSONL transcript storage, file watching, permission modes, tool approval, model lists, MCP tools, and command registry are all hardcoded to SDK specifics.

The existing Relay adapter pattern (ADR-0029) is well-designed. The `AgentManagerLike` interface, `StreamEvent` type, and adapter lifecycle are solid. They just need to be promoted to the universal abstraction layer.

## Goals

- Define an `AgentRuntime` interface that any agent backend can implement
- Encapsulate all Claude Agent SDK imports inside `ClaudeCodeRuntime` and its internal services
- Route all server interactions through `RuntimeRegistry`, never directly to `AgentManager`
- Enable multi-runtime support (different agents can use different backends)
- Drive client UI from runtime capabilities (permission modes, cost tracking, tool approval)
- Abstract MCP tool injection so runtimes provide their own tool protocols
- Preserve all existing functionality — zero behavioral changes

## Non-Goals

- Implementing a second runtime (OpenCode, Aider) — this spec only creates the abstraction
- Changing the JSONL storage format or session ID scheme
- Modifying the Relay or Mesh subsystems beyond updating their integration points
- Redesigning the Transport interface (it remains the client-server boundary; this spec changes what's behind it)
- Abstracting the CLI's dependency on the `claude` binary (deferred to when a second runtime is added)

## Technical Dependencies

- `@anthropic-ai/claude-agent-sdk` — existing dependency, usage confined to `ClaudeCodeRuntime`
- No new external dependencies

## Detailed Design

### 1. `AgentRuntime` Interface

Extracted from `AgentManager` public API + `AgentManagerLike` + `TranscriptReader`:

```typescript
// packages/shared/src/agent-runtime.ts

export interface RuntimeCapabilities {
  /** Runtime identifier */
  readonly type: string; // 'claude-code' | 'opencode' | 'aider'

  /** Whether this runtime supports permission modes */
  supportsPermissionModes: boolean;
  supportedPermissionModes?: PermissionMode[];

  /** Whether tool approval UI should be shown */
  supportsToolApproval: boolean;

  /** Whether cost/token tracking is available */
  supportsCostTracking: boolean;

  /** Whether sessions can be resumed */
  supportsResume: boolean;

  /** Whether MCP tool servers can be injected */
  supportsMcp: boolean;

  /** Whether AskUserQuestion interactive flow is supported */
  supportsQuestionPrompt: boolean;
}

export interface SessionOpts {
  permissionMode: PermissionMode;
  cwd?: string;
  hasStarted?: boolean;
}

export interface MessageOpts {
  permissionMode?: PermissionMode;
  cwd?: string;
  systemPromptAppend?: string;
}

export interface AgentRuntime {
  /** Runtime type identifier */
  readonly type: string;

  // --- Session lifecycle ---
  ensureSession(sessionId: string, opts: SessionOpts): void;
  hasSession(sessionId: string): boolean;
  updateSession(sessionId: string, opts: {
    permissionMode?: PermissionMode;
    model?: string;
  }): boolean;

  // --- Messaging ---
  sendMessage(
    sessionId: string,
    content: string,
    opts?: MessageOpts
  ): AsyncGenerator<StreamEvent>;

  // --- Interactive flows ---
  approveTool(sessionId: string, toolCallId: string, approved: boolean): boolean;
  submitAnswers(
    sessionId: string,
    toolCallId: string,
    answers: Record<string, string>
  ): boolean;

  // --- Session queries (storage) ---
  listSessions(projectDir: string): Promise<Session[]>;
  getSession(projectDir: string, sessionId: string): Promise<Session | null>;
  getMessageHistory(projectDir: string, sessionId: string): Promise<HistoryMessage[]>;
  getSessionTasks(projectDir: string, sessionId: string): Promise<TaskItem[]>;
  getSessionETag(projectDir: string, sessionId: string): Promise<string | null>;
  readFromOffset(
    projectDir: string,
    sessionId: string,
    offset: number
  ): Promise<{ content: string; newOffset: number }>;

  // --- Session sync ---
  watchSession(
    sessionId: string,
    projectDir: string,
    callback: (event: StreamEvent) => void,
    clientId?: string
  ): () => void; // returns unsubscribe

  // --- Session locking ---
  acquireLock(sessionId: string, clientId: string, res: Response): boolean;
  releaseLock(sessionId: string, clientId: string): void;
  isLocked(sessionId: string, clientId?: string): boolean;
  getLockInfo(sessionId: string): { clientId: string; acquiredAt: number } | null;

  // --- Capabilities ---
  getSupportedModels(): Promise<ModelOption[]>;
  getCapabilities(): RuntimeCapabilities;

  // --- Commands ---
  getCommands(forceRefresh?: boolean): Promise<CommandRegistry>;

  // --- Lifecycle ---
  checkSessionHealth(): void;
  getInternalSessionId(sessionId: string): string | undefined;

  // --- Tool server (optional) ---
  getToolServerConfig?(): Record<string, unknown>;
  setMcpServerFactory?(factory: () => Record<string, unknown>): void;

  // --- Dependency injection (optional) ---
  setMeshCore?(meshCore: unknown): void;
  setRelay?(relay: unknown): void;
}
```

**Design rationale:**

- `listSessions`, `getMessageHistory`, `watchSession` move from TranscriptReader/SessionBroadcaster onto the interface because session storage is runtime-specific (JSONL for Claude, something else for OpenCode)
- `getCapabilities()` returns static metadata that the client uses for feature detection
- Optional methods (`getToolServerConfig`, `setMcpServerFactory`, `setMeshCore`, `setRelay`) are runtime-specific hooks — not all runtimes need MCP or Mesh
- `StreamEvent` remains the universal event type — it's already well-designed and runtime-agnostic
- `getSdkSessionId` is kept because session ID mapping is a legitimate runtime concern (Mesh ULID → SDK UUID)

### 2. `RuntimeRegistry`

```typescript
// apps/server/src/services/core/runtime-registry.ts

export class RuntimeRegistry {
  private runtimes = new Map<string, AgentRuntime>();
  private defaultType: string = 'claude-code';

  register(runtime: AgentRuntime): void {
    this.runtimes.set(runtime.type, runtime);
  }

  get(type: string): AgentRuntime {
    const runtime = this.runtimes.get(type);
    if (!runtime) throw new Error(`Runtime '${type}' not registered`);
    return runtime;
  }

  getDefault(): AgentRuntime {
    return this.get(this.defaultType);
  }

  /** Resolve runtime for a specific agent (looks up agent manifest's runtime field) */
  resolveForAgent(agentId: string, meshCore?: MeshCore): AgentRuntime {
    if (meshCore) {
      const agent = meshCore.getAgent(agentId);
      if (agent?.runtime) {
        return this.get(agent.runtime);
      }
    }
    return this.getDefault();
  }

  setDefault(type: string): void {
    if (!this.runtimes.has(type)) throw new Error(`Runtime '${type}' not registered`);
    this.defaultType = type;
  }

  listRuntimes(): AgentRuntime[] {
    return Array.from(this.runtimes.values());
  }

  getAllCapabilities(): Record<string, RuntimeCapabilities> {
    const caps: Record<string, RuntimeCapabilities> = {};
    for (const [type, runtime] of this.runtimes) {
      caps[type] = runtime.getCapabilities();
    }
    return caps;
  }
}

/** Singleton — initialized at server startup */
export const runtimeRegistry = new RuntimeRegistry();
```

### 3. `ClaudeCodeRuntime`

Rename `AgentManager` → `ClaudeCodeRuntime implements AgentRuntime`. Encapsulates:

- `TranscriptReader` (JSONL parsing)
- `TranscriptParser` (SDK message format)
- `SessionBroadcaster` (chokidar file watching)
- `InteractiveHandlers` (SDK `PermissionResult`)
- `SdkEventMapper` (SDK message → StreamEvent)
- `ContextBuilder` (system prompt assembly)
- `ToolFilter` (per-agent MCP tool filtering)
- `SessionLockManager` (concurrent write protection)
- MCP tool server creation (`createSdkMcpServer`)

```typescript
// apps/server/src/services/runtimes/claude-code/claude-code-runtime.ts

import type { AgentRuntime, RuntimeCapabilities, SessionOpts, MessageOpts } from '@dorkos/shared/agent-runtime';

export class ClaudeCodeRuntime implements AgentRuntime {
  readonly type = 'claude-code' as const;

  private transcriptReader: TranscriptReader;
  private broadcaster: SessionBroadcaster;
  private sessions: Map<string, AgentSession>;
  private lockManager: SessionLockManager;
  // ... all current AgentManager internals

  constructor(cwd?: string) {
    this.transcriptReader = new TranscriptReader();
    this.broadcaster = new SessionBroadcaster(this.transcriptReader);
    // ... same initialization as current AgentManager
  }

  getCapabilities(): RuntimeCapabilities {
    return {
      type: 'claude-code',
      supportsPermissionModes: true,
      supportedPermissionModes: ['default', 'plan', 'acceptEdits', 'bypassPermissions'],
      supportsToolApproval: true,
      supportsCostTracking: true,
      supportsResume: true,
      supportsMcp: true,
      supportsQuestionPrompt: true,
    };
  }

  // --- Session queries delegate to TranscriptReader ---
  async listSessions(projectDir: string): Promise<Session[]> {
    return this.transcriptReader.listSessions(projectDir);
  }

  async getSession(projectDir: string, sessionId: string): Promise<Session | null> {
    return this.transcriptReader.getSession(projectDir, sessionId);
  }

  async getMessageHistory(projectDir: string, sessionId: string): Promise<HistoryMessage[]> {
    return this.transcriptReader.readTranscript(projectDir, sessionId);
  }

  // --- Session sync delegates to SessionBroadcaster ---
  watchSession(
    sessionId: string,
    projectDir: string,
    callback: (event: StreamEvent) => void,
    clientId?: string
  ): () => void {
    // Wraps broadcaster.registerClient/deregisterClient
    // Returns unsubscribe function
  }

  // ... all other AgentManager methods, unchanged in behavior
}
```

**File organization:**

```
apps/server/src/services/runtimes/
└── claude-code/
    ├── claude-code-runtime.ts     # Main runtime (renamed from agent-manager.ts)
    ├── agent-types.ts             # AgentSession, ToolState (moved from core/)
    ├── sdk-event-mapper.ts        # SDK message → StreamEvent (moved from core/)
    ├── interactive-handlers.ts    # Tool approval, PermissionResult (moved from core/)
    ├── context-builder.ts         # System prompt assembly (moved from core/)
    ├── tool-filter.ts             # Per-agent tool filtering (moved from core/)
    ├── session-lock.ts            # Session locking (moved from session/)
    ├── transcript-reader.ts       # JSONL reader (moved from session/)
    ├── transcript-parser.ts       # JSONL parser (moved from session/)
    ├── session-broadcaster.ts     # File watcher + SSE (moved from session/)
    ├── build-task-event.ts        # Task event builder (moved from session/)
    ├── task-reader.ts             # Task state parser (moved from session/)
    ├── command-registry.ts        # .claude/commands/ scanner (moved from core/)
    └── mcp-tools/                 # MCP tool server (moved from core/mcp-tools/)
        ├── index.ts
        ├── core-tools.ts
        ├── pulse-tools.ts
        ├── relay-tools.ts
        ├── mesh-tools.ts
        ├── adapter-tools.ts
        ├── binding-tools.ts
        └── trace-tools.ts
```

### 4. Route Updates

All routes switch from importing `agentManager` singleton to `runtimeRegistry`:

**Before:**
```typescript
import { agentManager } from '../services/core/agent-manager';

router.post('/:id/messages', async (req, res) => {
  agentManager.ensureSession(sessionId, opts);
  for await (const event of agentManager.sendMessage(sessionId, content)) {
    sendSSEEvent(res, event);
  }
});
```

**After:**
```typescript
import { runtimeRegistry } from '../services/core/runtime-registry';

router.post('/:id/messages', async (req, res) => {
  const runtime = runtimeRegistry.getDefault();
  runtime.ensureSession(sessionId, opts);
  for await (const event of runtime.sendMessage(sessionId, content)) {
    sendSSEEvent(res, event);
  }
});
```

**Routes affected:**

| Route | Changes |
|-------|---------|
| `sessions.ts` | Replace 9 `agentManager.*` calls with `runtime.*` |
| `models.ts` | Replace `agentManager.getSupportedModels()` with `runtime.getSupportedModels()` |
| `config.ts` | Replace `resolveClaudeCliPath()` — move to runtime-specific utility |

| `commands.ts` | Replace `commandRegistryService.getCommands()` with `runtime.getCommands()` |

**Routes unchanged:** `health.ts`, `directory.ts`, `files.ts`, `git.ts`, `tunnel.ts`, `pulse.ts`, `relay.ts`, `mesh.ts`, `agents.ts`, `discovery.ts`

### 5. ClaudeCodeAdapter Update

The Relay adapter switches from `AgentManagerLike` to `AgentRuntime`:

**Before:**
```typescript
interface AgentManagerLike {
  ensureSession(sessionId, opts): void;
  sendMessage(sessionId, content, opts?): AsyncGenerator<StreamEvent>;
  getSdkSessionId(sessionId): string | undefined;
}
```

**After:**
```typescript
// ClaudeCodeAdapter constructor takes AgentRuntime instead of AgentManagerLike
constructor(deps: {
  runtime: AgentRuntime;  // was: agentManager: AgentManagerLike
  relayCore: RelayCore;
  traceStore: TraceStore;
  // ...
})
```

The adapter becomes a thin Relay-to-Runtime bridge. Its internal calls remain the same (`runtime.ensureSession()`, `runtime.sendMessage()`), just through the universal interface.

### 6. Server Startup (`index.ts`)

```typescript
// Before
import { agentManager } from './services/core/agent-manager';
agentManager.setMcpServerFactory(createMcpFactory);
agentManager.setMeshCore(meshCore);

// After
import { ClaudeCodeRuntime } from './services/runtimes/claude-code/claude-code-runtime';
import { runtimeRegistry } from './services/core/runtime-registry';

const claudeRuntime = new ClaudeCodeRuntime(defaultCwd);
claudeRuntime.setMcpServerFactory(createMcpFactory);
claudeRuntime.setMeshCore(meshCore);
claudeRuntime.setRelay(relayCore);

runtimeRegistry.register(claudeRuntime);
// runtimeRegistry.setDefault('claude-code'); // already default
```

### 7. Transport & Client Updates

#### 7a. Capabilities API

Add a capabilities endpoint:

```typescript
// GET /api/capabilities
router.get('/capabilities', (req, res) => {
  const capabilities = runtimeRegistry.getAllCapabilities();
  res.json({ capabilities, defaultRuntime: 'claude-code' });
});
```

Transport interface addition:
```typescript
// packages/shared/src/transport.ts
export interface Transport {
  // ... existing methods ...
  getCapabilities(): Promise<{
    capabilities: Record<string, RuntimeCapabilities>;
    defaultRuntime: string;
  }>;
}
```

#### 7b. Client Capability Detection

Replace hardcoded Claude assumptions with capability checks:

```typescript
// New hook: useRuntimeCapabilities
export function useRuntimeCapabilities() {
  return useQuery({
    queryKey: ['capabilities'],
    queryFn: () => transport.getCapabilities(),
    staleTime: Infinity, // capabilities don't change during a session
  });
}

// Usage in components:
function SessionItem({ session }: { session: Session }) {
  const { data } = useRuntimeCapabilities();
  const caps = data?.capabilities[data.defaultRuntime];

  return (
    <div>
      {caps?.supportsPermissionModes && (
        <PermissionModeIndicator mode={session.permissionMode} />
      )}
      {caps?.supportsCostTracking && session.costUsd && (
        <CostIndicator cost={session.costUsd} />
      )}
    </div>
  );
}
```

**Client files affected:**

| File | Change |
|------|--------|
| `use-session-status.ts` | Replace hardcoded `MODEL_CONTEXT_WINDOWS` with models from `getModels()` |
| `SessionItem.tsx` | Gate permission mode display on `supportsPermissionModes` |
| `ToolApproval.tsx` | Gate on `supportsToolApproval` |
| `QuestionPrompt.tsx` | Gate on `supportsQuestionPrompt` |
| `http-transport.ts` | Add `getCapabilities()` method |
| `direct-transport.ts` | Add `getCapabilities()` method (returns ClaudeCode capabilities directly) |
| `constants.ts` | Remove hardcoded model context windows (now server-driven) |

### 8. Shared Schema Updates

```typescript
// packages/shared/src/agent-runtime.ts (NEW FILE)
export interface RuntimeCapabilities { ... }
export interface AgentRuntime { ... }
export interface SessionOpts { ... }
export interface MessageOpts { ... }
```

`PermissionMode`, `StreamEvent`, `Session`, `ModelOption` remain unchanged — they're already runtime-agnostic types. `PermissionMode` values are Claude-specific but the type itself is generic (other runtimes just won't use all values).

### 9. DirectTransport Update (Obsidian Plugin)

`DirectTransportServices` interface changes from `agentManager` to `runtime`:

```typescript
export interface DirectTransportServices {
  runtime: AgentRuntime;  // was: agentManager: { ... }
  commandRegistry: { ... };
  fileLister?: { ... };
  gitStatus?: { ... };
  vaultRoot: string;
}
```

The Obsidian plugin creates `ClaudeCodeRuntime` directly (no registry needed in embedded mode).

### 10. MCP Tool Abstraction

The MCP tool server factory moves into `ClaudeCodeRuntime`. The runtime exposes tools via `getToolServerConfig()`:

```typescript
// On AgentRuntime (optional method)
getToolServerConfig?(): Record<string, unknown>;

// ClaudeCodeRuntime implementation
getToolServerConfig(): Record<string, McpServerConfig> {
  return createDorkOsToolServer(this.mcpToolDeps);
}
```

Routes that currently call `agentManager.setMcpServerFactory()` call `runtime.setMcpServerFactory()` instead. The factory pattern remains — only the import path changes.

Future runtimes that don't support MCP simply don't implement `getToolServerConfig()`. The `capabilities.supportsMcp` flag tells the server whether to inject tools.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                       │
│  useRuntimeCapabilities() → gates UI features               │
│  Transport interface → unchanged                            │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTP/SSE
┌─────────────────▼───────────────────────────────────────────┐
│                     Server (Express)                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ sessions.ts  │  │  models.ts   │  │   config.ts      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘  │
│         │                 │                  │              │
│         ▼                 ▼                  ▼              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              RuntimeRegistry (singleton)              │   │
│  │  ┌─────────────────────┐  ┌───────────────────────┐  │   │
│  │  │  ClaudeCodeRuntime  │  │  (future runtimes)    │  │   │
│  │  │  ┌───────────────┐  │  │                       │  │   │
│  │  │  │ TranscriptRdr │  │  │  OpenCodeRuntime      │  │   │
│  │  │  │ SdkEventMapper│  │  │  AiderRuntime         │  │   │
│  │  │  │ Broadcaster   │  │  │  ...                  │  │   │
│  │  │  │ MCP Tools     │  │  │                       │  │   │
│  │  │  │ InteractiveH  │  │  └───────────────────────┘  │   │
│  │  │  └───────────────┘  │                              │   │
│  │  └─────────────────────┘                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────┐                                       │
│  │  Relay Bus       │                                       │
│  │  ┌──────────────┐│                                       │
│  │  │ CCA Adapter  ├┼──── wraps AgentRuntime ──────────┐   │
│  │  └──────────────┘│                                   │   │
│  └──────────────────┘                                   │   │
│                                                          │   │
│  ClaudeCodeAdapter.runtime = runtimeRegistry.get('cc')◄──┘   │
└─────────────────────────────────────────────────────────────┘
```

## User Experience

No user-visible changes. This is a pure refactor. All existing features (chat, tool approval, session sync, Relay, Mesh, Pulse) continue to work identically.

The only observable difference is a new `GET /api/capabilities` endpoint that returns runtime metadata. This is additive and non-breaking.

## Testing Strategy

### Unit Tests

**New tests:**

| Test | Purpose |
|------|---------|
| `runtime-registry.test.ts` | Registry CRUD, default resolution, `resolveForAgent()` |
| `claude-code-runtime.test.ts` | Verify `ClaudeCodeRuntime` implements `AgentRuntime` correctly — delegates to internal services |

**Updated tests:**

| Test | Change |
|------|--------|
| `sessions.test.ts` | Mock `runtimeRegistry.getDefault()` instead of `agentManager` |
| `agent-manager.test.ts` | Rename to `claude-code-runtime.test.ts`, update imports |
| `session-broadcaster.test.ts` | Update import paths |
| `transcript-reader.test.ts` | Update import paths |
| `use-chat-session-relay.test.ts` | No change (tests client hook, not server) |

### Integration Tests

- Verify the full request flow: client → route → registry → ClaudeCodeRuntime → response
- Verify Relay path: publish → ClaudeCodeAdapter → runtime → response

### Compile-Time Verification

- `ClaudeCodeRuntime implements AgentRuntime` — TypeScript enforces interface compliance
- Any missing method causes a build error

## Performance Considerations

- One extra Map lookup per request (`runtimeRegistry.get()`) — negligible
- No additional network calls, serialization, or async overhead
- Internal delegation (runtime → transcriptReader) adds one function call — negligible
- `getCapabilities()` returns a static object — cacheable with `staleTime: Infinity`

## Security Considerations

- No new attack surface — same endpoints, same validation, same auth
- Runtime isolation: each runtime manages its own sessions, preventing cross-runtime leakage
- The `AgentRuntime` interface doesn't expose internal SDK types, preventing accidental SDK usage

## Documentation Updates

| Document | Change |
|----------|--------|
| `CLAUDE.md` | Update service descriptions to reference `ClaudeCodeRuntime` and `RuntimeRegistry` |
| `contributing/architecture.md` | Add RuntimeRegistry section, update data flow diagrams |
| `contributing/api-reference.md` | Document `GET /api/capabilities` endpoint |

## Implementation Phases

### Phase 1: Interface & Registry

- Define `AgentRuntime` interface in `packages/shared/src/agent-runtime.ts`
- Define `RuntimeCapabilities` type
- Create `RuntimeRegistry` in `apps/server/src/services/core/runtime-registry.ts`
- Create `apps/server/src/services/runtimes/claude-code/` directory structure
- Write `RuntimeRegistry` unit tests

### Phase 2: ClaudeCodeRuntime Extraction

- Copy `agent-manager.ts` → `claude-code-runtime.ts`, add `implements AgentRuntime`
- Move `transcript-reader.ts`, `transcript-parser.ts`, `session-broadcaster.ts` into `runtimes/claude-code/`
- Move `sdk-event-mapper.ts`, `interactive-handlers.ts`, `context-builder.ts`, `tool-filter.ts` into `runtimes/claude-code/`
- Move `session-lock.ts`, `build-task-event.ts`, `task-reader.ts` into `runtimes/claude-code/`
- Move `mcp-tools/` into `runtimes/claude-code/`
- Move `agent-types.ts` into `runtimes/claude-code/`
- Add `listSessions()`, `getMessageHistory()`, `watchSession()` etc. to runtime (delegating to TranscriptReader/Broadcaster)
- Add `getCapabilities()` returning static Claude Code capabilities
- Update all internal imports within the moved files
- Verify build passes

### Phase 3: Route Migration

- Update `sessions.ts` to use `runtimeRegistry.getDefault()` instead of `agentManager`
- Update `models.ts` to use `runtimeRegistry.getDefault()`
- Update `config.ts` to remove `resolveClaudeCliPath()` direct import
- Add `GET /api/capabilities` route
- Update server startup (`index.ts`) to create `ClaudeCodeRuntime` and register it
- Update `ClaudeCodeAdapter` constructor to accept `AgentRuntime` instead of `AgentManagerLike`
- Update all route tests

### Phase 4: Backward-Compatibility Shim Removal

- Delete the old `apps/server/src/services/core/agent-manager.ts` (replaced by re-export shim in Phase 2)
- Delete `apps/server/src/services/session/` directory (files moved to `runtimes/claude-code/`)
- Remove any re-export shims once all consumers are updated
- Verify no remaining imports of old paths (grep for `services/core/agent-manager`, `services/session/`)

### Phase 5: Client Capability Detection

- Add `getCapabilities()` to `Transport` interface
- Implement in `HttpTransport` (REST call to `/api/capabilities`)
- Implement in `DirectTransport` (returns ClaudeCode capabilities directly)
- Create `useRuntimeCapabilities()` hook
- Update `SessionItem.tsx` to gate permission mode display
- Update `use-session-status.ts` to use server-driven models
- Remove hardcoded `MODEL_CONTEXT_WINDOWS` from `constants.ts`
- Update `DirectTransportServices` interface (`agentManager` → `runtime`)
- Update Obsidian plugin `CopilotView` to pass `ClaudeCodeRuntime` as `runtime`

### Phase 6: Cleanup & Verification

- Run full test suite, fix any failures
- Run typecheck across all packages
- Run lint across all packages
- Grep for any remaining `@anthropic-ai/claude-agent-sdk` imports outside `runtimes/claude-code/`
- Grep for any remaining `agentManager` imports outside `runtimes/claude-code/`
- Update `CLAUDE.md` and `contributing/architecture.md`

## Open Questions

1. ~~**Command Registry scope**~~ (RESOLVED)
   **Answer:** Move into `ClaudeCodeRuntime` and add `getCommands()` to `AgentRuntime` interface. The `.claude/commands/` convention is Claude-specific. Each runtime discovers commands using its own mechanism. Future DorkOS-level commands (runtime-agnostic) can be layered on top in the route by merging DorkOS commands + runtime commands.

2. **`getProjectSlug()` in TranscriptReader**: This derives the Claude project directory slug from the CWD path. It's Claude-specific logic. Should it be on the runtime interface?
   - Recommendation: No. It's an internal implementation detail of `ClaudeCodeRuntime`. The runtime interface uses `projectDir` as an opaque string — each runtime interprets it however it needs.

3. ~~**Session ID format**~~ (RESOLVED)
   **Answer:** Rename to `getInternalSessionId()` — communicates that it returns the runtime's internal ID without implying SDK.

## Related ADRs

- **ADR-0001**: Use Hexagonal Architecture — this spec extends the hexagonal pattern to the agent execution layer
- **ADR-0008**: SDK JSONL as Single Source of Truth — remains true, but now encapsulated inside `ClaudeCodeRuntime`
- **ADR-0029**: Replace Message Receiver with Claude Code Adapter — the adapter pattern this spec builds upon
- **ADR-0042**: DorkOS-Native Agent Manifest Format — `agent.runtime` field enables per-agent runtime selection

## References

- [Ideation / Audit Document](./01-ideation.md)
- [Hexagonal Architecture Guide](../../contributing/architecture.md)
- [Claude Agent SDK Documentation](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/sdk)
