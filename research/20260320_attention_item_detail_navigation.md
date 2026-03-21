---
title: 'Attention Item Detail Navigation — Pattern Research for DorkOS Dashboard'
date: 2026-03-20
type: internal-architecture
status: active
tags:
  [
    dashboard,
    attention,
    navigation,
    detail-view,
    sheet,
    dialog,
    route,
    deep-link,
    tanstack-router,
    search-params,
    calm-technology,
  ]
feature_slug: attention-item-detail-navigation
searches_performed: 9
sources_count: 22
---

# Attention Item Detail Navigation — Pattern Research for DorkOS Dashboard

## Research Summary

This report investigates the best pattern for the "Needs Attention" section's "View" action buttons on the DorkOS dashboard. Each attention item (dead relay messages, stalled sessions, failed Pulse runs, offline agents) currently has a "View" button that opens a generic subsystem panel. The goal is to navigate users to the _specific_ item's details. Four patterns were evaluated: enhanced panels with deep-link state, Sheet/Dialog per item type, new detail routes, and inline expansion. The recommendation is **Sheet with search-param deep-link state** — the right panel slides in with item-specific detail content, the URL carries the item ID for bookmarking and back-button support, and no new routes are required for v1. This approach aligns with the Calm Tech design philosophy, the existing subsystem panel architecture, and TanStack Router's search params first-class treatment.

---

## Key Findings

### 1. The "View" Action Needs Item Specificity, Not Panel Specificity

The core problem is that opening the Relay panel when the user clicks "View" on a dead letter is too coarse — the panel shows all messages, not the specific dead letter they care about. The same is true for Pulse (opens the full schedule list, not the failed run) and Mesh (opens all agents, not the offline one).

Industry patterns from operations dashboards confirm this consistently: the alert-to-detail link should resolve to the **specific item in context**, not to the section that contains it. PagerDuty's "Click incident" behavior navigates to the incident detail page, not the incidents list. Datadog's monitor alert links open the specific monitor detail view. Grafana alert links deep-link to the specific firing alert rule.

The coarse "open the panel" behavior is an anti-pattern in monitoring UIs. It is the dashboard equivalent of "take me to the library" when the user asked to be taken to the specific book.

### 2. Three Viable Patterns — One Clearly Wins for v1

#### Pattern A: Enhanced Panels with Deep-Link State (Recommended for v1)

The existing subsystem panels (Relay, Pulse, Mesh, Session) open as slide-over Sheets. The "View" button passes an `itemId` (and optionally `itemType`) via TanStack Router search params. The panel opens and scrolls to / highlights the specific item.

```
Dashboard → click "View" on dead letter #abc →
URL: /?relay=dead-letter&itemId=abc
Relay panel opens, scrolled to / highlighting dead letter abc
```

**Pros:**

- No new routes, no new components at the page level
- Search params carry the deep-link state: shareable URLs, back-button support
- TanStack Router search params support exactly this — `navigate({ to: '.', search: (prev) => ({ ...prev, relay: 'dead-letter', itemId: 'abc' }) })`
- Closing the Sheet clears the search params (navigate with `undefined`)
- Consistent with existing panel architecture
- Calm Tech aligned: same visual container (panel), new content specificity

**Cons:**

- Panel must be updated to accept and act on the incoming `itemId` prop
- Scroll-to / highlight logic required inside each panel
- Cannot be bookmarked as a standalone URL (it's `/?relay=dead-letter&itemId=abc`, not `/relay/dead-letter/abc`)

#### Pattern B: Item-Type-Specific Sheet/Dialog

A dedicated Sheet or Dialog component per attention item type is rendered from the dashboard layer, triggered by the "View" button. The Sheet renders item-specific detail content (not the full panel).

```
Dashboard → click "View" on dead letter →
<RelayDeadLetterSheet itemId="abc" /> opens over the dashboard
```

**Pros:**

- Complete control over detail view content per item type
- No dependency on existing subsystem panels
- Sharper, more focused UI: shows only what matters for the specific item type

**Cons:**

- Duplicates rendering logic that already exists in subsystem panels
- Higher implementation cost (4 new Sheet components, one per attention item type)
- Sheet state managed in dashboard layer — harder to deep-link without search params anyway
- FSD: new components in `widgets/dashboard/` or `features/dashboard-attention/` — not wrong, but more surface area

**When this pattern is correct:** When the subsystem panels are too heavy for the detail use case, or when the detail view for attention items diverges substantially from the panel's general view. For DorkOS v1, the existing panels are not too heavy — this pattern is deferred to v2 if needed.

#### Pattern C: New Detail Routes

Add routes like `/relay/dead-letters/:id`, `/pulse/runs/:id`, `/mesh/agents/:id`, `/session` (already exists).

```
Dashboard → click "View" on dead letter →
Navigate to /relay/dead-letters/abc
Full page view of dead letter detail
```

**Pros:**

- Cleanest URL semantics — truly addressable resources
- Natural fit for "open in new tab" and external linking
- Browser history is clean (Back returns to dashboard)

**Cons:**

- DorkOS currently has 2 routes; adding 4-6 detail routes is a significant architectural expansion
- Requires new page-level components for each route (RelayDeadLetterPage, PulseRunPage, etc.)
- Users lose context of the dashboard — they navigate away entirely
- For a "quick action" flow (the user wants to handle the issue and return to the dashboard), full-page routes create unnecessary navigation overhead
- FSD: new page-level widgets per subsystem — substantial scope for v1

**When this pattern is correct:** When the item detail is rich enough to justify a full page (similar to GitHub issue detail, Jira ticket detail). For DorkOS attention items — dead letters, stalled sessions, failed runs, offline agents — the detail is typically: what happened, why, and one action button. Full pages are overkill for v1.

#### Pattern D: Inline Expansion

The attention item row expands in place to show detail content.

```
Dashboard → click "View" on dead letter →
Row expands with: message content, error reason, retry button
```

**Pros:**

- Least disruptive — no navigation, no overlay
- User stays oriented on the dashboard

**Cons:**

- Severely limited vertical space — attention item rows are already compact
- Cannot show enough content for meaningful detail (session transcripts, relay message payloads, Pulse log output)
- Accordion/expand behavior is unexpected for a "View" button (user expects to see more than the row can offer)
- Does not solve deep-linking or shareability

**Verdict:** Viable only for very simple detail (e.g., showing an error message inline). Not sufficient for Relay dead letters (need message payload + retry action), Pulse failures (need log output + re-run action), or stalled sessions (need context of waiting state).

### 3. TanStack Router Search Params Are Purpose-Built for This Pattern

TanStack Router treats search params as first-class typed state — not as stringly-typed URL query strings. This makes Pattern A implementation robust:

```typescript
// Route definition at /
const dashboardRoute = createRoute({
  validateSearch: (search) =>
    z
      .object({
        relay: z.enum(['dead-letter', 'messages']).optional(),
        pulse: z.enum(['run', 'schedule']).optional(),
        mesh: z.enum(['agent']).optional(),
        itemId: z.string().optional(),
      })
      .parse(search),
});

// Opening the dead letter detail panel
navigate({
  to: '.',
  search: (prev) => ({ ...prev, relay: 'dead-letter', itemId: letter.id }),
});

// Closing the panel
navigate({
  to: '.',
  search: (prev) => ({ ...prev, relay: undefined, itemId: undefined }),
});
```

This pattern:

- Is type-safe — `relay` and `itemId` are validated, not raw strings
- Survives page refresh (the panel reopens to the correct item)
- Works with the browser back button (closing the Sheet is a back-navigation)
- Is shareable — the URL `/?relay=dead-letter&itemId=abc` opens the panel to the specific item
- Does not require new routes

The TanStack Router docs confirm this is idiomatic: "Controlling modal/sheet visibility through search params enables deep linking and natural back-button behavior. Remove params to close overlays."

### 4. Sheet vs Dialog for Item Detail — Sheet Wins

For attention item detail views, **Sheet** (slide-over panel) is correct over **Dialog** (centered modal) because:

- Detail views require scrollable content (log output, message payloads) — Sheets handle this naturally; Dialogs are sized for focused decisions, not scrollable detail
- Sheets preserve dashboard context visually — the dashboard is still partially visible behind the panel, giving users orientation
- Dialogs interrupt and demand resolution — appropriate for "Approve / Deny" decisions, not for "view a stalled session's context"
- Existing subsystem panels are already Sheets — visual consistency is maintained

**Exception:** Tool approval requests are the one case where **Dialog** is correct. A tool approval is a binary decision (Approve / Deny) requiring focused attention. This maps to the PatternFly guidance: "Do not use the notification drawer as the sole place to notify users about events requiring immediate action. In these cases, a modal dialog is the preferred choice."

Summary of component choice by attention item type:

| Attention Item Type                                                 | Component                         | Rationale                                  |
| ------------------------------------------------------------------- | --------------------------------- | ------------------------------------------ |
| Dead relay messages                                                 | Sheet                             | Scrollable message payload + retry/dismiss |
| Stalled sessions                                                    | Sheet (or navigate to `/session`) | Session context + "Open" action            |
| Failed Pulse runs                                                   | Sheet                             | Log output + re-run action                 |
| Offline agents                                                      | Sheet                             | Agent info + reconnect action              |
| Tool approval (not currently in "Needs Attention" as a View button) | Dialog                            | Binary decision, immediate action          |

### 5. Stalled Sessions — Navigate to `/session` Instead of Sheet

Stalled sessions are a special case. The most useful "View" action for a stalled session is not a detail panel — it is navigating to the session itself. The user needs to send a message to unblock the agent.

```
Dashboard → click "View" on stalled session →
navigate({ to: '/session', search: { session: sessionId, dir: dirPath } })
```

This is the only attention item type where route navigation is correct over a Sheet. The rationale: the user's required action (send a message) is only possible in the session view. A Sheet showing the session detail would be a dead end unless it embedded the full chat input — which is the session view.

This is consistent with the existing behavior: the active session cards on the dashboard already have "Open" buttons that navigate to `/session?session=id&dir=path`.

### 6. Deep-Link State via Search Params — Implementation Pattern

The complete pattern for the dashboard "Needs Attention" section:

```typescript
// In the dashboard route's validateSearch
const dashboardSearchSchema = z.object({
  // Existing params (session panel, etc.)
  relay: z.enum(['dead-letter']).optional(),
  pulse: z.enum(['run']).optional(),
  mesh: z.enum(['agent']).optional(),
  itemId: z.string().optional(),
});

// AttentionItem component (simplified)
function AttentionItem({ item }: { item: AttentionItem }) {
  const navigate = useNavigate();

  function handleView() {
    if (item.type === 'stalled-session') {
      // Navigate to session view
      navigate({ to: '/session', search: { session: item.sessionId, dir: item.dir } });
      return;
    }

    // Open subsystem panel with item context
    const searchUpdate = {
      'dead-relay-message': { relay: 'dead-letter' as const, itemId: item.id },
      'failed-pulse-run': { pulse: 'run' as const, itemId: item.id },
      'offline-agent': { mesh: 'agent' as const, itemId: item.id },
    }[item.type];

    navigate({ to: '.', search: (prev) => ({ ...prev, ...searchUpdate }) });
  }

  return (
    <div className="flex items-center gap-3">
      <AttentionItemIcon type={item.type} />
      <AttentionItemDescription item={item} />
      <Button variant="ghost" size="sm" onClick={handleView}>
        View
      </Button>
    </div>
  );
}
```

```typescript
// Panel open state read from search params
function DashboardPage() {
  const { relay, pulse, mesh, itemId } = useSearch({ from: dashboardRoute.id });

  return (
    <>
      {/* ... dashboard content ... */}
      <RelayPanel
        open={relay === 'dead-letter'}
        focusItemId={relay === 'dead-letter' ? itemId : undefined}
        onClose={() => navigate({ to: '.', search: (prev) => ({ ...prev, relay: undefined, itemId: undefined }) })}
      />
      <PulsePanel
        open={pulse === 'run'}
        focusItemId={pulse === 'run' ? itemId : undefined}
        onClose={() => navigate({ to: '.', search: (prev) => ({ ...prev, pulse: undefined, itemId: undefined }) })}
      />
      <MeshPanel
        open={mesh === 'agent'}
        focusItemId={mesh === 'agent' ? itemId : undefined}
        onClose={() => navigate({ to: '.', search: (prev) => ({ ...prev, mesh: undefined, itemId: undefined }) })}
      />
    </>
  );
}
```

---

## Detailed Analysis

### Why Not New Routes for v1?

The argument for new routes (`/relay/dead-letters/:id`) is compelling from a URL semantics standpoint. Resources should be addressable. However, for DorkOS's attention items, the cost-benefit calculation at v1 is clear:

**Cost:**

- 3-4 new routes, 3-4 new page-level components (RelayDeadLetterPage, PulseRunPage, MeshAgentPage)
- Navigation away from the dashboard — users must press Back to return
- Each new route needs its own data fetching, error states, loading states
- FSD: new widgets layer artifacts per subsystem

**Benefit:**

- Cleaner URL semantics
- Easier "open in new tab" (though rare for attention items)
- Fits the "every resource has a URL" web principle

For attention items specifically — which are ephemeral (they resolve and disappear), action-oriented (the user needs to take one action and return), and glanceable (the detail is brief, not a full page) — the cost of route-based navigation outweighs the benefit. The Pattern A (search params + Sheet) achieves 95% of the URL benefit (deep-linkable, shareable, back-button works) at 20% of the implementation cost.

**When to add routes (v2 trigger):** If the subsystem panels grow to the point where a detail view is sufficiently rich (multi-tab layouts, embedded charts, extensive history) that it justifies a full page, routes become the right answer. The search param approach does not preclude this — you can migrate incrementally by replacing the search param navigation with route navigation when the time comes.

### The Dialog Routes Pattern — Considered and Rejected for Most Cases

The "dialog routes" pattern (assigning a URL path to a dialog, e.g., `/` with `?dialog=/relay/dead-letters/abc`) was evaluated. This pattern is used by Trello (card detail is a URL route that opens as a dialog over the board). The key insight from the research: this pattern works best for information-display dialogs and breaks down for forms or multi-step flows.

The concern for DorkOS: dialog routes push to the history stack, so "closing" the dialog triggers a back-navigation. If the user opens a panel, does something, closes it, and presses back, they return to the panel — not to some prior state. This is confusing. The simpler search-param-on-same-route pattern avoids this: closing the Sheet sets the search params to `undefined` without a history push.

The TanStack Router docs' recommended pattern is to use `replace: true` in the navigation call when opening an overlay, so that closing does not push to history. This is the correct mitigation:

```typescript
// Open the panel without adding to history
navigate({
  to: '.',
  search: (prev) => ({ ...prev, relay: 'dead-letter', itemId: item.id }),
  replace: false, // push to history so Back closes the panel
});
```

Actually, whether to use `replace: true` or `replace: false` depends on desired behavior:

- `replace: false` (default): Opening the panel is a history entry. Pressing Back closes it. Good for navigating to items.
- `replace: true`: Opening the panel replaces the current history entry. Back goes to the previous page. Good for ephemeral overlays.

For attention item detail panels, `replace: false` is correct — the user should be able to press Back to close the panel. This matches the behavior of a Sheet opened via navigate (not via local state).

### Industry Confirmation: Ops Tools Navigate to Specific Items

The PagerDuty and Datadog patterns confirm the principle: clicking an alert always navigates to the specific incident or monitor, never to the alerts list. Grafana alert links resolve to the specific firing rule with its current state visible.

The "open the containing section" approach (our current pattern) exists in some tools as a fallback when the specific item isn't linkable — but it is considered a degraded experience in the monitoring UI field. The upgrade from "opens the section" to "opens the specific item" is exactly what this feature implements.

### Calm Tech Alignment

The Calm Tech design philosophy (Weiser & Brown, Xerox PARC) is at the center of DorkOS's dashboard design. The attention item navigation pattern should follow the same principles:

- **Periphery to center**: The Sheet sliding in from the right is visually distinct from the background dashboard — it takes center attention — but the background remains visible and oriented. The user knows where they came from.
- **One action, then back**: After taking action on a dead letter (retry or dismiss) or a failed Pulse run (re-run), the Sheet closes and the dashboard is still there. No disorienting full-page navigation.
- **Silent resolution**: When the item is resolved, it disappears from the "Needs Attention" section. The Sheet can close automatically (or the user closes it after acting). The absence of the item is the signal that all is well.

---

## Recommendation

### Primary: Sheet with TanStack Router Search Params (Pattern A)

For all attention item types except stalled sessions:

1. "View" button navigates via TanStack Router with search params: `{ relay: 'dead-letter', itemId: id }` (or equivalent for other types)
2. The relevant subsystem panel (Sheet) opens on the dashboard page, passing `focusItemId` to highlight the specific item
3. Closing the Sheet navigates with `relay: undefined, itemId: undefined`
4. The URL is deep-linkable: `/?relay=dead-letter&itemId=abc`

### Secondary: Route Navigation for Stalled Sessions

For stalled sessions:

1. "View" button navigates to `/session?session=id&dir=path`
2. The session view opens — the only place where the user can unblock the agent
3. No Sheet needed — the action requires the full session context

### Action Button Label Refinement

The label "View" is correct for most attention items. For stalled sessions, consider "Open" (consistent with active session cards' existing "Open" button) to signal that this is a navigation, not a panel open.

| Attention Item Type | Button Label | Behavior                                         |
| ------------------- | ------------ | ------------------------------------------------ |
| Dead relay message  | View         | Opens Relay panel Sheet, highlights dead letter  |
| Stalled session     | Open         | Navigates to `/session?session=id&dir=path`      |
| Failed Pulse run    | View         | Opens Pulse panel Sheet, highlights failed run   |
| Offline agent       | View         | Opens Mesh panel Sheet, highlights offline agent |

### FSD Implementation Guidance

Following FSD layer rules:

- **`use-attention-items.ts`** (in `features/dashboard-attention/model/`) derives attention items and provides the `itemId` needed for navigation — no change needed for item data structure
- **`AttentionItem.tsx`** (in `features/dashboard-attention/ui/`) adds navigation logic in `handleView()` — this is where the search param navigation lives
- **`DashboardPage.tsx`** (in `widgets/dashboard/`) reads search params and passes `open` and `focusItemId` to each subsystem panel
- **Subsystem panels** (in `widgets/relay-panel/`, `widgets/pulse-panel/`, `widgets/mesh-panel/`) accept and implement `focusItemId` prop — scroll to item, apply highlight ring

The `focusItemId` prop is the interface contract between the dashboard navigation and the subsystem panels. Each panel implements highlighting differently (scroll + `data-focus` attribute, or ring highlight) but the prop shape is uniform.

---

## Research Gaps & Limitations

- TanStack Router's official docs on search-param-driven panel/dialog state are not as richly documented as the general search params guide. Implementation specifics require referencing community patterns and the router's source examples.
- The `replace: true` vs `replace: false` behavior for search param navigation was reasoned from principles, not found documented explicitly for overlay use cases in TanStack Router v1.
- Panel `focusItemId` implementation detail (scroll-to, highlight behavior) requires hands-on design iteration — the highlight ring and scroll behavior within each subsystem panel is out of scope for this research.
- The Datadog/Grafana/PagerDuty navigation patterns were inferred from product behavior and secondary sources, not from internal design documentation.

## Contradictions & Disputes

- **Routes vs. search params**: The "dialog routes" argument (every resource should have a clean URL path) is architecturally valid but practically overkill for ephemeral attention items. This is a design philosophy tradeoff, not a correctness issue. The search-param approach is the pragmatic v1 choice; routes are the principled v2 path.
- **Sheet vs. Dialog for detail views**: Some UX practitioners argue modals are better for focused action. For DorkOS attention items, the "view + act" flow benefits from the context preservation of a Sheet. The one exception (tool approvals) already uses a Dialog, which is consistent with the "focused binary decision" use case.

## Sources

- [Dialog Routes — Kenrick's Notes](https://blog.kenrick95.org/2025/12/dialog-routes/) — Dialog route pattern analysis: when dialogs should be routes, the history push/pop tradeoff, and selective adoption guidance
- [Search Params as State — TanStack Blog](https://tanstack.com/blog/search-params-are-state) — TanStack Router's first-class search params philosophy; type-safe, validated, router-managed
- [Search Params Guide — TanStack Router Docs](https://tanstack.com/router/latest/docs/guide/search-params) — Implementation patterns for search param state, including dialog/overlay open/close via undefined params
- [PatternFly Notification Drawer Design Guidelines](https://www.patternfly.org/components/notification-drawer/design-guidelines/) — "Do not use the notification drawer as the sole place for events requiring immediate action — use a modal dialog" (tool approval implication)
- [Modal UX Best Practices — LogRocket](https://blog.logrocket.com/ux-design/modal-ux-best-practices/) — When modals are correct (binary focused decisions) vs. when slides-over are correct (non-blocking detail views)
- [Bottom Sheets: Definition and UX Guidelines — Nielsen Norman Group](https://www.nngroup.com/articles/bottom-sheet/) — Side panels/sheets suit tasks requiring focus without full interruption; context preservation while drawing attention to secondary content
- [Oracle Alta UI Patterns: Drawer](https://www.oracle.com/webfolder/ux/middleware/alta/patterns/Drawers.html) — Overlay vs. inline drawer modes, modal vs. modeless interaction
- [Mastering Modal UX — Eleken](https://www.eleken.co/blog-posts/modal-ux) — "Modals interrupt and pause the user's current task — use only when message is critical and needs immediate attention or action"
- [Dashboard Route Navigation Architecture — DorkOS Research](research/20260320_dashboard_route_navigation_architecture.md) — Prior DorkOS research; "Needs Attention" section design, calm tech principles applied to dashboard, route structure
- [Dashboard Content Design Patterns — DorkOS Research](research/20260320_dashboard_content_design_patterns.md) — "Needs Attention" item anatomy, action buttons, session card "Open" navigation, attention item design
- [Datadog Integration Guide — PagerDuty](https://www.pagerduty.com/docs/guides/datadog-integration-guide/) — Bidirectional alert-to-detail navigation between ops tools; specific incident context over section context
- [TanStack Router: Query Parameters — Leonardo Montini](https://leonardomontini.dev/tanstack-router-query-params/) — Practical TanStack Router search param patterns including controlled panel state
- [shadcn/ui Sheet Component](https://ui.shadcn.com/docs/components/radix/sheet) — Sheet component API: `open`, `onOpenChange`, slide direction; extends Dialog for supplementary content
- [shadcn/ui Dialog Component](https://www.shadcn.io/ui/dialog) — Dialog API: appropriate for confirmations, focused decisions, binary actions
- [Shadcn Sheet — shadcnstudio.com](https://shadcnstudio.com/docs/components/sheet) — Sheet vs Dialog decision guidance; sheets for navigation drawers, detailed views, settings panels; dialogs for confirmations
- [UX Strategies for Real-Time Dashboards — Smashing Magazine](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/) — Operational dashboards must enable low-latency interaction; alert-to-detail navigation must minimize clicks to resolution
- [Dashboard Design UX Patterns — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards) — Drill-down patterns: overview to detail; "users click on high-level metrics and access more detailed views" is the expected behavior
