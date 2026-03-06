# Unify Discovery System

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-03-06
**Spec:** #94

---

## Overview

Unify the two separate agent discovery systems (onboarding SSE scan and mesh panel batch scan) into a single canonical implementation. Fix the critical bug where onboarding scans the wrong directory (project root instead of home directory), causing users to see "No agents found" on first run.

## Background / Problem Statement

Two independent discovery scanners exist with overlapping functionality:

**Scanner A** (`apps/server/src/services/discovery/discovery-scanner.ts`):
- Standalone BFS async generator (`scanForAgents`)
- Own `DiscoveryCandidate` type (different from `@dorkos/shared/mesh-schemas`)
- 14 exclude patterns including `Library`, `AppData`, `.Trash`, `.npm`, `.nvm`, `.local`, `.cargo`, `.rustup`, `go/pkg`
- No strategy pattern, no registered/denied filtering
- Detects markers directly: `CLAUDE.md`, `.claude`, `.cursor`, `.github/copilot`, `.dork/agent.json`
- Yields `ScanEvent` with `candidate`, `progress`, `complete` types
- Has timeout support (30s default)

**Scanner B** (`packages/mesh/src/discovery-engine.ts`):
- BFS async generator (`scanDirectory`) with pluggable `DiscoveryStrategy` instances
- Uses canonical `DiscoveryCandidate` from `@dorkos/shared/mesh-schemas`
- 11 exclude patterns including `__pycache__`, `.venv`, `venv`, `.tox`, `extensions`
- Filters registered and denied paths via `RegistryLike` / `DenialListLike` interfaces
- Supports symlink following with cycle detection via `realpathSync()`
- Auto-imports existing `.dork/agent.json` manifests
- No timeout, no progress events

**The bug:** The onboarding flow (`AgentDiscoveryStep.tsx`) calls `startScan()` with no arguments. `use-discovery-scan.ts` sends an empty body to `POST /api/discovery/scan`. The route falls back to `DEFAULT_CWD` (the DorkOS project root, not the user's home directory). The scan completes in <1 second with zero results.

**Additional issues:**
- `use-discovery-scan.ts` uses raw `fetch()`, bypassing the Transport abstraction
- Three copies of the `DiscoveryCandidate` shape exist (Scanner A's type, shared schema, onboarding hook's `ScanCandidate`)
- Scan results are not shared between onboarding and mesh panel — each maintains separate state
- The Transport interface has `discoverMeshAgents()` (batch JSON) but no streaming scan method

## Goals

- Fix the onboarding scan to use the correct default root (boundary/home directory)
- Consolidate to a single scanner implementation combining the best of both
- Add `scan()` to the Transport interface for both HttpTransport and DirectTransport
- Share scan results across features via a Zustand store in `entities/discovery/`
- Eliminate duplicate type definitions — use canonical `DiscoveryCandidate` from `@dorkos/shared/mesh-schemas`
- Maintain SSE streaming for progressive results in all consumers
- Keep `POST /api/mesh/discover` as a backward-compatible thin wrapper

## Non-Goals

- Smart probing of common developer directories (~/Developer, ~/Projects, etc.) — follow-up feature
- `requestAnimationFrame` batching for high-frequency scan results — future optimization
- Incremental re-scanning based on filesystem stat mtimes
- Windows-specific developer directory paths
- Per-root scan status in settings UI
- Caching scan results with staleness tracking

## Technical Dependencies

- `@dorkos/shared` — canonical `DiscoveryCandidate` type, Transport interface, Zod schemas
- `@dorkos/mesh` — discovery strategies, agent registry, denial list
- `zustand` — shared discovery store (already a project dependency)
- `@dorkos/db` — SQLite for mesh agent registry (existing)

No new external dependencies required.

## Detailed Design

### 1. Unified Scanner (`packages/mesh/src/discovery/unified-scanner.ts`)

The unified scanner combines Scanner B's strategy pattern and registry/denial filtering with Scanner A's comprehensive exclude list, timeout support, and progress events.

**New types (added to `packages/mesh/src/discovery/types.ts`):**

```typescript
/** Events yielded by the unified scanner. */
export type ScanEvent =
  | { type: 'candidate'; data: DiscoveryCandidate }
  | { type: 'auto-import'; data: { manifest: AgentManifest; path: string } }
  | { type: 'progress'; data: ScanProgress }
  | { type: 'complete'; data: ScanProgress & { timedOut: boolean } };

export interface ScanProgress {
  scannedDirs: number;
  foundAgents: number;
}

export interface UnifiedScanOptions {
  /** Root directory to scan. */
  root: string;
  /** Maximum BFS depth (default: 5). */
  maxDepth?: number;
  /** Scan timeout in ms (default: 30000). */
  timeout?: number;
  /** Follow symlinks with cycle detection (default: false). */
  followSymlinks?: boolean;
  /** Additional exclude patterns beyond the defaults. */
  extraExcludes?: string[];
  /** Logger for warnings. */
  logger?: import('@dorkos/shared/logger').Logger;
}
```

**Unified exclude set** (superset of both scanners):

```typescript
export const UNIFIED_EXCLUDE_PATTERNS = new Set([
  // From Scanner A
  'node_modules', '.git', 'vendor', 'Library', 'AppData',
  '.Trash', 'dist', 'build', '.cache', '.npm', '.nvm',
  '.local', '.cargo', '.rustup', 'go/pkg',
  // From Scanner B (additions)
  '__pycache__', '.venv', 'venv', '.tox', '.DS_Store', 'extensions',
]);
```

**Scanner function signature:**

```typescript
export async function* unifiedScan(
  options: UnifiedScanOptions,
  strategies: DiscoveryStrategy[],
  registry: RegistryLike,
  denialList: DenialListLike,
): AsyncGenerator<ScanEvent>
```

The scanner combines:
- Scanner B's strategy-based detection (`strategy.detect()` + `strategy.extractHints()`)
- Scanner B's registered/denied path filtering
- Scanner B's symlink cycle detection via `realpathSync()`
- Scanner B's auto-import of `.dork/agent.json` manifests
- Scanner A's timeout support
- Scanner A's periodic progress events (every 100 directories)
- Scanner A's `complete` event with `timedOut` flag
- The unified exclude set

### 2. MeshCore Integration

`MeshCore.discover()` will delegate to `unifiedScan()` instead of `scanDirectory()`:

```typescript
async *discover(
  roots: string[],
  options?: Partial<UnifiedScanOptions>,
): AsyncGenerator<ScanEvent> {
  for (const root of roots) {
    yield* unifiedScan(
      { root, ...options },
      this.strategies,
      this.registry,
      this.denialList,
    );
  }
}
```

The return type changes from `AsyncGenerator<DiscoveryCandidate>` to `AsyncGenerator<ScanEvent>`. This is a breaking change within the package but all callers are internal. The mesh route and MCP tool filter for `candidate` type events.

### 3. Transport Interface Extension

Add a `scan()` method to the `Transport` interface in `packages/shared/src/transport.ts`:

```typescript
// Add to mesh-schemas imports:
import type { ScanProgress } from './mesh-schemas.js';

// Add ScanEvent and ScanOptions to mesh-schemas.ts:
export const ScanProgressSchema = z.object({
  scannedDirs: z.number(),
  foundAgents: z.number(),
});
export type ScanProgress = z.infer<typeof ScanProgressSchema>;

export type TransportScanEvent =
  | { type: 'candidate'; data: DiscoveryCandidate }
  | { type: 'progress'; data: ScanProgress }
  | { type: 'complete'; data: ScanProgress & { timedOut: boolean } }
  | { type: 'error'; data: { error: string } };

export interface TransportScanOptions {
  roots: string[];
  maxDepth?: number;
  timeout?: number;
}

// Add to Transport interface:
export interface Transport {
  // ... existing methods ...

  /** Stream discovery scan results progressively. */
  scan(
    options: TransportScanOptions,
    onEvent: (event: TransportScanEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}
```

Note: The transport-level `TransportScanEvent` omits `auto-import` (that's an internal mesh concern handled server-side). It adds `error` for transport-level error reporting.

**HttpTransport implementation** (`apps/client/src/layers/shared/lib/http-transport.ts`):

```typescript
async scan(
  options: TransportScanOptions,
  onEvent: (event: TransportScanEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${this.baseUrl}/api/discovery/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }

  // Parse SSE stream
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventType = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ') && eventType) {
        const data = JSON.parse(line.slice(6));
        onEvent({ type: eventType, data } as TransportScanEvent);
        eventType = '';
      }
    }
  }
}
```

**DirectTransport implementation** (`apps/client/src/layers/shared/lib/direct-transport.ts`):

```typescript
async scan(
  options: TransportScanOptions,
  onEvent: (event: TransportScanEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Import scanner directly for in-process execution
  for (const root of options.roots) {
    for await (const event of unifiedScan(
      { root, maxDepth: options.maxDepth, timeout: options.timeout },
      this.strategies,
      this.registry,
      this.denialList,
    )) {
      if (signal?.aborted) return;
      if (event.type !== 'auto-import') {
        onEvent(event as TransportScanEvent);
      }
    }
  }
}
```

### 4. Discovery Route Update (`apps/server/src/routes/discovery.ts`)

Update to use the unified scanner and fix the default root:

```typescript
import { getBoundary } from '../lib/boundary.js';

router.post('/scan', async (req, res) => {
  const data = parseBody(ScanRequestSchema, req.body, res);
  if (!data) return;

  // Default to boundary (home dir) instead of DEFAULT_CWD
  const roots = data.roots ?? (data.root ? [data.root] : [getBoundary()]);

  // ... boundary validation for each root ...

  // Use meshCore's unified scanner
  for await (const event of meshCore.discover(roots, {
    maxDepth: data.maxDepth,
    timeout: data.timeout,
  })) {
    if (res.writableEnded) break;
    // Filter auto-import events (internal to mesh)
    if (event.type === 'auto-import') continue;
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  }
});
```

The `ScanRequestSchema` is updated to accept `roots: string[]` (array) in addition to the existing `root: string` (single). Both default to the boundary when not provided.

The discovery route now requires a `MeshCore` dependency — `createDiscoveryRouter(meshCore)` instead of `createDiscoveryRouter()`.

### 5. Mesh Batch Endpoint (Thin Wrapper)

`POST /api/mesh/discover` stays as-is but now delegates to the same unified scanner via `meshCore.discover()`. The existing implementation already does this — the only change is that `meshCore.discover()` now returns `ScanEvent` instead of `DiscoveryCandidate`, so the route filters for `candidate` type:

```typescript
for await (const event of meshCore.discover(validatedRoots, options)) {
  if (event.type === 'candidate') {
    candidates.push(event.data);
  }
  if (candidates.length >= MAX_CANDIDATES) break;
}
```

### 6. Shared Discovery Store (`entities/discovery/`)

New FSD entity module at `apps/client/src/layers/entities/discovery/`:

```
entities/discovery/
├── model/
│   ├── discovery-store.ts   # Zustand store
│   └── use-discovery-scan.ts # Shared hook
├── index.ts                 # Barrel exports
```

**discovery-store.ts:**

```typescript
import { create } from 'zustand';
import type { DiscoveryCandidate, ScanProgress, TransportScanEvent } from '@dorkos/shared/mesh-schemas';

interface DiscoveryState {
  candidates: DiscoveryCandidate[];
  progress: ScanProgress | null;
  isScanning: boolean;
  error: string | null;
  lastScanAt: number | null;
}

interface DiscoveryActions {
  addCandidate: (candidate: DiscoveryCandidate) => void;
  setProgress: (progress: ScanProgress) => void;
  startScan: () => void;
  completeScan: (progress: ScanProgress) => void;
  setError: (error: string) => void;
  clear: () => void;
}

export const useDiscoveryStore = create<DiscoveryState & DiscoveryActions>((set) => ({
  candidates: [],
  progress: null,
  isScanning: false,
  error: null,
  lastScanAt: null,

  addCandidate: (candidate) =>
    set((state) => ({ candidates: [...state.candidates, candidate] })),
  setProgress: (progress) => set({ progress }),
  startScan: () => set({ candidates: [], progress: null, error: null, isScanning: true }),
  completeScan: (progress) =>
    set({ progress, isScanning: false, lastScanAt: Date.now() }),
  setError: (error) => set({ error, isScanning: false }),
  clear: () => set({ candidates: [], progress: null, error: null, lastScanAt: null }),
}));
```

**use-discovery-scan.ts:**

```typescript
import { useCallback, useRef } from 'react';
import { useTransport } from '@/layers/shared/model';
import { useMeshScanRoots } from '@/layers/entities/mesh';
import { useDiscoveryStore } from './discovery-store';

export function useDiscoveryScan() {
  const transport = useTransport();
  const { roots } = useMeshScanRoots();
  const store = useDiscoveryStore();
  const abortRef = useRef<AbortController | null>(null);

  const scan = useCallback(
    (overrideRoots?: string[], maxDepth?: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      store.startScan();

      const scanRoots = overrideRoots ?? roots;
      if (scanRoots.length === 0) {
        // No roots configured — server will use boundary default
      }

      void transport
        .scan(
          { roots: scanRoots, maxDepth },
          (event) => {
            switch (event.type) {
              case 'candidate':
                store.addCandidate(event.data);
                break;
              case 'progress':
                store.setProgress(event.data);
                break;
              case 'complete':
                store.completeScan(event.data);
                break;
              case 'error':
                store.setError(event.data.error);
                break;
            }
          },
          controller.signal,
        )
        .catch((err) => {
          if (err.name !== 'AbortError') {
            store.setError(err.message);
          }
        });
    },
    [transport, roots, store],
  );

  return {
    candidates: store.candidates,
    isScanning: store.isScanning,
    progress: store.progress,
    error: store.error,
    lastScanAt: store.lastScanAt,
    scan,
  };
}
```

### 7. UI Updates

**AgentDiscoveryStep.tsx** — Replace `useDiscoveryScan` import:

```diff
- import { useDiscoveryScan, type ScanCandidate } from '../model/use-discovery-scan';
+ import { useDiscoveryScan } from '@/layers/entities/discovery';
+ import type { DiscoveryCandidate } from '@dorkos/shared/mesh-schemas';
```

The component's `startScan()` call changes to `scan()` (no arguments — server defaults to boundary). The `ScanCandidate` type is replaced with canonical `DiscoveryCandidate`. The candidate shape differs slightly — Scanner A's candidate has `name`, `markers`, `gitBranch`, `gitRemote`, `hasDorkManifest` while the canonical `DiscoveryCandidate` has `strategy`, `hints`, `discoveredAt`. The `AgentCard` component in onboarding needs updating to use the canonical shape.

**DiscoveryView.tsx** — Replace `useDiscoverAgents`:

```diff
- import { useDiscoverAgents, useMeshScanRoots, ... } from '@/layers/entities/mesh';
+ import { useDiscoveryScan } from '@/layers/entities/discovery';
+ import { useMeshScanRoots, ... } from '@/layers/entities/mesh';
```

The `discover()` mutation is replaced with `scan()` from the shared hook. Results come from the Zustand store (progressive) instead of a mutation response (batch). The UI already handles progressive display in the onboarding flow — the mesh panel gains the same capability.

### 8. File Changes Summary

**Files to CREATE:**
| File | Purpose |
|------|---------|
| `packages/mesh/src/discovery/unified-scanner.ts` | Unified BFS scanner |
| `packages/mesh/src/discovery/types.ts` | ScanEvent, ScanProgress, UnifiedScanOptions |
| `packages/mesh/src/discovery/index.ts` | Barrel exports |
| `apps/client/src/layers/entities/discovery/model/discovery-store.ts` | Zustand store |
| `apps/client/src/layers/entities/discovery/model/use-discovery-scan.ts` | Shared hook |
| `apps/client/src/layers/entities/discovery/index.ts` | Barrel exports |

**Files to DELETE:**
| File | Reason |
|------|--------|
| `apps/server/src/services/discovery/discovery-scanner.ts` | Replaced by unified scanner |
| `apps/client/src/layers/features/onboarding/model/use-discovery-scan.ts` | Replaced by shared hook |

**Files to MODIFY:**
| File | Change |
|------|--------|
| `packages/mesh/src/discovery-engine.ts` | Delete (logic moved to unified-scanner.ts) |
| `packages/mesh/src/mesh-core.ts` | `discover()` delegates to `unifiedScan()`, returns `ScanEvent` |
| `packages/mesh/src/index.ts` | Re-export from `discovery/` |
| `packages/shared/src/transport.ts` | Add `scan()` method to Transport interface |
| `packages/shared/src/mesh-schemas.ts` | Add `ScanProgress`, `TransportScanEvent`, `TransportScanOptions` |
| `apps/client/src/layers/shared/lib/http-transport.ts` | Implement `scan()` via SSE |
| `apps/client/src/layers/shared/lib/direct-transport.ts` | Implement `scan()` via direct import |
| `apps/server/src/routes/discovery.ts` | Use unified scanner via meshCore, fix default root |
| `apps/server/src/routes/mesh.ts` | Filter `ScanEvent` for `candidate` type in batch endpoint |
| `apps/client/src/layers/features/onboarding/ui/AgentDiscoveryStep.tsx` | Use shared hook |
| `apps/client/src/layers/features/onboarding/ui/AgentCard.tsx` | Use canonical `DiscoveryCandidate` type |
| `apps/client/src/layers/features/mesh/ui/DiscoveryView.tsx` | Use shared hook |
| `apps/client/src/layers/entities/mesh/model/use-mesh-discover.ts` | Delete (replaced by shared hook) |
| `apps/client/src/layers/entities/mesh/index.ts` | Remove `useDiscoverAgents` export |
| `apps/server/src/services/core/mcp-tools/mesh-tools.ts` | Filter `ScanEvent` for `candidate` type |
| `@dorkos/test-utils` | Add `createMockTransport` scan method |

## User Experience

### Onboarding (first-time user)
1. User starts DorkOS for the first time
2. Clicks "Get Started" in the onboarding flow
3. Scan auto-starts, searching from the home directory
4. Agent cards appear progressively as they're discovered (staggered animation)
5. Progress indicator shows "Scanned N directories, found M agents"
6. User selects agents to register and continues

### Mesh Panel (returning user)
1. If the user already scanned during onboarding, results are immediately visible (Zustand store persists across navigation)
2. User can trigger a new scan with configurable roots and depth
3. Results now stream progressively (vs. previous batch mode)
4. Advanced settings allow customizing scan roots

### Shared State
- Onboarding scan → results available in mesh panel without re-scan
- Mesh panel scan → results available if user navigates back to onboarding
- "Re-scan" in either UI clears and re-scans

## Testing Strategy

### Unit Tests

**`packages/mesh/src/discovery/__tests__/unified-scanner.test.ts`:**
- Yields `candidate` events for directories matching strategies
- Yields `auto-import` events for directories with `.dork/agent.json`
- Skips denied paths entirely (no traversal)
- Skips registered paths as candidates (still traverses children)
- Respects `maxDepth` limit
- Emits `progress` events every 100 directories
- Emits `complete` event with `timedOut: true` when timeout exceeded
- Uses unified exclude set (all patterns from both scanners)
- Detects symlink cycles via realpath comparison
- Handles EACCES/EPERM errors gracefully (skip and continue)

**`apps/client/src/layers/entities/discovery/__tests__/use-discovery-scan.test.ts`:**
- Calls `transport.scan()` with provided roots
- Falls back to configured scan roots from `useMeshScanRoots`
- Updates Zustand store with candidate, progress, complete events
- Handles abort/cancel via AbortController
- Sets error state on transport failure

**`apps/client/src/layers/entities/discovery/__tests__/discovery-store.test.ts`:**
- `startScan()` clears previous results and sets `isScanning`
- `addCandidate()` appends to candidates array
- `completeScan()` sets `lastScanAt` and clears `isScanning`
- `clear()` resets all state

### Integration Tests

**`apps/server/src/routes/__tests__/discovery.test.ts`** (update existing):
- SSE stream uses unified scanner via meshCore
- Default root is boundary (home dir) when no root provided
- `roots` array parameter works
- Boundary validation rejects paths outside boundary

### Tests to Delete
- `apps/server/src/services/discovery/__tests__/discovery-scanner.test.ts` — Scanner A is deleted

### Mocking Strategy
- Server tests: mock `meshCore.discover()` as an async generator
- Client tests: mock `transport.scan()` to call `onEvent` with test events
- Discovery store tests: test Zustand store actions directly
- Test utils: `createMockTransport()` gets a `scan` method that accepts an array of events to emit

## Performance Considerations

- **Home directory scanning**: Scanning from `$HOME` can touch 5,000-50,000 directories. The 30-second timeout (from Scanner A) prevents indefinite scans. Progress events every 100 directories provide feedback.
- **Zustand store updates**: Each `addCandidate` call triggers a re-render. For fast scans yielding many results, this is acceptable — `requestAnimationFrame` batching is deferred as a future optimization.
- **Symlink cycle detection**: `realpathSync()` adds per-directory overhead but prevents infinite loops. This is inherited from Scanner B.
- **Memory**: The visited set grows with scanned directories but is bounded by timeout and maxDepth.

## Security Considerations

- All scan roots are validated against the directory boundary (`isWithinBoundary`)
- The boundary defaults to `os.homedir()`, preventing scans outside the user's home
- EACCES/EPERM errors are silently skipped (no information leakage about restricted directories)
- The scanner does not read file contents — only checks for marker existence via `fs.access()`

## Documentation

- Update `contributing/architecture.md` — document unified discovery system and Transport `scan()` method
- Update `CLAUDE.md` — update the discovery-scanner and discovery-engine entries, add `entities/discovery/` to FSD layers table

## Implementation Phases

### Phase 1: Unified Scanner + Bug Fix
1. Create `packages/mesh/src/discovery/unified-scanner.ts` with unified exclude set, timeout, progress events
2. Create `packages/mesh/src/discovery/types.ts` and barrel
3. Update `MeshCore.discover()` to use `unifiedScan()`
4. Update `routes/discovery.ts` to use meshCore and default to boundary
5. Update `routes/mesh.ts` discover endpoint to filter `ScanEvent`
6. Delete Scanner A (`discovery-scanner.ts`)
7. Delete Scanner B (`discovery-engine.ts`)
8. Update MCP `mesh_discover` tool
9. Update server tests

### Phase 2: Transport + Client Unification
1. Add `TransportScanEvent`, `TransportScanOptions`, `ScanProgress` to shared schemas
2. Add `scan()` to Transport interface
3. Implement `scan()` in HttpTransport (SSE parsing)
4. Implement `scan()` in DirectTransport (direct scanner import)
5. Create `entities/discovery/` with Zustand store and shared hook
6. Update `AgentDiscoveryStep.tsx` to use shared hook and canonical types
7. Update `DiscoveryView.tsx` to use shared hook (progressive instead of batch)
8. Delete old `use-discovery-scan.ts` and `use-mesh-discover.ts`
9. Update `createMockTransport()` with `scan` method
10. Update client tests

### Phase 3: Cleanup
1. Remove unused imports and type definitions
2. Verify all tests pass
3. Update documentation

## Open Questions

*None — all decisions have been resolved during ideation.*

## Related ADRs

- **ADR-0023**: Use Custom Async BFS for Agent Discovery — establishes the BFS async generator pattern
- **ADR-0055 (draft)**: Use SSE Streaming for Filesystem Discovery Results — establishes SSE streaming for discovery

## References

- Ideation: `specs/unify-discovery-system/01-ideation.md`
- Research: `research/20260306_filesystem_discovery_unification.md`
- Scanner A: `apps/server/src/services/discovery/discovery-scanner.ts`
- Scanner B: `packages/mesh/src/discovery-engine.ts`
- Transport interface: `packages/shared/src/transport.ts`
