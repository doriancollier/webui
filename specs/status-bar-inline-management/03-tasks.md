# Status Bar Inline Management — Task Breakdown

**Spec:** `specs/status-bar-inline-management/02-specification.md`
**Generated:** 2026-03-24
**Mode:** Full decomposition

---

## Phase 1: Foundation

### 1.1 Create status bar item registry and helper hook

**Size:** Medium | **Priority:** High | **Dependencies:** None | **Parallel with:** 1.2

Create `apps/client/src/layers/features/status/model/status-bar-registry.ts` — the single source of truth for all status bar item metadata. Contains:

- `StatusBarItemKey` type union (11 keys)
- `StatusBarItemConfig` interface with key, label, description, group, icon, defaultVisible
- `STATUS_BAR_REGISTRY` ordered array of 11 items across 3 groups
- `GROUP_LABELS` record mapping group keys to human-readable headers
- `useStatusBarVisibility(key)` hook bridging registry keys to Zustand `showStatusBar*`/`setShowStatusBar*` properties
- `resetStatusBarPreferences()` scoped reset that only resets status bar toggles (not global preferences)
- `getGroupedRegistryItems()` helper returning items organized by group

Update barrel export at `apps/client/src/layers/features/status/index.ts`.

**Tests:** Registry has 11 unique entries, every key maps to a store property, grouped items return correct counts (5/4/2), scoped reset only affects status bar prefs.

---

### 1.2 Install shadcn ContextMenu and create responsive-popover

**Size:** Medium | **Priority:** High | **Dependencies:** None | **Parallel with:** 1.1

1. Install `context-menu` via shadcn CLI into `apps/client/` (not currently in the codebase)
2. Export from `apps/client/src/layers/shared/ui/index.ts`
3. Create `apps/client/src/layers/shared/ui/responsive-popover.tsx` — follows the same pattern as the existing `responsive-dialog.tsx` but switches between Popover (desktop) and Sheet (mobile)
4. Components: `ResponsivePopover`, `ResponsivePopoverTrigger`, `ResponsivePopoverContent`, `ResponsivePopoverTitle`, `useResponsivePopover`
5. Export from shared UI barrel

**Tests:** Content renders as PopoverContent on desktop, SheetContent on mobile. Title returns null on desktop. Context hook throws outside provider.

---

## Phase 2: Core UI

### 2.1 Build StatusBarConfigureContent and StatusBarConfigurePopover

**Size:** Large | **Priority:** High | **Dependencies:** 1.1, 1.2

1. Create `apps/client/src/layers/features/status/ui/StatusBarConfigureContent.tsx` — grouped toggle list using `SettingRow` + `Switch` per registry item, with Lucide icons and "Reset to defaults" button
2. Create `apps/client/src/layers/features/status/ui/StatusBarConfigurePopover.tsx` — responsive wrapper using `ResponsivePopover`, opens upward on desktop (`side="top"`, `align="end"`), bottom Sheet on mobile
3. Update `SettingRow` label prop from `string` to `React.ReactNode` for icon support (backwards-compatible)
4. Export from status feature barrel

**Tests:** All 11 items render with correct labels, group headers render, switch toggles update store, reset button exists and works, icons render.

---

### 2.2 Add configure icon and right-click context menus to ChatStatusSection

**Size:** Large | **Priority:** High | **Dependencies:** 1.1, 1.2, 2.1

1. Add `SlidersHorizontal` configure icon as last `StatusLine.Item` (always visible, `text-muted-foreground/50`, tooltip "Configure status bar")
2. Create `ItemContextMenu` helper wrapping each registry item's children with `ContextMenu` showing "Hide [label]", separator, "Configure status bar...", "Reset to defaults"
3. Add background context menu on status bar container (no "Hide" option — just configure and reset)
4. System-managed items (connection, clients) do not get "Hide" in context menu
5. Configure icon not wrapped in context menu (structural, not toggleable)

**Tests:** Configure icon renders with aria-label, clicking opens popover, right-click shows context menu with "Hide [label]", hide calls correct store setter.

---

## Phase 3: Refactoring

### 3.1 Refactor Settings dialog Status Bar tab to use registry

**Size:** Medium | **Priority:** Medium | **Dependencies:** 1.1 | **Parallel with:** 3.2

1. Replace ~80 lines of hardcoded `SettingRow` + `Switch` blocks in the Status Bar tab with a `STATUS_BAR_REGISTRY.map()` loop
2. Create `StatusBarSettingRow` component using `useStatusBarVisibility` hook
3. Add scoped "Reset to defaults" button to the Status Bar panel header (calls `resetStatusBarPreferences()`, not global `resetPreferences()`)
4. Remove unused `showStatusBar*`/`setShowStatusBar*` destructuring from `useAppStore()` in `SettingsDialog`
5. Fixes a gap: the current hardcoded version is missing the `showStatusBarVersion` toggle — the registry includes it

**Tests:** All 11 items render as toggle rows, toggling calls store, reset is scoped, Appearance tab reset still global.

---

### 3.2 Verify accessibility and add comprehensive integration tests

**Size:** Medium | **Priority:** Medium | **Dependencies:** 2.1, 2.2 | **Parallel with:** 3.1

1. Verify configure icon has `aria-label="Configure status bar"`
2. Verify popover has `aria-label="Status bar configuration"`
3. Verify context menu provides `role="menu"` and `role="menuitem"` (Radix)
4. Verify focus trapping in popover
5. Integration test: every `showStatusBar*` store property has a corresponding registry entry
6. Integration test: `resetStatusBarPreferences()` only resets status bar toggles
7. Integration test: registry `defaultVisible` values align with store defaults

**Tests:** Registry-store alignment, scoped reset isolation, accessibility attributes present.

---

## Dependency Graph

```
1.1 ──┬──> 2.1 ──> 2.2 ──> 3.2
1.2 ──┘                      │
1.1 ──────────────> 3.1 ─────┘ (parallel with 3.2)
```

## Summary

| Phase           | Tasks | Parallel Opportunities     |
| --------------- | ----- | -------------------------- |
| P1: Foundation  | 2     | 1.1 and 1.2 fully parallel |
| P2: Core UI     | 2     | Sequential (2.1 then 2.2)  |
| P3: Refactoring | 2     | 3.1 and 3.2 fully parallel |
| **Total**       | **6** |                            |

**New files:** 5 (registry, configure content, configure popover, responsive-popover, context-menu)
**Modified files:** 4 (ChatStatusSection, SettingsDialog, setting-row, status/index.ts barrel, shared/ui/index.ts barrel)
