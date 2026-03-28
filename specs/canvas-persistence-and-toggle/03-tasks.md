# Canvas Persistence & Toggle — Task Breakdown

Generated: 2026-03-28 | Mode: full | Spec: [02-specification.md](./02-specification.md)

---

## Phase 1: Storage Infrastructure

### Task 1.1 — Add CANVAS_SESSIONS storage key and MAX_CANVAS_SESSIONS constant

**Size:** small | **Priority:** high | **Dependencies:** none | **Parallel with:** 1.2

Add `STORAGE_KEYS.CANVAS_SESSIONS` (`'dorkos-canvas-sessions'`) and `MAX_CANVAS_SESSIONS` (50) to `apps/client/src/layers/shared/lib/constants.ts`.

**Files:** `constants.ts`

---

### Task 1.2 — Add CanvasSessionEntry type and readCanvasSession/writeCanvasSession helpers

**Size:** medium | **Priority:** high | **Dependencies:** 1.1

Add the `CanvasSessionEntry` interface and two localStorage helpers to `apps/client/src/layers/shared/model/app-store-helpers.ts`:

- `readCanvasSession(sessionId)` — reads the JSON map from localStorage, returns entry or `null`
- `writeCanvasSession(sessionId, entry)` — writes entry with current `accessedAt`, enforces LRU cap at 50

Both wrapped in try/catch for localStorage errors. LRU eviction sorts by `accessedAt` descending and keeps the top 50.

**Files:** `app-store-helpers.ts`

---

### Task 1.3 — Update Zustand store for canvas persistence write-through

**Size:** medium | **Priority:** high | **Dependencies:** 1.2

Modify `apps/client/src/layers/shared/model/app-store.ts`:

1. Add `canvasSessionId: string | null` field (default `null`)
2. Add `loadCanvasForSession(sessionId)` method — reads localStorage, sets canvas state
3. Update `setCanvasOpen` to write-through when `canvasSessionId` is set
4. Update `setCanvasContent` to write-through when `canvasSessionId` is set
5. Remove "transient — not persisted" comment
6. Add canvas sessions key to `resetPreferences` cleanup

**Files:** `app-store.ts`

---

## Phase 2: Canvas Toggle

### Task 2.1 — Create CanvasToggle component with icon variants and dot indicator

**Size:** medium | **Priority:** high | **Dependencies:** 1.3 | **Parallel with:** 2.2, 2.3

Create `apps/client/src/layers/features/canvas/ui/CanvasToggle.tsx`:

- `PanelRight` icon when closed, `PanelRightClose` when open
- Ghost-style button matching `CommandPaletteTrigger` sizing (`h-7 w-7`, `size-4` icon)
- Same motion spring animation as `CommandPaletteTrigger`
- Dot indicator (`size-1.5 rounded-full bg-primary`) when closed with non-null content
- Dynamic `aria-label`: "Open canvas" / "Close canvas"
- Tooltip with keyboard shortcut hint

**Files:** `CanvasToggle.tsx` (new), `canvas/index.ts` (barrel update)

---

### Task 2.2 — Add TOGGLE_CANVAS keyboard shortcut and wire handler

**Size:** medium | **Priority:** high | **Dependencies:** 1.3 | **Parallel with:** 2.1, 2.3

1. Add `TOGGLE_CANVAS` to `SHORTCUTS` in `shortcuts.ts` (navigation group, `mod+.`)
2. Create `use-canvas-shortcut.ts` hook following `useShortcutsPanel` pattern
3. Wire `useCanvasShortcut()` in both `AppShell.tsx` and `App.tsx`
4. Update canvas barrel export

**Files:** `shortcuts.ts`, `use-canvas-shortcut.ts` (new), `AppShell.tsx`, `App.tsx`, `canvas/index.ts`

---

### Task 2.3 — Update command palette canvas action to true toggle

**Size:** small | **Priority:** medium | **Dependencies:** 1.3 | **Parallel with:** 2.1, 2.2

1. Change label from "Open Canvas" to "Toggle Canvas" in `palette-contributions.ts`
2. Change action from `'openCanvas'` to `'toggleCanvas'`
3. Update handler in `use-palette-actions.ts` to use `setCanvasOpen(!useAppStore.getState().canvasOpen)`

**Files:** `palette-contributions.ts`, `use-palette-actions.ts`

---

### Task 2.4 — Place CanvasToggle in SessionHeader

**Size:** small | **Priority:** high | **Dependencies:** 2.1

Import `CanvasToggle` from `@/layers/features/canvas` and render it between the spacer `<div>` and `<CommandPaletteTrigger />` in `SessionHeader`.

FSD-compliant: UI composition across features is allowed.

**Files:** `SessionHeader.tsx`

---

## Phase 3: Session-Aware Hydration

### Task 3.1 — Create useCanvasPersistence hook and integrate with SessionPage

**Size:** medium | **Priority:** high | **Dependencies:** 1.3, 2.1

1. Create `use-canvas-persistence.ts` — calls `loadCanvasForSession(sessionId)` in a `useEffect` keyed on `sessionId`
2. Call `useCanvasPersistence(activeSessionId)` from `SessionPage`
3. Update canvas barrel export

**Behavior:** On mount or session change, reads localStorage and hydrates canvas state. Subsequent setters write-through (handled by task 1.3).

**Files:** `use-canvas-persistence.ts` (new), `SessionPage.tsx`, `canvas/index.ts`

---

## Phase 4: Tests

### Task 4.1 — Add unit tests for readCanvasSession and writeCanvasSession helpers

**Size:** medium | **Priority:** medium | **Dependencies:** 1.2 | **Parallel with:** 4.2, 4.3

Test cases:

- Read: null when empty, null when missing, returns entry, returns with content, corrupt JSON returns null, SecurityError returns null
- Write: new entry, update entry, preserves siblings, LRU eviction at cap (51 -> 50), quota exceeded no-throw

**Files:** `canvas-session-helpers.test.ts` (new)

---

### Task 4.2 — Add component test for CanvasToggle

**Size:** medium | **Priority:** medium | **Dependencies:** 2.1 | **Parallel with:** 4.1, 4.3

Test cases:

- Renders "Open canvas" aria-label when closed
- Renders "Close canvas" aria-label when open
- Click calls `setCanvasOpen` with toggled value
- Dot indicator visible when closed + content
- Dot indicator hidden when open or no content

**Files:** `CanvasToggle.test.tsx` (new)

---

### Task 4.3 — Update SessionHeader test and add canvas persistence integration test

**Size:** medium | **Priority:** medium | **Dependencies:** 2.4, 3.1 | **Parallel with:** 4.1, 4.2

1. Update `SessionHeader.test.tsx` mock to include canvas state, add test for CanvasToggle rendering
2. Create `use-canvas-persistence.test.ts` — tests hydration on mount, re-hydration on session change, no-op for undefined, no re-fire for same ID
3. Verify all existing canvas tests pass without modification

**Files:** `SessionHeader.test.tsx` (update), `use-canvas-persistence.test.ts` (new)

---

## Dependency Graph

```
1.1 ──→ 1.2 ──→ 1.3 ──→ 2.1 ──→ 2.4
                  │        │
                  │        ├──→ 3.1 ──→ 4.3
                  │        │
                  ├──→ 2.2 ├──→ 4.2
                  │
                  ├──→ 2.3
                  │
                  └──→ 4.1
```

## Summary

| Phase                      | Tasks  | Files changed | Files created |
| -------------------------- | ------ | ------------- | ------------- |
| 1. Storage Infrastructure  | 3      | 3             | 0             |
| 2. Canvas Toggle           | 4      | 5             | 2             |
| 3. Session-Aware Hydration | 1      | 2             | 1             |
| 4. Tests                   | 3      | 1             | 4             |
| **Total**                  | **11** | **11**        | **7**         |
