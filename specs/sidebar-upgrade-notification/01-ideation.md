---
slug: sidebar-upgrade-notification
number: 179
created: 2026-03-24
status: ideation
---

# Sidebar Upgrade Notification

**Slug:** sidebar-upgrade-notification
**Author:** Claude Code
**Date:** 2026-03-24
**Branch:** preflight/sidebar-upgrade-notification

---

## 1) Intent & Assumptions

- **Task brief:** Move the version display and "upgrade available" notification from the status bar into the sidebar footer. Display the current version subtly below the footer bar, and show an expandable upgrade card above the footer when a new version is available — following patterns from Arc Browser, Raycast, and VS Code.
- **Assumptions:**
  - The sidebar footer (`SidebarFooterBar`) is the target location
  - The existing server-side version checking (`update-checker.ts`), config API, and dismiss persistence remain unchanged
  - The `VersionItem` component in the status bar will be removed entirely (not kept as a toggle)
  - Two urgency tiers (patch vs feature/major) using the existing `isFeatureUpdate()` utility
- **Out of scope:**
  - Auto-update functionality
  - Changelog rendering inside the sidebar card
  - Changes to the npm registry check logic or server-side `update-checker.ts`
  - Modifying how `dismissedUpgradeVersions` is persisted

## 2) Pre-reading Log

- `apps/client/src/layers/features/session-list/ui/SidebarFooterBar.tsx`: 78-line sidebar footer with logo link, settings button, theme toggle, devtools toggle. Currently receives no props — purely static UI. Will need version data.
- `apps/client/src/layers/features/status/ui/VersionItem.tsx`: 182-line popover component with two-tier upgrade indicators, copy-to-clipboard, dismiss logic, dev mode badge. To be removed.
- `apps/client/src/layers/features/status/lib/version-compare.ts`: 32 lines, pure utilities — `isNewer()` for semver comparison, `isFeatureUpdate()` for major/minor detection. Reusable, no changes needed.
- `apps/client/src/layers/features/chat/ui/ChatStatusSection.tsx`: 465-line status bar orchestrator. Lines ~328-370 manage VersionItem: fetches `serverConfig`, passes version/latestVersion/isDevMode/isDismissed props, handles dismiss callback. This integration code will be removed.
- `apps/client/src/layers/features/status/model/status-bar-registry.ts`: Registry mapping item keys to labels + visibility toggles. The 'version' entry will be removed.
- `apps/client/src/AppShell.tsx`: Root layout. Renders Shadcn `SidebarFooter` with hardcoded `<SidebarFooterBar />`. The footer structure may need to accommodate the upgrade card above it.
- `contributing/design-system.md`: 8pt grid, 16px card radius, calm tech design language, amber for brand/interaction, text-xs for small labels, muted-foreground for secondary text.
- `research/20260227_update_notification_ux_patterns.md`: Deep research on update notification UX across 10+ apps. Key finding: Arc Browser's collapsed-pill-at-sidebar-bottom model is the direct inspiration.
- `research/20260310_dev_version_display_upgrade_ux.md`: Research on dev version display patterns. Key finding: dev mode must suppress upgrade entirely — no registry fetch, no upgrade card, just a `[DEV]` badge.

## 3) Codebase Map

**Primary Components/Modules:**

- `apps/client/src/layers/features/session-list/ui/SidebarFooterBar.tsx` — Sidebar footer (logo, settings, theme, devtools). Target for version display.
- `apps/client/src/layers/features/status/ui/VersionItem.tsx` — Current status bar version component. To be deleted.
- `apps/client/src/layers/features/status/lib/version-compare.ts` — `isNewer()`, `isFeatureUpdate()`. Reusable, stays in place.
- `apps/client/src/layers/features/chat/ui/ChatStatusSection.tsx` — Status bar orchestrator. Version-related code (lines ~328-370) to be removed.
- `apps/client/src/layers/features/status/model/status-bar-registry.ts` — Registry with 'version' entry. Entry to be removed.
- `apps/client/src/layers/features/status/index.ts` — Barrel exports `VersionItem`. Export to be removed.

**Shared Dependencies:**

- `useTheme` hook (Zustand store) — already used in SidebarFooterBar
- `useAppStore` (Zustand) — stores `showStatusBarVersion` preference (to be removed)
- TanStack Query — `useQuery('config')` for server config fetching (to be added to sidebar)
- `TransportContext` — provides `transport.getConfig()` and `transport.updateConfig()`
- `motion` library — for card expand/collapse animation
- Shadcn UI — Popover (if needed), Button, Tooltip
- `cn()` utility — class merging

**Data Flow:**

```
SidebarFooterBar (or parent wrapper)
  → useQuery('config') fetches ServerConfig {version, latestVersion, isDevMode, dismissedUpgradeVersions}
  → version-compare.ts: isNewer(), isFeatureUpdate()
  → Renders: version text row (always) + upgrade card (conditionally)
  → Dismiss callback: transport.updateConfig({ui: {dismissedUpgradeVersions: [...]}})
  → TanStack Query invalidation refreshes UI
```

**Feature Flags/Config:**

- `dismissedUpgradeVersions` — persisted in server config (`~/.dork/config.json`), no changes
- `isDevMode` — server-determined (`IS_DEV_BUILD`), suppresses upgrade card entirely
- `showStatusBarVersion` — Zustand app store preference, to be removed (no longer needed)
- `STATUS_BAR_REGISTRY` — 'version' entry to be removed

**Potential Blast Radius:**

- **Direct (modify):** SidebarFooterBar.tsx, ChatStatusSection.tsx, status/index.ts, status-bar-registry.ts, app-store.ts (remove `showStatusBarVersion`), SettingsDialog.tsx (remove version toggle)
- **Direct (delete):** VersionItem.tsx, VersionItem.test.tsx
- **Direct (create):** SidebarUpgradeCard.tsx (new), SidebarUpgradeCard.test.tsx (new)
- **Indirect:** ChatStatusSection.test.tsx (remove version mocks), ChatPanel.test.tsx (remove VersionItem vi.mock), AppShell.tsx (may need structural change if card lives above SidebarFooter), SettingsDialog.test.tsx (remove version toggle expectations), StatusBarConfigureContent.tsx / StatusBarConfigurePopover.tsx (remove version row if present)
- **Tests to update:** SidebarFooterBar.test.tsx (add version display tests), ChatStatusSection tests (remove version expectations)

## 4) Root Cause Analysis

N/A — this is a feature move, not a bug fix.

## 5) Research

Research synthesized from two prior deep-research reports (58+ sources across 10+ applications):

**Pattern 1: Arc Browser — Collapsed pill at sidebar bottom (RECOMMENDED MODEL)**

- Version number lives at the very bottom of the sidebar in muted text
- When an update is available, the pill gains a subtle dot indicator
- Clicking expands a card with version delta and "Restart to Update" CTA
- Dismissed versions stay dismissed permanently
- Pros: Minimal footprint, respectful of sidebar space, progressive disclosure
- Cons: Easy to miss for infrequent users
- Complexity: Low | Maintenance: Low

**Pattern 2: VS Code — Badge on gear icon**

- Version is in the title bar / About dialog, not the sidebar
- Extension updates show badge counts on the Extensions icon
- App updates show a notification toast or badge on the gear icon
- Pros: Compact, uses existing icon real estate
- Cons: Less discoverable, requires icon affordance
- Complexity: Low | Maintenance: Low

**Pattern 3: Raycast — Tiered silent/announced updates**

- Patch updates install silently with no user notification
- Feature updates show a modal/banner on first launch post-update
- Changelog is rendered inline with rich formatting
- Pros: Zero noise for patches, celebration for features
- Cons: Requires rich changelog data, more complex
- Complexity: Medium | Maintenance: Medium

**Pattern 4: Slack — System tray notification**

- Sidebar has no version display
- Updates show as OS-level notification via system tray
- Desktop app auto-updates in background
- Pros: No sidebar real estate cost
- Cons: Requires Electron/system tray, not applicable to web apps
- Complexity: High | Maintenance: High

**Anti-patterns identified:**

1. Persistent, non-dismissible banners (naggy, breaks trust)
2. Modal dialogs blocking workflow for non-critical patches
3. False upgrade prompts in dev mode (0.0.0 always looks outdated)
4. Full-width colored banners (too aggressive for developer tools)
5. Auto-refreshing dismissed notifications on timer
6. Showing update prompts during active agent sessions
7. Requiring page reload to dismiss notification

**Recommendation:** Arc Browser's collapsed-pill model adapted with Raycast's urgency tiering. Version text at sidebar bottom (always visible, muted). Upgrade card expands above footer for feature/major updates. Patch updates show only a subtle dot on the version text — no card auto-expansion. Dev mode shows `[DEV]` badge and suppresses all upgrade logic.

## 6) Decisions

| #   | Decision                    | Choice                               | Rationale                                                                                                                                                                           |
| --- | --------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Version display location    | Below the footer bar, new subtle row | Keeps existing footer bar untouched. Dedicated space for version. Matches Arc Browser pattern.                                                                                      |
| 2   | Upgrade notification style  | Expandable card above footer         | Visible but not intrusive. Shows version delta, copy command, dismiss. Follows Arc/Raycast progressive disclosure.                                                                  |
| 3   | Urgency differentiation     | Two tiers (patch vs feature/major)   | Patch: muted dot, no auto-expand. Feature/major: amber dot, auto-show card. Reuses existing `isFeatureUpdate()` logic.                                                              |
| 4   | Status bar VersionItem fate | Remove entirely                      | Single source of truth in sidebar. Reduces status bar clutter (13+ items). Less code to maintain.                                                                                   |
| 5   | Status bar version setting  | Remove from all surfaces             | Delete `showStatusBarVersion` from Zustand app store, settings dialog toggle, status bar registry entry, and any configure popovers. No reason to keep a toggle for a removed item. |
