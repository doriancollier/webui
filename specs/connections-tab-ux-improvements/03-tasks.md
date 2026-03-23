# Task Breakdown: ConnectionsTab UX Improvements

Generated: 2026-03-22
Source: specs/connections-tab-ux-improvements/02-specification.md
Last Decompose: 2026-03-22

## Overview

Improve both ConnectionsTab components in the DorkOS client: the Relay adapter management surface (`features/relay`) and the Agent-Settings status display (`features/agent-settings`). This breakdown covers 8 tasks across 3 phases spanning code quality refactors (AdapterCard decomposition, AdapterSetupWizard hook extraction), UX improvements (empty states, responsive grid, binding row discoverability, relative time, agent filtering), and functional enhancements (Agent-Settings deep-links with real data).

---

## Phase 1: Code Quality Refactors

Extract and decompose without changing visible behavior.

### Task 1.1: Decompose AdapterCard into sub-components and extract dialog hosting

**Size**: Large
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.2

**Technical Requirements**:

- Split `AdapterCard.tsx` (462 lines) into 4 files: orchestrator (~120 lines), `AdapterCardHeader.tsx` (~80 lines), `AdapterCardBindings.tsx` (~90 lines), `AdapterCardError.tsx` (~50 lines)
- Move all 3 dialogs (remove AlertDialog, events Sheet, BindingDialog) from AdapterCard to ConnectionsTab
- Create `useAdapterCardDialogs` hook in `features/relay/model/` managing remove, events, and binding dialog state
- AdapterCard becomes display-only, emitting intent callbacks for dialog actions
- ConnectionsTab hosts dialogs using the hook state

**Implementation Steps**:

1. Create `AdapterCardHeader.tsx` — extract header rendering (status dot, emoji, name, Switch, DropdownMenu)
2. Create `AdapterCardBindings.tsx` — extract body section (CCA summary, binding rows, overflow, QuickBindingPopover)
3. Create `AdapterCardError.tsx` — extract error footer (Collapsible error display)
4. Create `useAdapterCardDialogs.ts` — dialog state management with open/close methods
5. Slim down AdapterCard to orchestrator that delegates to sub-components
6. Update ConnectionsTab to use dialog hook, pass intent callbacks to AdapterCard, render dialogs
7. Update barrel exports in `features/relay/index.ts`

**Acceptance Criteria**:

- [ ] AdapterCard.tsx under 150 lines
- [ ] Each sub-component under its target line count
- [ ] All 3 dialogs render from ConnectionsTab, not AdapterCard
- [ ] No visible behavior change
- [ ] All existing AdapterCard.test.tsx tests pass
- [ ] TypeScript compiles without errors

---

### Task 1.2: Extract AdapterSetupWizard form state into useAdapterSetupForm hook

**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1

**Technical Requirements**:

- Extract form state (values, errors, label, adapterId, setupStepIndex, botUsername) and logic (validate, handleFieldChange, visibleFields, unflattenConfig, initializeValues, generateDefaultId) into `use-adapter-setup-form.ts`
- Hook returns structured object with all form state and methods plus a `reset()` function
- Export pure utility functions (unflattenConfig, initializeValues, generateDefaultId) for testing
- Wizard retains step navigation, dialog rendering, mutation orchestration, bind step state

**Implementation Steps**:

1. Create `features/relay/model/use-adapter-setup-form.ts` with all extracted functions and hook
2. Update `AdapterSetupWizard.tsx` to use `const form = useAdapterSetupForm(manifest, existingInstance, existingAdapterIds)`
3. Update all references in wizard to use `form.*` prefix
4. Replace manual state reset in `handleOpenChange` with `form.reset()`

**Acceptance Criteria**:

- [ ] AdapterSetupWizard.tsx under 300 lines
- [ ] use-adapter-setup-form.ts under 180 lines
- [ ] Wizard behavior unchanged across all 4 steps
- [ ] TypeScript compiles without errors

---

### Task 1.3: Update and add tests for decomposed components

**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: None

**Technical Requirements**:

- Update AdapterCard.test.tsx: add new callback props to defaultProps, replace dialog-rendering tests with callback-verification tests
- Create `use-adapter-setup-form.test.ts`: test unflattenConfig, initializeValues, generateDefaultId
- Create `ConnectionsTab.test.tsx` (Relay): test empty state, configured cards, loading skeleton

**Acceptance Criteria**:

- [ ] All existing AdapterCard tests pass after prop interface changes
- [ ] use-adapter-setup-form.test.ts has 8+ passing tests
- [ ] ConnectionsTab.test.tsx has 3+ passing tests
- [ ] All tests run successfully

---

## Phase 2: UX Improvements

Apply visible UX changes. All Phase 2 tasks can run in parallel after Phase 1 completes.

### Task 2.1: Replace empty state with action-focused CTA

**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.1
**Can run parallel with**: Tasks 2.2, 2.3, 2.4, 2.5

**Technical Requirements**:

- Replace passive "No adapters configured yet." text with Plug2 icon + description in dashed border container
- Primary text: "No adapters configured"
- Secondary text: "Add an adapter below to connect agents to external services"
- No button — the Available Adapters section below provides the CTAs

**Acceptance Criteria**:

- [ ] Empty state shows Plug2 icon, primary and secondary text
- [ ] Styled with rounded-xl, border-dashed, centered layout
- [ ] Test verifies both text strings

---

### Task 2.2: Replace fixed grid-cols-2 with responsive auto-fill grid

**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.1
**Can run parallel with**: Tasks 2.1, 2.3, 2.4, 2.5

**Technical Requirements**:

- Replace `grid-cols-2` with inline style `gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'`
- Apply to both the catalog grid and the skeleton loading grid
- 1 column under ~500px, 2 columns when space allows

**Acceptance Criteria**:

- [ ] CatalogCard grid uses auto-fill responsive layout
- [ ] Skeleton grid matches responsive layout
- [ ] No changes to configured adapter card layout

---

### Task 2.3: Add group-hover chevron to binding rows for edit discoverability

**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.1
**Can run parallel with**: Tasks 2.1, 2.2, 2.4, 2.5

**Technical Requirements**:

- Add `ChevronRight` icon inside each binding row button in AdapterCardBindings
- Invisible by default (`opacity-0`), appears on row hover (`group-hover/row:opacity-100`)
- Uses named group `group/row` to scope hover trigger to individual rows

**Acceptance Criteria**:

- [ ] ChevronRight icon present in binding rows, hidden by default
- [ ] Appears only on row hover via group-hover transition
- [ ] No visual change to CCA summary or QuickBindingPopover trigger

---

### Task 2.4: Implement auto-updating relative time with useAutoRelativeTime hook and RelativeTime component

**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 1.1
**Can run parallel with**: Tasks 2.1, 2.2, 2.3, 2.5

**Technical Requirements**:

- Enhance `formatTimeAgo` to return "just now" for timestamps under 60 seconds (replacing "Xs ago")
- Create `useAutoRelativeTime` hook with adaptive refresh intervals (10s / 60s / 1hr)
- Create `RelativeTime` component wrapping output in `<time>` element with dateTime and title
- Add comprehensive tests including fake timer tests for interval verification

**Acceptance Criteria**:

- [ ] formatTimeAgo returns "just now" for sub-minute timestamps
- [ ] Hook auto-refreshes at correct adaptive intervals
- [ ] Timer cleaned up on unmount
- [ ] 7+ tests passing
- [ ] RelativeTime exported from relay barrel

---

### Task 2.5: Implement QuickBindingPopover agent filtering

**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.1
**Can run parallel with**: Tasks 2.1, 2.2, 2.3, 2.4

**Technical Requirements**:

- Remove dead `void adapterId` code
- Import `useBindings` and filter out agents already bound to this specific adapter
- Update CommandEmpty to show "No agents registered" vs "All agents bound" contextually
- Add 3 new test cases

**Acceptance Criteria**:

- [ ] Dead code removed, agent filtering implemented
- [ ] Contextual empty state messages
- [ ] Existing + 3 new tests passing

---

## Phase 3: Agent-Settings Deep-Links

Transform the Agent-Settings ConnectionsTab from passive display to actionable hub.

### Task 3.1: Create SubsystemRow component and transform Agent-Settings ConnectionsTab

**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.4
**Can run parallel with**: None (Task 3.2 depends on this)

**Technical Requirements**:

- Create `SubsystemRow` component (~60 lines) with label, enabled badge, summary, status, loading skeleton, action button
- Rewrite Agent-Settings ConnectionsTab to use SubsystemRow for all 3 sections
- Show real data: schedule count from `useSchedules`, binding count from `useBindings`, health from `useMeshAgentHealth`
- Deep-link navigation: close agent dialog via `setAgentDialogOpen(false)`, then open target panel via `requestAnimationFrame`
- Mesh health shows auto-updating relative time via RelativeTime component

**Acceptance Criteria**:

- [ ] SubsystemRow renders all variants (summary, status, loading, action)
- [ ] Real schedule/binding counts filtered by agent ID
- [ ] Deep-link buttons close dialog then open target panel
- [ ] Mesh health shows skeleton while loading, real status when available
- [ ] No FSD layer violations

---

### Task 3.2: Add Agent-Settings ConnectionsTab tests

**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: None

**Technical Requirements**:

- Create comprehensive test file with 12+ test cases
- Verify Pulse schedule count with agent filtering, Relay binding count with agent filtering
- Verify singular/plural labels, disabled badges, Mesh skeleton loading, Mesh real status
- Verify deep-link navigation calls `setAgentDialogOpen(false)` before opening target panel
- Mock entity hooks, app store, and stub RelativeTime component

**Acceptance Criteria**:

- [ ] 12+ test cases covering all subsystem rows and interactions
- [ ] Deep-link navigation callback verification
- [ ] Agent ID filtering verified (not counting other agents' data)
- [ ] All tests pass

---

## Dependency Graph

```
Phase 1 (parallel):
  1.1 ──┐
  1.2 ──┤
        ├── 1.3
        │
Phase 2 (all parallel after P1):
  1.1 ──┬── 2.1
        ├── 2.2
        ├── 2.3
        ├── 2.4
        └── 2.5

Phase 3 (sequential):
  2.4 ── 3.1 ── 3.2
```

## Summary

| Phase                              | Tasks                   | Total  |
| ---------------------------------- | ----------------------- | ------ |
| Phase 1: Code Quality Refactors    | 1.1, 1.2, 1.3           | 3      |
| Phase 2: UX Improvements           | 2.1, 2.2, 2.3, 2.4, 2.5 | 5      |
| Phase 3: Agent-Settings Deep-Links | 3.1, 3.2                | 2      |
| **Total**                          |                         | **10** |

**Critical Path**: 1.1 -> 2.4 -> 3.1 -> 3.2

**Maximum Parallelism**: Tasks 2.1-2.5 can all run simultaneously after Phase 1 completes. Tasks 1.1 and 1.2 can run in parallel.
