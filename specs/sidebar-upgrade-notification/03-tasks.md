# Sidebar Upgrade Notification — Task Breakdown

Generated: 2026-03-24 | Spec: `specs/sidebar-upgrade-notification/02-specification.md`

## Overview

Move the version display and "upgrade available" notification from the status bar into the sidebar footer. 5 tasks across 3 phases. Net reduction of ~190 lines.

---

## Phase 1: Build New Sidebar Version UI

### Task 1.1 — Create SidebarUpgradeCard component with tests

**Size:** Medium | **Priority:** High | **Dependencies:** None

Create `SidebarUpgradeCard.tsx` in `features/session-list/ui/`. Self-contained card component with two visual tiers (amber for feature updates, muted for patches). Shows version delta, copy-command button with clipboard feedback, "What's new" link (feature only), and dismiss button.

**Files:**

- **Create** `apps/client/src/layers/features/session-list/ui/SidebarUpgradeCard.tsx` (~100 lines)
- **Create** `apps/client/src/layers/features/session-list/ui/__tests__/SidebarUpgradeCard.test.tsx` (~150 lines)

**Tests:** 10 test cases covering both variants, copy/dismiss interactions, link visibility, and styling classes.

---

### Task 1.2 — Add version row and upgrade card integration to SidebarFooterBar

**Size:** Large | **Priority:** High | **Dependencies:** 1.1

Modify `SidebarFooterBar` to add `useQuery('config')` data fetching, compute upgrade state using `isNewer`/`isFeatureUpdate` from the status feature, render a version text row below the icon bar, and conditionally render `SidebarUpgradeCard` above the footer. Feature updates auto-expand; patch updates require clicking the version row.

**Files:**

- **Modify** `apps/client/src/layers/features/session-list/ui/SidebarFooterBar.tsx` (+~60 lines)
- **Modify** `apps/client/src/layers/features/session-list/__tests__/SidebarFooterBar.test.tsx` (+~80 lines)

**Tests:** 10 new test cases covering version display, DEV mode, dot indicators, click-to-expand for patches, auto-expand for features, dismiss persistence.

---

## Phase 2: Remove Status Bar Version

### Task 2.1 — Remove VersionItem from ChatStatusSection and delete VersionItem files

**Size:** Medium | **Priority:** High | **Dependencies:** 1.2 | **Parallel with:** 2.2

Remove all VersionItem rendering, dismiss handler, and dismissed versions memo from `ChatStatusSection`. Delete `VersionItem.tsx` and its test file. Remove the `VersionItem` export from `status/index.ts`. Update `ChatPanel.test.tsx` and `ChatStatusSection-configure.test.tsx`.

**Files:**

- **Delete** `apps/client/src/layers/features/status/ui/VersionItem.tsx` (-183 lines)
- **Delete** `apps/client/src/layers/features/status/ui/__tests__/VersionItem.test.tsx` (-247 lines)
- **Modify** `apps/client/src/layers/features/chat/ui/ChatStatusSection.tsx` (-~30 lines)
- **Modify** `apps/client/src/layers/features/status/index.ts` (-1 line)
- **Modify** `apps/client/src/layers/features/chat/__tests__/ChatPanel.test.tsx`
- **Modify** `apps/client/src/layers/features/chat/__tests__/ChatStatusSection-configure.test.tsx`

---

### Task 2.2 — Remove showStatusBarVersion from app store and status bar registry

**Size:** Medium | **Priority:** High | **Dependencies:** 1.2 | **Parallel with:** 2.1

Remove `showStatusBarVersion` boolean and setter from the Zustand app store. Remove the `'version'` entry from `STATUS_BAR_REGISTRY` and `StatusBarItemKey` union type. Remove `ArrowUpCircle` import. Update all affected test files with corrected item counts.

**Files:**

- **Modify** `apps/client/src/layers/shared/model/app-store.ts` (-~6 lines)
- **Modify** `apps/client/src/layers/features/status/model/status-bar-registry.ts` (-~3 lines)
- **Modify** `apps/client/src/layers/features/status/__tests__/StatusBarConfigureContent.test.tsx`
- **Modify** `apps/client/src/layers/features/status/__tests__/status-bar-registry.test.ts`
- **Modify** `apps/client/src/layers/features/status/__tests__/status-bar-integration.test.tsx`

---

## Phase 3: Verify

### Task 3.1 — Run full verification suite (tests, typecheck, lint)

**Size:** Small | **Priority:** High | **Dependencies:** 2.1, 2.2

Run `pnpm test -- --run`, `pnpm typecheck`, and `pnpm lint`. Verify zero failures/errors. Search for any remaining references to `VersionItem`, `showStatusBarVersion`, or `setShowStatusBarVersion` in source code.

---

## Dependency Graph

```
1.1 ──→ 1.2 ──→ 2.1 ──→ 3.1
                  2.2 ──↗
```

Tasks 2.1 and 2.2 can run in parallel after 1.2 completes. Task 3.1 runs after both 2.x tasks finish.
