# Status Bar Inline Management

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-03-24
**Slug:** status-bar-inline-management

---

## 1. Overview

Add inline management to the status bar so users can hide/show items directly from the bar itself, without navigating to the Settings dialog. A trailing configure icon opens a grouped toggle popover, and a right-click context menu provides a power-user shortcut for hiding individual items.

## 2. Background / Problem Statement

The status bar has 10+ configurable items, all managed exclusively through the Settings dialog's Status Bar tab. This works for deliberate configuration but fails for in-context adjustments ("this item is bugging me right now"). Users have no inline affordance to discover what items exist, hide items they don't need, or re-enable hidden items — they must remember that the Settings dialog has a Status Bar tab.

World-class developer tools (VS Code, IntelliJ, Linear) solve this with inline customization surfaces. The research (`research/20260324_status_bar_inline_management_ux.md`) identifies a three-layer pattern: visible configure icon as primary entry point, right-click context menu as secondary, and a full management surface (popover/flyout) for comprehensive control.

## 3. Goals

- Allow users to hide/show status bar items inline without opening Settings
- Provide a discoverable, left-click primary entry point (configure icon at end of bar)
- Provide a right-click context menu as a power-user shortcut
- Create a data-driven item registry as the single source of truth for all status bar item metadata
- Reuse existing `SettingRow` + `Switch` components for the popover content
- Support mobile via bottom Sheet instead of floating Popover
- Keep the Settings dialog Status Bar tab as-is (both paths share the same Zustand store)

## 4. Non-Goals

- Drag-to-reorder items (item order stays fixed)
- Per-item hover dismiss (`×`) — conflicts with existing hover interactions on items
- Replacing the Settings dialog Status Bar tab
- Adding new status bar items (this spec covers the management UX, not new items)
- Persisting item order (no order state needed since order is fixed)

## 5. Design

### 5.1 Status Bar Item Registry

A data-driven array replaces the current hardcoded item composition in `ChatStatusSection`. Each entry describes a status bar item's metadata.

```ts
/** Union of all registry item keys, derived from the REGISTRY array via `typeof REGISTRY[number]['key']`. */
type StatusBarItemKey =
  | 'cwd'
  | 'git'
  | 'model'
  | 'cost'
  | 'context'
  | 'permission'
  | 'sound'
  | 'sync'
  | 'polling'
  | 'tunnel'
  | 'version';

interface StatusBarItemConfig {
  /** Unique key matching the Zustand store property suffix (e.g., 'cwd' → showStatusBarCwd). */
  key: StatusBarItemKey;
  /** Human-readable label shown in the popover and right-click menu. */
  label: string;
  /** Short description shown as subtitle in the popover. */
  description: string;
  /** Grouping category for popover section headers. */
  group: 'session' | 'controls' | 'system';
  /** Lucide icon component for the popover row. */
  icon: LucideIcon;
  /** Default visibility state, used by the scoped reset function. */
  defaultVisible: boolean;
}
```

**Registry contents:**

| Key          | Label           | Description                     | Group    |
| ------------ | --------------- | ------------------------------- | -------- |
| `cwd`        | Directory       | Current working directory       | session  |
| `git`        | Git Status      | Branch name and change count    | session  |
| `model`      | Model           | Selected AI model               | session  |
| `cost`       | Cost            | Session cost in USD             | session  |
| `context`    | Context Usage   | Context window utilization      | session  |
| `permission` | Permission Mode | Agent permission level selector | controls |
| `sound`      | Sound           | Notification sound toggle       | controls |
| `sync`       | Sync            | Multi-window sync toggle        | controls |
| `polling`    | Refresh         | Background polling for updates  | controls |
| `tunnel`     | Remote          | Remote control indicator        | system   |
| `version`    | Version         | Update available indicator      | system   |

**Group labels:** `session` → "Session Info", `controls` → "Controls", `system` → "System".

**Default visibility:** Each registry entry includes a `defaultVisible: boolean` field used by the scoped reset function. All items default to `true` except where noted. This is the single source of truth for defaults, replacing the split between registry metadata and `BOOL_DEFAULTS` in the store.

Items not in the registry (e.g., `connection`, `clients`) are **system-managed** — they show/hide based on application state, not user preference, and do not appear in the configure popover.

**Location:** `apps/client/src/layers/features/status/model/status-bar-registry.ts`

### 5.2 Configure Icon

A `SlidersHorizontal` icon rendered as the last `StatusLine.Item` in the status bar.

**Properties:**

- **Key:** `"configure"` (not in the registry — it's structural, not toggleable)
- **Always visible:** Cannot be hidden by the user
- **Visual treatment:** `text-muted-foreground/50` default, `text-muted-foreground` on hover. Same `text-xs` size as other items.
- **Tooltip:** "Configure status bar" (via shadcn `Tooltip`)
- **On click:** Opens the `StatusBarConfigurePopover`
- **Separator:** Rendered with the standard middot separator like other items

**Location:** Rendered inline in `ChatStatusSection.tsx` as the final `StatusLine.Item`.

**Side effect — status bar always visible:** Because the configure icon is always visible and always registered with `StatusLine`, `hasVisibleChildren` is always true. This means the status bar container never fully collapses, even if all user-toggleable items are hidden. This is intentional — a fully collapsed status bar with no configure affordance would strand users with no way to re-enable items inline. The background right-click context menu (Section 5.5) also depends on the container being present.

### 5.3 Configure Popover (Desktop)

A shadcn `Popover` anchored to the configure icon, opening upward (`side="top"`, `align="end"`).

**Content structure:**

```
┌─────────────────────────────────────────┐
│  STATUS BAR ITEMS          (section label)
├─────────────────────────────────────────┤
│  SESSION INFO              (group header)
│  ───────────────────────────────────────│
│  📁 Directory                    [═══] │
│     Current working directory          │
│  🔀 Git Status                   [═══] │
│     Branch name and change count       │
│  🤖 Model                        [═══] │
│     Selected AI model                  │
│  💰 Cost                         [═══] │
│     Session cost in USD                │
│  📊 Context Usage                [═══] │
│     Context window utilization         │
│                                        │
│  CONTROLS                  (group header)
│  ───────────────────────────────────────│
│  🛡️ Permission Mode              [═══] │
│     Agent permission level selector    │
│  🔔 Sound                        [═══] │
│     Notification sound toggle          │
│  🔄 Sync                         [ ○ ] │
│     Multi-window sync toggle           │
│  ⟳  Refresh                      [═══] │
│     Background polling for updates     │
│                                        │
│  SYSTEM                    (group header)
│  ───────────────────────────────────────│
│  🌐 Remote                       [═══] │
│     Remote control indicator           │
│                                        │
│  ─────────────────────────────────────  │
│  Reset to defaults                     │
└─────────────────────────────────────────┘
```

**Implementation details:**

- Each row is a `SettingRow` component with a `Switch` child — identical to the Settings dialog Status Bar tab
- Group headers are small uppercase labels (`text-xs text-muted-foreground uppercase tracking-wide`)
- Toggle switches read/write from the same Zustand store properties as the Settings dialog
- "Reset to defaults" link at the bottom calls a **scoped** `resetStatusBarPreferences()` function that only resets `showStatusBar*` booleans to their `defaultVisible` values from the registry. It must NOT call the global `resetPreferences()` which resets all preferences (font, theme, timestamps, etc.)
- Popover has `max-h-[70vh] overflow-y-auto` for scroll on smaller screens
- Icons use Lucide icon components from the registry, rendered at 14px in `text-muted-foreground` (the emoji icons in the ASCII diagram above are illustrative — actual implementation uses Lucide components)

**Location:** `apps/client/src/layers/features/status/ui/StatusBarConfigurePopover.tsx`

### 5.4 Configure Sheet (Mobile)

On screens below the `sm` breakpoint, the configure icon opens a shadcn `Sheet` (bottom drawer, `side="bottom"`) instead of a `Popover`.

**Implementation:** A responsive wrapper component that renders `Popover` on desktop and `Sheet` on mobile, sharing the same content component. The codebase already has `layers/shared/ui/responsive-dialog.tsx` which implements a Dialog↔Drawer responsive pattern — the new `responsive-popover.tsx` follows the same approach. The toggle list content is extracted into `StatusBarConfigureContent.tsx` and rendered by both containers.

**Sheet-specific details:**

- `SheetTitle`: "Configure Status Bar"
- Max height: `80vh` with internal scroll
- Close via drag-down gesture, X button, or tapping outside

### 5.5 Right-Click Context Menu

Each `StatusLine.Item` (except the configure icon) is wrapped in a shadcn `ContextMenu`.

**Menu structure for a specific item (e.g., right-clicking "Git Status"):**

```
Hide "Git Status"
────────────────────
Configure status bar...
Reset to defaults
```

**Menu structure for the status bar background (not on any item):**

```
Configure status bar...
Reset to defaults
```

**Implementation details:**

- `ContextMenuTrigger` wraps each `StatusLine.Item`
- "Hide [label]" uses the item's `label` from the registry and calls the corresponding `setShowStatusBar{Key}(false)`
- "Configure status bar..." opens the same popover/sheet as clicking the configure icon
- "Reset to defaults" calls the status bar reset function
- The background context menu wraps the `StatusLine` container itself

**Location:** Context menu logic lives in `ChatStatusSection.tsx` where items are composed.

### 5.6 Animation Behavior

No new animations needed. The existing `StatusLine` animation system handles all toggle effects:

- **Item toggled on:** Fades in with existing `ITEM_TRANSITION` (200ms, opacity 0.8→1, scale 0.8→1, blur 4px→0)
- **Item toggled off:** Fades out with reverse transition; separator exits with item
- **Layout reflow:** Motion's `layout` prop on remaining items animates them to fill the gap

The popover/sheet open/close animations are provided by shadcn's Radix primitives.

## 6. Refactoring

### 6.1 ChatStatusSection Refactor

`ChatStatusSection.tsx` currently hardcodes each `StatusLine.Item` individually (~100 lines of JSX). This will be refactored to:

1. Import the item registry
2. Map over registry entries to render `StatusLine.Item` + `ContextMenu` for each
3. A render function per item key maps to the correct item component (e.g., `'cwd'` → `<CwdItem>`)

The item components (`CwdItem`, `GitStatusItem`, etc.) remain unchanged — only the composition layer changes.

### 6.2 Settings Dialog Status Bar Tab

The Status Bar tab in `SettingsDialog.tsx` will be refactored to iterate the same registry, rendering a `SettingRow` + `Switch` per entry. This eliminates the current 10 hardcoded `SettingRow` blocks and ensures the Settings dialog and popover always show the same items with the same labels and descriptions.

### 6.3 Zustand Store

No changes to the Zustand store. The existing `showStatusBar*` / `setShowStatusBar*` properties and localStorage persistence remain as-is. The registry maps item keys to store property names via convention (`key` → `showStatusBar{PascalCase(key)}`).

A helper function bridges the registry key to the store:

```ts
function useStatusBarVisibility(key: StatusBarItemKey): [boolean, (value: boolean) => void] {
  // Maps 'cwd' → useAppStore(s => s.showStatusBarCwd), useAppStore(s => s.setShowStatusBarCwd)
  // The key parameter is constrained to StatusBarItemKey — typos fail at compile time.
}
```

A new `resetStatusBarPreferences()` function iterates the registry and resets each item's visibility to its `defaultVisible` value. This replaces the global `resetPreferences()` for status-bar-specific resets.

## 7. File Changes

| File                                                               | Change                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **New:** `layers/features/status/model/status-bar-registry.ts`     | Item registry array + types + group labels                                 |
| **New:** `layers/features/status/ui/StatusBarConfigurePopover.tsx` | Popover/Sheet with grouped toggle list                                     |
| **Modified:** `layers/features/chat/ui/ChatStatusSection.tsx`      | Add configure icon, context menus, iterate registry                        |
| **Modified:** `layers/features/settings/ui/SettingsDialog.tsx`     | Refactor Status Bar tab to use registry                                    |
| **Modified:** `layers/features/status/index.ts`                    | Export new components and registry                                         |
| **New:** `layers/features/status/ui/StatusBarConfigureContent.tsx` | Shared toggle list content rendered by both Popover and Sheet              |
| **New:** `layers/shared/ui/responsive-popover.tsx`                 | Popover↔Sheet responsive wrapper (follows `responsive-dialog.tsx` pattern) |

## 8. Accessibility

- **Configure icon:** `aria-label="Configure status bar"`, `role="button"`
- **Popover:** `aria-label="Status bar configuration"`, focus trapped while open
- **Toggle switches:** Already accessible via `SettingRow` + `Switch` (Radix primitives with proper ARIA)
- **Context menu:** shadcn `ContextMenu` provides `role="menu"`, `role="menuitem"`, keyboard navigation (arrow keys, Enter/Space to activate, Escape to close)
- **Keyboard access to context menu:** Users can press Shift+F10 or the context menu key when a status bar item is focused
- **Group headers:** Rendered as visual labels only (not interactive), with `role="separator"` or `aria-hidden` as appropriate

## 9. Prerequisites

- **Install shadcn `ContextMenu`**: The client codebase does not currently use `ContextMenu`. Run `npx shadcn@latest add context-menu` before implementation.
- **Verify `Popover` is installed**: Should already be present (used elsewhere), but confirm.

## 10. Testing

- **Unit tests:** `StatusBarConfigurePopover` renders all registry items with correct labels and descriptions
- **Unit tests:** Toggling a switch in the popover updates the Zustand store
- **Unit tests:** Right-click context menu renders correct item label in "Hide [label]"
- **Unit tests:** Registry-driven `ChatStatusSection` renders the same items as before
- **Unit tests:** Settings dialog Status Bar tab still renders all toggles correctly after refactor
- **Unit tests:** All registry keys have corresponding `showStatusBar*` store properties (type-safety backstop)
- **Unit tests:** `resetStatusBarPreferences()` resets only status bar toggles, not other preferences
- **Integration consideration:** The popover and Settings dialog should show identical toggle states (verified by sharing the same store)

## 11. Embedded Mode (Obsidian)

The Obsidian plugin renders `<ChatPanel>` directly, bypassing the router. If the status bar is present in embedded mode, the configure popover will also appear. This is acceptable — Obsidian users benefit from the same inline management. No special handling needed.

## 12. Risks and Mitigations

| Risk                                                     | Mitigation                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Popover too tall on small screens                        | `max-h-[70vh] overflow-y-auto` + Sheet on mobile                                                                |
| Right-click conflicts with browser context menu          | shadcn `ContextMenu` handles this correctly — it prevents the browser menu                                      |
| Registry key → store property mapping is fragile         | Helper function with TypeScript type safety; tests verify all registry keys have corresponding store properties |
| Refactoring ChatStatusSection could break item rendering | Each item component is unchanged; only the composition layer changes. Existing tests catch regressions.         |
