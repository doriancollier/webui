---
slug: sidebar-upgrade-notification
number: 179
created: 2026-03-24
status: specified
---

# Sidebar Upgrade Notification

## Status

Specified

## Authors

Claude Code — 2026-03-24

## Overview

Move the version display and "upgrade available" notification from the status bar into the sidebar footer. The current `VersionItem` status bar component and its `showStatusBarVersion` setting are removed entirely. A new version row appears below the sidebar footer bar, with an expandable upgrade card above it when updates are available.

This follows the Arc Browser collapsed-pill pattern adapted with Raycast's urgency tiering — version always visible, upgrade card appears only when relevant, two urgency tiers distinguish patches from feature releases.

## Background / Problem Statement

The version indicator currently lives in the status bar alongside 12+ other items, where it competes for attention and often gets hidden via the configure popover. The status bar is not the natural location for version information — users expect it in the sidebar footer, matching the pattern established by Arc Browser, VS Code, Raycast, and Linear.

Moving to the sidebar provides:

- **Permanent visibility** — always present regardless of status bar configuration
- **Natural information hierarchy** — version is metadata about the app, not about the current session
- **Reduced status bar clutter** — one fewer item in an already crowded bar
- **Better upgrade discoverability** — sidebar footer is seen on every navigation, status bar items can be hidden

## Goals

- Display current version in a subtle, always-visible row at the bottom of every sidebar
- Show an expandable upgrade card above the footer when a new version is available
- Differentiate patch updates (subtle) from feature/major updates (prominent)
- Remove all traces of version display from the status bar, including the `showStatusBarVersion` toggle
- Preserve the existing dismiss-per-version persistence mechanism unchanged

## Non-Goals

- Auto-update functionality
- Changelog rendering inside the upgrade card
- Changes to the npm registry check logic (`update-checker.ts`)
- Changes to the server config endpoint or `dismissedUpgradeVersions` persistence
- Changes to the Settings > Server tab version display (that stays as-is — it serves a different purpose)

## Technical Dependencies

- `motion` (framer-motion) — already in use, for card expand/collapse animation
- `lucide-react` — already in use, for ArrowUp and other icons
- TanStack Query — already in use, for `useQuery('config')` data fetching
- `version-compare.ts` utilities from `features/status/lib/` — reused as-is

No new external dependencies required.

## Detailed Design

### Architecture

The change is a **move + simplify** — relocating version display from the status bar feature to the session-list feature, and from a compound StatusLine system to a direct sidebar integration.

```
BEFORE:
  ChatStatusSection → useQuery('config') → VersionItem (in StatusLine)
  AppStore: showStatusBarVersion
  StatusBarRegistry: 'version' entry

AFTER:
  SidebarFooterBar → useQuery('config') → version row + SidebarUpgradeCard
  (no app store setting, no registry entry)
```

### FSD Layer Compliance

`SidebarFooterBar` lives in `features/session-list/ui/`. The `version-compare.ts` utilities live in `features/status/lib/`. Per FSD rules (`.claude/rules/fsd-layers.md`), UI composition across features at the same layer is allowed. Importing pure `lib/` utilities from a sibling feature is acceptable — these are stateless functions with no business logic coupling.

Import path: `import { isNewer, isFeatureUpdate } from '@/layers/features/status'`

### New Components

#### 1. Version Row (inline in SidebarFooterBar)

Added directly below the existing footer bar content. Not a separate component — just a new `<div>` row.

```
┌─────────────────────────────┐
│  [DorkLogo]    ✏️ ⚙️ 🌙     │  ← existing footer bar
│─────────────────────────────│
│           v1.2.3            │  ← new version row
└─────────────────────────────┘
```

**Rendering logic:**

| Condition                           | Renders                                          |
| ----------------------------------- | ------------------------------------------------ |
| `isDevMode`                         | Amber `DEV` text, no version number              |
| No update available                 | Plain `v{version}` in muted text                 |
| Patch update available              | `v{version}` with muted dot indicator, clickable |
| Feature/major update, not dismissed | `v{version}` with amber dot indicator            |

**Styling:**

- `text-xs text-muted-foreground text-center py-1`
- Dot indicator: `size-1.5 rounded-full` — muted for patch, amber for feature
- Dev badge: `text-xs font-medium text-amber-600 dark:text-amber-400`

#### 2. SidebarUpgradeCard (new component)

A self-contained card component rendered above the footer bar when an upgrade is available and not dismissed.

**File:** `apps/client/src/layers/features/session-list/ui/SidebarUpgradeCard.tsx`

**Props:**

```typescript
interface SidebarUpgradeCardProps {
  currentVersion: string;
  latestVersion: string;
  isFeature: boolean;
  onDismiss: (version: string) => void;
}
```

**Layout:**

```
┌─────────────────────────────┐
│ ┌─────────────────────────┐ │
│ │ ↑ v1.2.3 → v1.4.0    ✕ │ │
│ │ New features available   │ │
│ │                          │ │
│ │ [Copy command] [What's…] │ │
│ └─────────────────────────┘ │
│─────────────────────────────│
│  [DorkLogo]    ✏️ ⚙️ 🌙     │
│           v1.2.3            │
└─────────────────────────────┘
```

**Card contents:**

- Header row: ArrowUp icon + version delta (`v1.2.3 → v1.4.0`) + dismiss X button
- Description: "New features available" (feature) or "Patch update available" (patch)
- Action row:
  - Copy button: copies `npm update -g dorkos` to clipboard, shows check icon briefly
  - "What's new" link: opens `https://github.com/dorkos/dorkos/releases` in new tab (feature updates only)

**Styling:**

- `mx-2 mb-1 rounded-md border p-3`
- Feature update: `border-amber-500/20 bg-amber-500/5`
- Patch update: `border-border bg-muted/50`
- Animate mount/unmount with `motion`: slide up from bottom, fade in, 200ms

**Auto-show behavior:**

- Feature/major updates: card auto-expands on first render (not dismissed)
- Patch updates: card does NOT auto-expand. Only appears when user clicks the version text dot

### Data Fetching

`SidebarFooterBar` gains a `useQuery('config')` call. Since `ChatStatusSection` already uses the same query key, TanStack Query deduplicates — no additional network requests.

```typescript
const { data: serverConfig } = useQuery({
  queryKey: ['config'],
  queryFn: () => transport.getConfig(),
  staleTime: 5 * 60 * 1000,
});
```

The dismiss callback reuses the same pattern from `ChatStatusSection`:

```typescript
const handleDismissVersion = useCallback(
  async (version: string) => {
    const current = serverConfig?.dismissedUpgradeVersions ?? [];
    await transport.updateConfig({ ui: { dismissedUpgradeVersions: [...current, version] } });
    queryClient.invalidateQueries({ queryKey: ['config'] });
  },
  [serverConfig?.dismissedUpgradeVersions, transport, queryClient]
);
```

### Patch Update Click-to-Expand

For patch updates, the card is hidden by default. A local `useState<boolean>(false)` in `SidebarFooterBar` tracks whether the user has clicked the version row to reveal the card. Clicking the version text (which shows a dot indicator) toggles this state. This is ephemeral — refreshing the page resets it, which is fine for patches.

For feature updates, the card is shown by default (auto-expand) unless dismissed.

### Removals

#### A. Delete VersionItem component

- Delete `apps/client/src/layers/features/status/ui/VersionItem.tsx` (183 lines)
- Delete `apps/client/src/layers/features/status/ui/__tests__/VersionItem.test.tsx`

#### B. Remove from ChatStatusSection

In `apps/client/src/layers/features/chat/ui/ChatStatusSection.tsx`:

- Remove `showStatusBarVersion` and `setShowStatusBarVersion` from `useAppStore()` destructuring (line ~140)
- Remove `dismissedVersions` memo (lines 158-161)
- Remove `handleDismissVersion` callback (lines 163-170)
- Remove the `<StatusLine.Item itemKey="version">` block (lines 353-373)
- Remove `VersionItem` import

**Note:** Keep the `useQuery('config')` — it's used by other status bar items too.

#### C. Remove from status/index.ts

Remove `VersionItem` export. Keep `isNewer`, `isFeatureUpdate` exports (still used).

#### D. Remove from status-bar-registry.ts

Remove the `{ key: 'version', label: 'Version', ... }` entry from `STATUS_BAR_REGISTRY` array. This automatically removes it from `StatusBarConfigureContent` and `StatusBarConfigurePopover` since they render from the registry.

#### E. Remove showStatusBarVersion from app store

In `apps/client/src/layers/shared/model/app-store.ts`:

- Remove `showStatusBarVersion: boolean` from state type (line ~127)
- Remove `setShowStatusBarVersion: (v: boolean) => void` from actions (line ~128)
- Remove initial value and setter implementation

#### F. Remove from useStatusBarVisibility hook

The `useStatusBarVisibility` hook in `status-bar-registry.ts` maps registry keys to app store visibility flags. Remove the 'version' mapping.

### Files Changed Summary

| Action     | File                                                    | Lines affected                                                 |
| ---------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| **Modify** | `session-list/ui/SidebarFooterBar.tsx`                  | Add ~60 lines (version row + data fetching + card integration) |
| **Modify** | `chat/ui/ChatStatusSection.tsx`                         | Remove ~30 lines (version item block + dismiss handler)        |
| **Modify** | `status/index.ts`                                       | Remove 1 export line                                           |
| **Modify** | `status/model/status-bar-registry.ts`                   | Remove 1 registry entry + 1 visibility mapping                 |
| **Modify** | `shared/model/app-store.ts`                             | Remove 2 state fields + setter                                 |
| **Create** | `session-list/ui/SidebarUpgradeCard.tsx`                | ~100 lines                                                     |
| **Create** | `session-list/ui/__tests__/SidebarUpgradeCard.test.tsx` | ~150 lines                                                     |
| **Modify** | `session-list/__tests__/SidebarFooterBar.test.tsx`      | Add ~80 lines (version display tests)                          |
| **Delete** | `status/ui/VersionItem.tsx`                             | -183 lines                                                     |
| **Delete** | `status/ui/__tests__/VersionItem.test.tsx`              | -247 lines                                                     |
| **Modify** | `chat/__tests__/ChatStatusSection-configure.test.tsx`   | Remove version references                                      |
| **Modify** | `chat/__tests__/ChatPanel.test.tsx`                     | Remove VersionItem vi.mock                                     |
| **Modify** | `status/__tests__/StatusBarConfigureContent.test.tsx`   | Remove version toggle expectations                             |
| **Modify** | `status/__tests__/status-bar-registry.test.ts`          | Remove version registry tests                                  |
| **Modify** | `status/__tests__/status-bar-integration.test.tsx`      | Remove version references                                      |

**Net:** ~290 lines added, ~480 lines removed. Net reduction of ~190 lines.

## User Experience

### Normal State (no update)

Sidebar footer shows the existing logo + icon bar, with a new line below:

```
  [DorkLogo]    ✏️ ⚙️ 🌙
           v1.2.3
```

Version text is very subtle — `text-xs text-muted-foreground`. Not interactive. Fades into the background like a watermark.

### Dev Mode

```
  [DorkLogo]    ✏️ ⚙️ 🌙
             DEV
```

Amber text, no version number. No upgrade checking or card ever appears.

### Patch Update Available (e.g., 1.2.3 → 1.2.4)

```
  [DorkLogo]    ✏️ ⚙️ 🌙
         v1.2.3  •
```

Small muted dot appears next to version. Clicking the version row toggles the upgrade card open/closed. Card uses muted styling — no amber.

### Feature/Major Update Available (e.g., 1.2.3 → 1.4.0)

Card auto-expands on load:

```
  ┌─────────────────────────┐
  │ ↑ v1.2.3 → v1.4.0    ✕ │
  │ New features available   │
  │ [📋 Copy cmd] [What's…] │
  └─────────────────────────┘
  [DorkLogo]    ✏️ ⚙️ 🌙
         v1.2.3  •
```

Amber dot on version text. Card has amber-tinted border and background. "What's new" link visible.

### After Dismiss

Card collapses and never reappears for that version. Version text returns to plain `v1.2.3` (no dot). If a newer version is released later, the cycle restarts.

## Testing Strategy

### Unit Tests: SidebarUpgradeCard

**File:** `session-list/ui/__tests__/SidebarUpgradeCard.test.tsx`

| Test                                               | Purpose                                            |
| -------------------------------------------------- | -------------------------------------------------- |
| Renders version delta correctly                    | Verifies `v{current} → v{latest}` text             |
| Shows "New features available" for feature updates | Correct description per tier                       |
| Shows "Patch update available" for patch updates   | Correct description per tier                       |
| Copy button copies update command                  | Verifies clipboard write of `npm update -g dorkos` |
| Copy button shows check icon after click           | Visual feedback for successful copy                |
| "What's new" link visible for feature updates      | Opens GitHub releases in new tab                   |
| "What's new" link hidden for patch updates         | No link for patches                                |
| Dismiss button calls onDismiss with version        | Verifies callback invocation                       |
| Feature card has amber styling                     | Verifies amber border/bg classes                   |
| Patch card has muted styling                       | Verifies muted border/bg classes                   |
| Card animates on mount                             | Verifies motion wrapper presence                   |

### Unit Tests: SidebarFooterBar (additions)

**File:** `session-list/__tests__/SidebarFooterBar.test.tsx` (extend existing)

| Test                                           | Purpose                                    |
| ---------------------------------------------- | ------------------------------------------ |
| Shows version text when config loaded          | Verifies `v{version}` renders              |
| Shows DEV badge in dev mode                    | Verifies amber DEV text, no version number |
| Shows no upgrade card when no update available | Verifies card not in DOM                   |
| Shows upgrade card for feature update          | Verifies auto-expand behavior              |
| Does not auto-show card for patch update       | Verifies card hidden until click           |
| Shows dot indicator for patch update           | Verifies muted dot on version row          |
| Shows amber dot for feature update             | Verifies amber dot on version row          |
| Clicking version row toggles patch card        | Verifies click-to-expand for patches       |
| Dismiss hides card and calls updateConfig      | Verifies persistence of dismiss            |
| Does not show card for dismissed version       | Verifies dismissedVersions check           |

### Test Updates (removals)

- `ChatStatusSection-configure.test.tsx` — Remove `showStatusBarVersion` references
- `ChatPanel.test.tsx` — Remove `vi.mock` for VersionItem
- `StatusBarConfigureContent.test.tsx` — Remove version toggle expectations, update item count assertions
- `status-bar-registry.test.ts` — Remove version entry tests, update registry size assertions
- `status-bar-integration.test.tsx` — Remove version visibility references

### Mocking Strategy

Tests for `SidebarFooterBar` and `SidebarUpgradeCard` use:

- `createMockTransport()` from `@dorkos/test-utils` wrapped in `TransportProvider`
- `QueryClientProvider` with a test `QueryClient`
- Mock `navigator.clipboard.writeText` for copy tests
- Mock `window.open` for "What's new" link tests

## Performance Considerations

- **No additional API calls** — `useQuery('config')` with the same query key is deduplicated by TanStack Query
- **No additional re-renders** — the sidebar footer only re-renders when config changes (5-minute stale time)
- **Net code reduction** — ~190 fewer lines total
- **Smaller status bar** — one fewer item to render and animate in the StatusLine

## Security Considerations

No security implications. The version check already happens server-side via `update-checker.ts`. No new external requests. The clipboard write for copy-command uses the standard Clipboard API.

## Documentation

- No external documentation changes needed
- `contributing/` guides do not reference VersionItem specifically
- The research documents (`research/20260227_*.md`, `research/20260310_*.md`) remain as historical context

## Implementation Phases

### Phase 1: Build new sidebar version UI

1. Create `SidebarUpgradeCard.tsx` component with tests
2. Add version row and upgrade card integration to `SidebarFooterBar.tsx`
3. Add data fetching (`useQuery('config')`) and dismiss handler to `SidebarFooterBar`
4. Add tests for new version display behavior in `SidebarFooterBar.test.tsx`

### Phase 2: Remove status bar version

1. Remove `VersionItem` rendering from `ChatStatusSection.tsx`
2. Remove `showStatusBarVersion` from `app-store.ts`
3. Remove 'version' entry from `status-bar-registry.ts`
4. Remove `VersionItem` export from `status/index.ts`
5. Delete `VersionItem.tsx` and `VersionItem.test.tsx`
6. Update all affected test files (remove mocks, update assertions)

### Phase 3: Verify

1. Run full test suite — `pnpm test -- --run`
2. Run type check — `pnpm typecheck`
3. Run lint — `pnpm lint`
4. Visual verification in dev mode (all three sidebars: dashboard, session, agents)

## Open Questions

None — all decisions resolved during ideation.

## Related ADRs

No existing ADRs directly related to version display or sidebar footer. This spec may produce a draft ADR about "version display lives in sidebar, not status bar" as a design decision.

## References

- Ideation document: `specs/sidebar-upgrade-notification/01-ideation.md`
- Research: `research/20260227_update_notification_ux_patterns.md`
- Research: `research/20260310_dev_version_display_upgrade_ux.md`
- Current VersionItem: `apps/client/src/layers/features/status/ui/VersionItem.tsx`
- FSD layer rules: `.claude/rules/fsd-layers.md`
- Design system: `contributing/design-system.md`
