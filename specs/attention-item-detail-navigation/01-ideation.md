---
slug: attention-item-detail-navigation
number: 149
created: 2026-03-20
status: ideation
---

# Attention Item Detail Navigation

**Slug:** attention-item-detail-navigation
**Author:** Claude Code
**Date:** 2026-03-20
**Branch:** preflight/attention-item-detail-navigation

---

## 1) Intent & Assumptions

- **Task brief:** The dashboard's "Needs Attention" section surfaces items requiring user action (dead Relay letters, failed Pulse runs, offline Mesh agents, stalled sessions). Each item has a "View" button, but clicking it currently only opens the generic subsystem panel — it doesn't navigate to or highlight the specific item. We need to implement proper detail navigation so each "View" action takes the user to see the specific item's details.

- **Assumptions:**
  - Stalled sessions already navigate correctly to `/session?session=<id>` — this behavior is correct and should be preserved
  - Non-session attention items (dead letters, failed runs, offline agents) need new dedicated Sheet components
  - TanStack Router search params on the `/` route will drive Sheet open state and item selection
  - Existing subsystem panels (Pulse/Relay/Mesh) remain untouched — Sheets are separate detail views
  - The Sheet components live in their respective feature modules (dashboard-attention or subsystem features)

- **Out of scope:**
  - Modifying existing subsystem panel internals
  - Adding new server API endpoints (all data is already available client-side)
  - Batch actions on attention items
  - Notification/alert system for new attention items

## 2) Pre-reading Log

- `apps/client/src/layers/features/dashboard-attention/model/use-attention-items.ts`: Core hook deriving attention items from 4 sources. Current actions open generic panels via Zustand (`setPulseOpen`, `setRelayOpen`, `setMeshOpen`). Stalled sessions navigate to `/session`.
- `apps/client/src/layers/features/dashboard-attention/ui/AttentionItem.tsx`: Renders each attention row with icon, description, timestamp, and action button. Action is `item.action()` callback.
- `apps/client/src/layers/features/dashboard-attention/ui/NeedsAttentionSection.tsx`: Conditional section with AnimatePresence, zero DOM when empty.
- `apps/client/src/layers/shared/model/app-store.ts`: Zustand store with `pulseOpen`, `relayOpen`, `meshOpen` booleans and `pulseEditScheduleId` (Pulse already has per-item detail state pattern).
- `apps/client/src/router.tsx`: TanStack Router with 3 routes (`/`, `/session`, `/agents`). Dashboard route currently has no search params.
- `apps/client/src/layers/features/dashboard-status/ui/SystemStatusRow.tsx`: Subsystem cards with click handlers that open panels via Zustand.
- `apps/client/src/layers/entities/mesh/`: Has `AgentHealthDetail` component and `useMeshStatus()` hook with agent-level data.
- `apps/client/src/layers/entities/relay/`: Has `useAggregatedDeadLetters()` returning dead letter data. No detail component exists.
- `apps/client/src/layers/entities/pulse/`: Has `useRuns()` returning run history with error details. `pulseEditScheduleId` pattern exists for detail navigation.

## 3) Codebase Map

- **Primary components/modules:**
  - `apps/client/src/layers/features/dashboard-attention/model/use-attention-items.ts` — Attention item derivation and action handlers (MODIFY)
  - `apps/client/src/layers/features/dashboard-attention/ui/AttentionItem.tsx` — Attention row UI (MINOR MODIFY)
  - `apps/client/src/layers/features/dashboard-attention/ui/NeedsAttentionSection.tsx` — Section wrapper (MINOR MODIFY)
  - `apps/client/src/router.tsx` — Route definitions, add search params to dashboard route (MODIFY)

- **New components needed:**
  - Dead letter detail Sheet (new file in dashboard-attention or entity layer)
  - Failed run detail Sheet (new file)
  - Offline agent detail Sheet (new file)

- **Shared dependencies:**
  - `@/layers/shared/ui` — Sheet, ScrollArea, Badge, Button components
  - `@/layers/shared/model/app-store.ts` — Zustand panel state (may need extension or replacement with search params)
  - `@tanstack/react-router` — `useSearch`, `useNavigate`, route search schema

- **Data flow:**
  - Attention item click → `navigate({ search: { panel: 'dead-letter', itemId: 'abc' } })` → search params update → Sheet reads params → renders detail view
  - Back button / Sheet close → clear search params → Sheet unmounts

- **Feature flags/config:** None — all subsystem feature flags already handled by `use-attention-items.ts`

- **Potential blast radius:**
  - Direct: 4-5 files modified, 3 new Sheet components
  - Indirect: Router search schema change affects dashboard route typing
  - Tests: New tests for Sheet components, update attention hook tests for navigation

## 4) Root Cause Analysis

- **Observed:** Clicking "View" on a dead letter attention item opens the Relay panel generically. No specific item is highlighted or shown.
- **Expected:** Clicking "View" should show the specific dead letter's details — sender, content, error reason, retry action.
- **Root cause:** `use-attention-items.ts` action handlers only call `setRelayOpen(true)` / `setPulseOpen(true)` / `setMeshOpen(true)` — they don't pass any item identifier. The subsystem panels have no concept of "focus on this specific item."
- **Decision:** Rather than modifying existing panels to accept a focus item, create new dedicated Sheet components for each attention item type. This keeps the panels clean and gives attention items purpose-built detail views.

## 5) Research

- **Potential solutions:**
  1. **Search-param-driven Sheets (recommended)**
     - Description: Add search params to the dashboard route (`?panel=dead-letter&itemId=abc`). Sheet components read params and render detail views. Deep-linkable, back-button friendly.
     - Pros: Follows existing `?session=` pattern, shareable URLs, browser history integration, SSR-friendly
     - Cons: Slightly more setup than Zustand state
     - Complexity: Medium
     - Maintenance: Low

  2. **Zustand state extension**
     - Description: Add `focusItemId` fields to existing panel state in app-store. Panels/Sheets read the ID to show detail.
     - Pros: Simpler initial implementation, follows existing `pulseEditScheduleId` pattern
     - Cons: Not deep-linkable, no back-button support, state lost on refresh
     - Complexity: Low
     - Maintenance: Medium

  3. **In-panel focus with scroll-to**
     - Description: Open existing panels and scroll to the specific item, highlighting it.
     - Pros: No new components, reuses existing panels
     - Cons: Panels may not have granular enough views, requires modifying panel internals, panels weren't designed for "focus on item X"
     - Complexity: High (requires panel refactoring)
     - Maintenance: High

  4. **Inline expansion**
     - Description: Expand attention items in-place within the dashboard section.
     - Pros: No navigation, stays in context
     - Cons: Limited space for complex details, clutters the attention section
     - Complexity: Low
     - Maintenance: Low

- **Recommendation:** Solution 1 — Search-param-driven Sheets. Follows TanStack Router conventions already used on `/session` route, provides deep-linkable URLs, and keeps attention detail views purpose-built without modifying existing panels.

## 6) Decisions

| #   | Decision                               | Choice                              | Rationale                                                                                                                                                   |
| --- | -------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | State management for detail navigation | TanStack Router search params       | Deep-linkable, back-button support, follows existing `?session=` and `?dir=` patterns. Consistent with TanStack Router adoption.                            |
| 2   | Stalled session "View" behavior        | Navigate to /session (keep current) | Already implemented and working. User lands directly in the chat to address the stall — most actionable UX.                                                 |
| 3   | Non-session item detail rendering      | New dedicated Sheet per item type   | Purpose-built detail views for dead letters, failed runs, and offline agents. Richer than in-panel focus, more maintainable than modifying existing panels. |
