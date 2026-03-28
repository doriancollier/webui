---
slug: canvas-persistence-and-toggle
number: 189
created: 2026-03-28
status: draft
---

# Canvas Persistence & Toggle — Specification

## Overview

Two related canvas improvements shipped as one unit:

1. **Per-session canvas persistence** — canvas state (open/closed + content) survives page refreshes, scoped by session ID
2. **Canvas toggle button** — always-visible button in the session header to open/close the canvas, mirroring the sidebar toggle

The toggle is a prerequisite for persistence — persisted state is useless if the user can't reopen the canvas.

## Technical Design

### 1. Per-Session Canvas Persistence

#### Storage Model

A single localStorage key (`dorkos-canvas-sessions`) stores a JSON map:

```typescript
interface CanvasSessionEntry {
  open: boolean;
  content: UiCanvasContent | null;
  accessedAt: number; // Date.now() for LRU eviction
}

type CanvasSessionMap = Record<string, CanvasSessionEntry>;
```

**Key:** Session UUID from URL search params (`?session=<id>`).

**LRU cap:** 50 entries. When exceeded, evict the entry with the oldest `accessedAt`.

**Panel width** is persisted per-session by making `react-resizable-panels`' `autoSaveId` session-scoped. In `SessionPage`, change from a static `autoSaveId="agent-canvas"` to a dynamic `autoSaveId={activeSessionId ? \`agent-canvas-${activeSessionId}\` : 'agent-canvas'}`. The library handles the rest — each session gets its own localStorage entry for panel sizes. A default width (50%) is used for new sessions with no stored layout.

Note: This creates one additional localStorage key per session (`react-resizable-panels:agent-canvas-{uuid}`). These are small (~50 bytes each) and managed independently from the `CanvasSessionMap`. The LRU eviction on `CanvasSessionMap` does not clean up these keys, but their small size makes this acceptable. A future cleanup pass could evict stale panel-size keys.

#### Storage Helpers

Add to `apps/client/src/layers/shared/lib/constants.ts`:

```typescript
export const STORAGE_KEYS = {
  // ... existing keys
  CANVAS_SESSIONS: 'dorkos-canvas-sessions',
} as const;

export const MAX_CANVAS_SESSIONS = 50;
```

Add two helpers to `apps/client/src/layers/shared/model/app-store-helpers.ts`:

```typescript
export function readCanvasSession(sessionId: string): CanvasSessionEntry | null;
export function writeCanvasSession(sessionId: string, entry: CanvasSessionEntry): void;
```

`readCanvasSession`: Reads the map from localStorage, returns the entry for the given session ID, or `null` if not found.

`writeCanvasSession`: Reads the map, sets/updates the entry with current `accessedAt`, enforces the LRU cap (evicts oldest entries beyond 50), writes back.

Both wrapped in try/catch for localStorage errors (private browsing, quota exceeded).

#### Zustand Store Changes

Modify `apps/client/src/layers/shared/model/app-store.ts`:

1. Remove the comment "Canvas state (transient — not persisted)"
2. Add a new method: `loadCanvasForSession(sessionId: string): void`
   - Reads `readCanvasSession(sessionId)` from localStorage
   - If found: sets `canvasOpen` and `canvasContent` from the stored entry
   - If not found: sets `canvasOpen: false`, `canvasContent: null`
3. Modify `setCanvasOpen` and `setCanvasContent` to write-through to localStorage
   - These need the current session ID to write — accept it as a parameter OR read from a store field
   - **Approach:** Add a `canvasSessionId: string | null` field to the store. Set it when `loadCanvasForSession` is called. The setters use this field to write back.

#### Session-Aware Hydration

The canvas state needs to reload when the session ID changes. This happens in `SessionPage` or a new hook:

Create `apps/client/src/layers/features/canvas/model/use-canvas-persistence.ts`:

```typescript
export function useCanvasPersistence(sessionId: string | undefined): void {
  const loadCanvasForSession = useAppStore((s) => s.loadCanvasForSession);

  useEffect(() => {
    if (sessionId) {
      loadCanvasForSession(sessionId);
    }
  }, [sessionId, loadCanvasForSession]);
}
```

Call this hook from `SessionPage`:

```typescript
export function SessionPage() {
  const [activeSessionId] = useSessionId();
  useCanvasPersistence(activeSessionId);

  // Session-scoped panel size persistence — each session gets its own layout key
  const autoSaveId = activeSessionId ? `agent-canvas-${activeSessionId}` : 'agent-canvas';

  return (
    <PanelGroup direction="horizontal" autoSaveId={autoSaveId}>
      <Panel id="chat" order={1} minSize={30} defaultSize={100}>
        <ChatPanel sessionId={activeSessionId} />
      </Panel>
      <AgentCanvas />
    </PanelGroup>
  );
}
```

When `activeSessionId` changes (tab switch, URL navigation), the effect fires and loads the correct canvas state from localStorage. The `autoSaveId` also changes, causing `react-resizable-panels` to load the session-specific panel layout.

### 2. Canvas Toggle Button

#### Component: `CanvasToggle`

Create `apps/client/src/layers/features/canvas/ui/CanvasToggle.tsx`:

```typescript
export function CanvasToggle();
```

**Rendering:**

- `PanelRight` icon (from lucide-react) when canvas is closed
- `PanelRightClose` icon when canvas is open
- Ghost variant button, same sizing as `CommandPaletteTrigger` (icon button, `size-7`)
- When canvas is closed AND `canvasContent` is non-null: render a small dot indicator (absolute-positioned `size-1.5 rounded-full bg-primary`)

**Behavior:**

- Clicking toggles `canvasOpen` via `setCanvasOpen(!canvasOpen)`
- Tooltip: "Toggle canvas" with keyboard shortcut hint

**Accessibility:**

- `aria-label="Toggle canvas"` (or "Open canvas" / "Close canvas" based on state)

#### Placement in SessionHeader

Modify `apps/client/src/layers/features/top-nav/ui/SessionHeader.tsx`:

```typescript
export function SessionHeader({ agent, visual, isStreaming }: SessionHeaderProps) {
  return (
    <>
      <AgentIdentityChip agent={agent} visual={visual} isStreaming={isStreaming} />
      <div className="flex-1" />
      <CanvasToggle />
      <CommandPaletteTrigger />
    </>
  );
}
```

The toggle sits between the spacer and the command palette trigger — right side of the header, consistent with panel toggle patterns.

#### Keyboard Shortcut

Add to `apps/client/src/layers/shared/lib/shortcuts.ts`:

```typescript
TOGGLE_CANVAS: {
  id: 'toggle-canvas',
  key: 'mod+.',
  label: 'Toggle canvas',
  group: 'navigation',
},
```

`Cmd+.` / `Ctrl+.` — symmetric with `Cmd+B` for sidebar (both are single-key modifiers in the navigation group). `mod+]` would conflict with browser tab navigation on some platforms; `mod+.` is clean and available.

Wire the shortcut in `AppShell.tsx` (or wherever `TOGGLE_SIDEBAR` is wired — currently `App.tsx`), following the same `useEffect` + `addEventListener('keydown')` pattern.

#### Command Palette Registration

The command palette already has a "Toggle Canvas" action (via `setCanvasOpen(true)` in `use-palette-actions.ts:135`). Update it to be a true toggle:

```typescript
// Change from:
setCanvasOpen(true);
// To:
setCanvasOpen(!useAppStore.getState().canvasOpen);
```

Update the action label from "Open Canvas" to "Toggle Canvas" to match the toggle semantics.

### 3. Barrel Export Update

Update `apps/client/src/layers/features/canvas/index.ts`:

```typescript
export { AgentCanvas } from './ui/AgentCanvas';
export { CanvasToggle } from './ui/CanvasToggle';
```

## FSD Layer Compliance

| Component              | Layer            | Imports From                                          | Status                                                |
| ---------------------- | ---------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `CanvasToggle`         | features/canvas  | shared (Button, useAppStore, icons)                   | Compliant                                             |
| `SessionHeader`        | features/top-nav | features/canvas (CanvasToggle)                        | Compliant (UI composition across features is allowed) |
| `useCanvasPersistence` | features/canvas  | shared (useAppStore), entities/session (useSessionId) | Compliant                                             |
| `app-store.ts`         | shared           | shared (constants, helpers)                           | Compliant                                             |

## Implementation Phases

### Phase 1: Storage Infrastructure

- Add `STORAGE_KEYS.CANVAS_SESSIONS` and `MAX_CANVAS_SESSIONS` to constants
- Add `readCanvasSession`/`writeCanvasSession` helpers
- Add `CanvasSessionEntry` type to app-store-helpers
- Update Zustand store: add `canvasSessionId`, `loadCanvasForSession`, modify setters for write-through

### Phase 2: Canvas Toggle

- Create `CanvasToggle` component with icon variants and dot indicator
- Add to `SessionHeader`
- Add `TOGGLE_CANVAS` keyboard shortcut
- Wire shortcut handler in `App.tsx`
- Update command palette action to true toggle

### Phase 3: Session-Aware Hydration

- Create `useCanvasPersistence` hook
- Call from `SessionPage`
- Verify: refresh preserves state, session switch loads correct state, new sessions start clean

### Phase 4: Tests

- Unit tests for `readCanvasSession`/`writeCanvasSession` (LRU eviction, serialization, error handling)
- Component test for `CanvasToggle` (renders, toggles, dot indicator, icon variants)
- Integration test for `useCanvasPersistence` (hydration on mount, reload on session change)
- Update `SessionHeader.test.tsx` (verify toggle button renders)
- Update command palette test if needed

## Acceptance Criteria

1. **Refresh persistence**: Open canvas with markdown content → refresh page → canvas reopens with same content
2. **Per-session isolation**: Open canvas in session A → switch to session B (new tab or URL change) → canvas state reflects session B (or defaults to closed)
3. **Toggle button visible**: Session header shows `PanelRight` icon button between spacer and command palette trigger
4. **Toggle works**: Clicking the button opens/closes the canvas on both desktop and mobile
5. **Dot indicator**: When canvas is closed but has content for the current session, a dot appears on the toggle button
6. **Keyboard shortcut**: `Cmd+.` / `Ctrl+.` toggles the canvas
7. **Command palette**: "Toggle Canvas" action in command palette works
8. **LRU eviction**: After 50 sessions, oldest entries are evicted (unit test)
9. **New sessions default clean**: Sessions with no stored state start with canvas closed, no content
10. **Panel width per-session**: Resize canvas to 30% in session A → switch to session B (default 50%) → switch back to session A → canvas is 30%
11. **No regressions**: All existing canvas tests pass, agent-driven `open_canvas` / `close_canvas` UI commands still work

## Out of Scope

- Server-side canvas state persistence (cross-device sync)
- Canvas auto-update when underlying content changes
- Canvas extensions system
- Splash screen redesign
- Swipe-from-edge gesture on mobile (progressive enhancement for later)
