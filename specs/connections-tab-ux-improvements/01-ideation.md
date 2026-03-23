---
slug: connections-tab-ux-improvements
number: 165
created: 2026-03-22
status: ideation
---

# ConnectionsTab UX Improvements

**Slug:** connections-tab-ux-improvements
**Author:** Claude Code
**Date:** 2026-03-22
**Branch:** preflight/connections-tab-ux-improvements

---

## 1) Intent & Assumptions

- **Task brief:** Improve both ConnectionsTab components in the DorkOS client — the Relay adapter management surface (`features/relay/ui/ConnectionsTab.tsx`) and the Agent-Settings status display (`features/agent-settings/ui/ConnectionsTab.tsx`). Covers UX improvements (empty states, responsive grid, binding row discoverability, actionable status with deep-links, relative time), code quality (AdapterCard decomposition, AdapterSetupWizard hook extraction, dead code removal), and missing functionality (QuickBindingPopover agent filtering).

- **Assumptions:**
  - The Relay ConnectionsTab is the primary surface — most improvements target it
  - The Agent-Settings ConnectionsTab should become actionable, not just informational
  - AdapterCard (462 lines) and AdapterSetupWizard (512 lines) both need decomposition per file-size rules
  - No API/backend changes are needed — all improvements are client-side
  - Existing test coverage (AdapterCard.test.tsx, 598 lines) must be maintained and extended

- **Out of scope:**
  - New adapter types or binding API changes
  - Relay convergence or architectural changes to the adapter system
  - Marketing site or docs changes
  - New e2e/browser tests (unit test coverage only)

---

## 2) Pre-reading Log

### Developer Guides

- `contributing/design-system.md`: Calm Tech design tokens — `rounded-xl` cards, `shadow-soft`/`shadow-elevated`, 8pt grid, 100-300ms animations
- `contributing/state-management.md`: Zustand for UI state, TanStack Query for server state
- `contributing/animations.md`: motion library patterns, AnimatePresence for enter/exit
- `.claude/rules/file-size.md`: 300-line ideal, 500+ must split
- `.claude/rules/components.md`: cn() for classes, data-slot, focus-visible, `group` for hover states

### Components (Relay Feature)

- `features/relay/ui/ConnectionsTab.tsx` (157 lines): Root orchestrator — loading skeleton, configured adapters section, available adapters grid, wizard modal. Well-structured but empty state is passive.
- `features/relay/ui/AdapterCard.tsx` (462 lines): **MUST SPLIT** — Header (status dot, emoji, name, toggle, kebab menu), subtitle (type + category badge), body (binding rows with overflow), footer (collapsible error), plus 3 inline dialogs (remove alert, events sheet, binding dialog). 8 useState hooks, 3 mutations.
- `features/relay/ui/AdapterSetupWizard.tsx` (512 lines): **MUST SPLIT** — 4-step wizard (configure, test, confirm, bind). Heavy form state management. Steps already extracted to `wizard/` subdirectory but parent manages all state.
- `features/relay/ui/CatalogCard.tsx` (42 lines): Available adapter type card — icon, name, badge, description, Add button. Forced 2-col grid in parent.
- `features/relay/ui/AdapterBindingRow.tsx` (86 lines): Compact binding display — agent name, strategy badge, chat ID, permission tooltips. Clickable but hover affordance is subtle.
- `features/relay/ui/QuickBindingPopover.tsx` (94 lines): Searchable agent picker for one-click binding. Has unused `adapterId` prop (`void adapterId`).
- `features/relay/ui/AdapterEventLog.tsx` (155 lines): Timestamped event stream viewer.
- `features/relay/ui/SetupGuideSheet.tsx` (49 lines): Help sheet.
- `features/relay/lib/format-time.ts` (11 lines): `formatTimeAgo()` — "3m ago", "2h ago", "1d ago". No auto-refresh.
- `features/relay/lib/category-colors.ts` (17 lines): Badge color map for categories.
- `features/relay/lib/binding-labels.ts` (6 lines): Strategy badge labels.

### Components (Agent-Settings Feature)

- `features/agent-settings/ui/ConnectionsTab.tsx` (82 lines): Read-only 3-section status display (Pulse, Relay, Mesh). Entirely passive — says "go configure in panel X" without linking. Hardcoded "Enabled" badge for Mesh. Uses `toLocaleString()` for timestamps.
- `features/agent-settings/ui/AgentDialog.tsx` (168 lines): 4-tab dialog shell (Identity, Personality, Capabilities, Connections).

### Entity Layer (Hooks)

- `entities/relay/model/`: useAdapterCatalog, useToggleAdapter, useRemoveAdapter, useAdapterEvents
- `entities/binding/model/`: useBindings, useCreateBinding, useDeleteBinding, useUpdateBinding
- `entities/mesh/model/`: useRegisteredAgents, useMeshAgentHealth
- `entities/pulse/model/`: usePulseEnabled

### Integration Points

- `features/mesh/ui/BindingDialog.tsx`: Shared binding create/edit dialog used by AdapterCard
- `widgets/app-layout/ui/DialogHost.tsx`: Renders RelayPanel (wraps ConnectionsTab) and AgentDialog. Manages open/close via app store (relayOpen, agentDialogOpen).

### Tests

- `features/relay/__tests__/AdapterCard.test.tsx` (598 lines): Comprehensive — rendering, mutations, dialog states, binding rows
- `features/agent-settings/__tests__/AgentDialog.test.tsx` (166 lines): Tab navigation
- **Missing**: No ConnectionsTab tests for either component

### Related Specs

- Spec 132 (`relay-panel-redesign`): The redesign that created the current ConnectionsTab layout — status: implemented
- Spec 134 (`relay-panel-ux-fixes`): Binding CRUD, health bar, activity feed fixes
- Spec 117 (`sidebar-tabbed-views`): Sessions, Schedules, Connections tabs in sidebar

### Related Research

- `research/20260311_adapter_binding_ux_overhaul_gaps.md`: Five-state status model, amber dot for unbound adapters
- `research/20260311_adapter_binding_configuration_ux_patterns.md`: Binding list UI, progressive disclosure
- `research/20260227_adapter_catalog_patterns.md`: ConfigField pattern, AdapterManifest, setup wizard
- `research/20260322_connections_tab_ux_best_practices.md`: Empty states, card decomposition, row discoverability, responsive grids, relative time (created during this ideation)

---

## 3) Codebase Map

### Primary Components/Modules

| File                                            | Lines | Role                                        |
| ----------------------------------------------- | ----- | ------------------------------------------- |
| `features/relay/ui/ConnectionsTab.tsx`          | 157   | Adapter catalog + configured instances view |
| `features/relay/ui/AdapterCard.tsx`             | 462   | Configured adapter display + dialog host    |
| `features/relay/ui/AdapterSetupWizard.tsx`      | 512   | Multi-step adapter configuration wizard     |
| `features/relay/ui/CatalogCard.tsx`             | 42    | Available adapter type card                 |
| `features/relay/ui/AdapterBindingRow.tsx`       | 86    | Compact binding row display                 |
| `features/relay/ui/QuickBindingPopover.tsx`     | 94    | Quick agent picker for binding              |
| `features/relay/lib/format-time.ts`             | 11    | Relative time formatter                     |
| `features/agent-settings/ui/ConnectionsTab.tsx` | 82    | Agent subsystem status display              |
| `features/agent-settings/ui/AgentDialog.tsx`    | 168   | Agent configuration dialog shell            |

### Shared Dependencies

- `@/layers/shared/ui`: Badge, Button, Switch, Skeleton, Collapsible, Sheet, AlertDialog, DropdownMenu, Popover, Command, Tooltip
- `@/layers/entities/relay`: useAdapterCatalog, useToggleAdapter, useRemoveAdapter, useRelayEnabled
- `@/layers/entities/binding`: useBindings, useCreateBinding, useDeleteBinding, useUpdateBinding
- `@/layers/entities/mesh`: useRegisteredAgents, useMeshAgentHealth
- `@/layers/entities/pulse`: usePulseEnabled
- `@/layers/features/mesh/ui/BindingDialog`: Shared binding CRUD dialog

### Data Flow

```
Relay ConnectionsTab:
  useAdapterCatalog → CatalogEntry[] → split into configured/available
  configured → AdapterCard[] (each with useBindings, useRegisteredAgents)
  available → CatalogCard[] (onAdd opens wizard)
  AdapterCard → kebab menu → events sheet / binding dialog / remove alert / configure wizard

Agent-Settings ConnectionsTab:
  usePulseEnabled → boolean badge
  useRelayEnabled → boolean badge
  useMeshAgentHealth(agentId) → status + lastSeenAt
```

### Feature Flags/Config

- Relay: `enabled` prop gates the entire ConnectionsTab (feature flag from server)
- Pulse: `usePulseEnabled()` hook checks server config
- Mesh: Always enabled (hardcoded — should derive from actual registry state)

### Potential Blast Radius

**Direct changes:** 9 files (2 ConnectionsTab, AdapterCard, AdapterSetupWizard, CatalogCard, AdapterBindingRow, QuickBindingPopover, format-time, + new extracted files)

**Dependent files:** 4 parent/barrel files (RelayPanel, AgentDialog, both index.ts), DialogHost (if deep-link navigation changes dialog state)

**Tests:** AdapterCard.test.tsx (598 lines) must be refactored for decomposed components. 2 new test files for ConnectionsTab coverage.

**Cross-feature risk:** None — FSD enforces isolation between relay and agent-settings features.

---

## 4) Root Cause Analysis

N/A — this is a UX/code quality improvement, not a bug fix.

---

## 5) Research

### Potential Solutions

**1. Empty State — Action-Focused, Single CTA**

- Description: Replace passive "No adapters configured yet" with muted icon + one-line explanation + single "Add Adapter" button. Follow Linear/Vercel/Stripe pattern — no illustrations for power users.
- Pros: Direct path to action, zero decision paralysis, consistent with Calm Tech
- Cons: Minimal — standard pattern
- Complexity: Low
- Maintenance: Low

**2. Card Decomposition — Dialog Host Extraction**

- Description: Extract AdapterCard into display-only card (~130 lines) + extracted sub-components (AdapterCardHeader, AdapterCardBindings, AdapterCardError) + move dialogs to parent level via intent callbacks. Extract wizard form state into `useAdapterSetupForm` hook.
- Pros: Each file under 300 lines, dialogs no longer embedded in cards (shadcn best practice), testable in isolation
- Cons: Test rewrite for AdapterCard.test.tsx, more files to manage
- Complexity: Medium-High
- Maintenance: Low (cleaner separation)

**3. Binding Row Discoverability — Group Hover + Chevron**

- Description: Use Tailwind `group` utility for hover bg transition + opacity-0-to-visible pencil/chevron icon on hover. The hover state IS the affordance.
- Pros: No permanent visual noise, follows Vercel design guidelines, accessible via button semantics
- Cons: Hidden on touch devices (but binding rows are already buttons)
- Complexity: Low
- Maintenance: Low

**4. Agent-Settings Deep-Links — Navigate + Close Dialog**

- Description: Each subsystem row gets a link/button that closes the AgentDialog, navigates to the relevant panel, and pre-filters to the current agent. Uses app store actions.
- Pros: Direct actionability, follows Datadog/Stripe navigation pattern, eliminates "go configure elsewhere" text
- Cons: Requires coordination between AgentDialog close and panel open via app store
- Complexity: Medium
- Maintenance: Low

**5. Responsive Catalog Grid — CSS auto-fill**

- Description: Replace `grid-cols-2` with `repeat(auto-fill, minmax(240px, 1fr))` for the catalog. Active adapter list stays single-column (full width for binding rows).
- Pros: Naturally adapts to panel width, no media queries, handles sidebar resize
- Cons: Slightly less predictable than fixed columns
- Complexity: Low
- Maintenance: Low

**6. Relative Time — Enhanced formatTimeAgo + useAutoRelativeTime Hook**

- Description: Enhance existing `format-time.ts` utility. Add `useAutoRelativeTime` hook with adaptive refresh intervals (10s for <1min, 60s for <1hr, 1hr for older). Wrap in `<time>` element with absolute title tooltip.
- Pros: Zero new dependencies, builds on existing utility, auto-updating
- Cons: Manual implementation vs. library-backed
- Complexity: Low
- Maintenance: Low

**7. QuickBindingPopover Agent Filtering**

- Description: Use the `adapterId` prop to filter out agents that already have a binding to this adapter. Shows only unbound agents in the quick-bind list.
- Pros: Prevents duplicate bindings, makes the prop useful, better UX
- Cons: Need to join bindings data with agent list
- Complexity: Low
- Maintenance: Low

### Recommendation

All seven solutions are complementary and should be implemented together. The highest-impact items are:

1. **AdapterCard decomposition** — code quality, testability, maintainability
2. **Agent-Settings deep-links** — transforms a dead tab into an actionable navigation hub
3. **Empty states + responsive grid** — quick wins with visible UX impact

---

## 6) Decisions

| #   | Decision                          | Choice                         | Rationale                                                                                                                                                         |
| --- | --------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Agent-Settings deep-link behavior | Navigate + close dialog        | Clicking "View in Pulse" closes AgentDialog, navigates to panel, pre-filters to agent. Modal overlap would be confusing. Follows Datadog/Stripe pattern.          |
| 2   | AdapterSetupWizard refactor scope | Include in this spec           | Extract form state into `useAdapterSetupForm` hook. User chose broader scope — wizard is also over 500 lines and benefits from the same treatment as AdapterCard. |
| 3   | Relative time implementation      | Enhance existing formatTimeAgo | Codebase already has `relay/lib/format-time.ts`. Add auto-updating `useAutoRelativeTime` hook wrapper with adaptive intervals. Zero new dependencies.             |
| 4   | QuickBindingPopover adapterId     | Implement filtering            | Filter agent list to exclude agents already bound to this adapter. Adds real value and makes the previously-unused prop meaningful.                               |
