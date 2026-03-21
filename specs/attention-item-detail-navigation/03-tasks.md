# Attention Item Detail Navigation — Task Breakdown

**Spec:** `specs/attention-item-detail-navigation/02-specification.md`
**Generated:** 2026-03-20
**Mode:** Full decomposition

---

## Phase 1: Foundation

### 1.1 Add dashboard search schema with validated detail params to router

**Size:** Small | **Priority:** High | **Dependencies:** None | **Parallel with:** 1.2

Add a Zod-validated search schema (`dashboardSearchSchema`) to the dashboard index route in `router.tsx`. The schema validates two optional search params: `detail` (enum of `'dead-letter' | 'failed-run' | 'offline-agent'`) and `itemId` (string). Export a `DashboardSearch` type. Add `validateSearch: zodValidator(dashboardSearchSchema)` to the existing `indexRoute` definition, preserving the `beforeLoad` session redirect logic.

**Files modified:** `apps/client/src/router.tsx`

---

### 1.2 Extract formatRelativeTime to dashboard-attention lib utility

**Size:** Small | **Priority:** High | **Dependencies:** None | **Parallel with:** 1.1

Extract the inline `formatRelativeTime` function from `AttentionItem.tsx` into `dashboard-attention/lib/format-relative-time.ts` so the new Sheet components can reuse it. Update `AttentionItem.tsx` to import from the new location.

**Files created:** `apps/client/src/layers/features/dashboard-attention/lib/format-relative-time.ts`
**Files modified:** `apps/client/src/layers/features/dashboard-attention/ui/AttentionItem.tsx`

---

## Phase 2: Sheet Components

### 2.1 Create DeadLetterDetailSheet component

**Size:** Medium | **Priority:** High | **Dependencies:** 1.2 | **Parallel with:** 2.2, 2.3

Create `DeadLetterDetailSheet.tsx` that shows dead letter group details: source subtitle, count, reason badge, first/last seen timestamps, optional sample payload as formatted JSON, and a "Dismiss Group" action button using `useDismissDeadLetterGroup()`. Parses compound key `source::reason` from `itemId`. Shows resolved state when no matching group is found.

**Files created:** `apps/client/src/layers/features/dashboard-attention/ui/DeadLetterDetailSheet.tsx`

---

### 2.2 Create FailedRunDetailSheet component

**Size:** Medium | **Priority:** High | **Dependencies:** 1.2 | **Parallel with:** 2.1, 2.3

Create `FailedRunDetailSheet.tsx` that shows failed Pulse run details: status badge (red "Failed"), trigger badge ("Scheduled"/"Manual"), timeline (started/finished/duration), error message in destructive alert, output summary in scrollable pre block, "View Session" button (conditional on `sessionId`), and "Cancel" button (conditional on `status === 'running'`). Uses `useRun(itemId)` for data, only enabled when Sheet is open. Shows loading skeleton, error state, and resolved state.

**Files created:** `apps/client/src/layers/features/dashboard-attention/ui/FailedRunDetailSheet.tsx`

---

### 2.3 Create OfflineAgentDetailSheet component

**Size:** Medium | **Priority:** High | **Dependencies:** 1.2 | **Parallel with:** 2.1, 2.2

Create `OfflineAgentDetailSheet.tsx` that lists all unreachable mesh agents using `useRegisteredAgents()` filtered client-side. Each agent row shows emoji + color dot (via `useAgentVisual`), name, "Unreachable" badge, runtime badge, and last-seen timestamp. Empty state shows green checkmark with "All agents are online" text.

**Files created:** `apps/client/src/layers/features/dashboard-attention/ui/OfflineAgentDetailSheet.tsx`

---

### 2.4 Update dashboard-attention barrel to export new Sheet components

**Size:** Small | **Priority:** High | **Dependencies:** 2.1, 2.2, 2.3

Add `DeadLetterDetailSheet`, `FailedRunDetailSheet`, and `OfflineAgentDetailSheet` exports to `dashboard-attention/index.ts`. Update module-level TSDoc.

**Files modified:** `apps/client/src/layers/features/dashboard-attention/index.ts`

---

## Phase 3: Wiring

### 3.1 Update use-attention-items to navigate via search params instead of Zustand panel state

**Size:** Medium | **Priority:** High | **Dependencies:** 1.1 | **Parallel with:** 3.2

Replace Zustand panel state calls (`setPulseOpen`, `setRelayOpen`, `setMeshOpen`) in `use-attention-items.ts` with TanStack Router `navigate()` calls using search params. Failed run actions navigate with `detail: 'failed-run'` and `itemId: run.id`. Dead letter actions use `detail: 'dead-letter'` and compound `itemId: 'source::reason'`. Offline agent actions use `detail: 'offline-agent'` and `itemId: 'offline'`. Remove `useAppStore` import and all Zustand setter references.

**Files modified:** `apps/client/src/layers/features/dashboard-attention/model/use-attention-items.ts`

---

### 3.2 Wire DashboardPage to read search params and render detail Sheets

**Size:** Medium | **Priority:** High | **Dependencies:** 1.1, 2.4 | **Parallel with:** 3.1

Update `DashboardPage.tsx` to read `detail` and `itemId` from `useSearch()`, define a `closeSheet` handler that clears both params, and render the three Sheet components conditionally based on `detail` value. Each Sheet receives `open` (boolean), `itemId`, and `onClose` props.

**Files modified:** `apps/client/src/layers/widgets/dashboard/ui/DashboardPage.tsx`

---

## Phase 4: Tests

### 4.1 Update use-attention-items tests for search param navigation

**Size:** Medium | **Priority:** High | **Dependencies:** 3.1 | **Parallel with:** 4.2, 4.3, 4.4

Remove Zustand mock setup (`mockSetPulseOpen`, `mockSetRelayOpen`, `mockSetMeshOpen`) from the test file. Replace existing action tests with new ones that verify `navigate` is called with the correct search param function producing `{ detail, itemId }` values. Verify stalled session navigation is unchanged.

**Files modified:** `apps/client/src/layers/features/dashboard-attention/__tests__/use-attention-items.test.ts`

---

### 4.2 Add DeadLetterDetailSheet tests

**Size:** Medium | **Priority:** Medium | **Dependencies:** 2.1 | **Parallel with:** 4.1, 4.3, 4.4

Tests cover: rendering details with matching group, sample payload visibility, resolved state, dismiss mutation with correct source/reason, loading state on dismiss button, close button.

**Files created:** `apps/client/src/layers/features/dashboard-attention/__tests__/DeadLetterDetailSheet.test.tsx`

---

### 4.3 Add FailedRunDetailSheet tests

**Size:** Medium | **Priority:** Medium | **Dependencies:** 2.2 | **Parallel with:** 4.1, 4.2, 4.4

Tests cover: rendering run details, error message, session link visibility/navigation, loading skeleton state, error state, resolved state, output summary, trigger badge variants (scheduled/manual).

**Files created:** `apps/client/src/layers/features/dashboard-attention/__tests__/FailedRunDetailSheet.test.tsx`

---

### 4.4 Add OfflineAgentDetailSheet tests

**Size:** Medium | **Priority:** Medium | **Dependencies:** 2.3 | **Parallel with:** 4.1, 4.2, 4.3

Tests cover: rendering agent list (filtered to unreachable), count subtitle singular/plural, empty state when all agents online, runtime badge, no-runtime handling, close button, Unreachable badge count.

**Files created:** `apps/client/src/layers/features/dashboard-attention/__tests__/OfflineAgentDetailSheet.test.tsx`

---

## Dependency Graph

```
1.1 ─────────────────────┬──── 3.1 ──── 4.1
                         │
1.2 ──┬── 2.1 ──┐        │
      ├── 2.2 ──┼── 2.4 ─┴── 3.2
      └── 2.3 ──┘
                │
          2.1 ──────────── 4.2
          2.2 ──────────── 4.3
          2.3 ──────────── 4.4
```

## Summary

| Phase                | Tasks  | Size Breakdown    |
| -------------------- | ------ | ----------------- |
| P1: Foundation       | 2      | 2 small           |
| P2: Sheet Components | 4      | 3 medium, 1 small |
| P3: Wiring           | 2      | 2 medium          |
| P4: Tests            | 4      | 4 medium          |
| **Total**            | **12** |                   |
