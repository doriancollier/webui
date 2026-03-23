---
title: 'ConnectionsTab UX Best Practices — Empty States, Card Decomposition, Row Affordances, Status Display, Relative Time, Responsive Grids'
date: 2026-03-22
type: external-best-practices
status: active
tags:
  [
    connections-tab,
    relay,
    agent-settings,
    empty-state,
    compound-component,
    card-decomposition,
    clickable-row,
    affordance,
    status-display,
    deep-link,
    relative-time,
    skeleton-loading,
    responsive-grid,
    adapter,
  ]
feature_slug: connections-tab
searches_performed: 12
sources_count: 32
---

# ConnectionsTab UX Best Practices

**Date**: 2026-03-22
**Research Depth**: Focused Investigation (6 structured topics)
**Context**: Improving two ConnectionsTab components in DorkOS — the Relay panel (active adapter management) and the Agent-Settings panel (read-only subsystem status display).

---

## Research Summary

Six targeted topics were investigated. Heavy prior research in `research/20260311_adapter_binding_ux_overhaul_gaps.md`, `research/20260311_adapter_binding_configuration_ux_patterns.md`, and `research/20260310_statusline_compound_component_patterns.md` covered the adapter/binding UX and compound component patterns in depth; this report synthesizes those findings with new research on the remaining gaps. The core conclusions: (1) empty states for developer tools should be action-focused and text-minimal — no illustrations for power users; (2) the 457-line AdapterCard should be decomposed using a "dialog host" extraction pattern, not compound components; (3) clickable rows signal interactivity via hover background + a revealed chevron at the trailing edge — never permanent affordances in dense UIs; (4) status-only tabs should always cross-link to the configuration surface with a direct navigation action, not a prose instruction; (5) `@nkzw/use-relative-time` (zero-dependency, Intl.RelativeTimeFormat-backed) is the right choice for relative time with a simple `setInterval` wrapper for live updates; (6) `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` is the responsive grid idiom that eliminates forced two-column layouts in sidebar panels.

---

## Key Findings

### 1. Empty State UX Patterns for Developer Tools

**Finding**: The best empty states for developer tools are action-focused, text-minimal, and produce the UI that will exist post-setup — not a decorative placeholder. Illustrations are for consumer onboarding; developer control panels use a stripped-down variant.

**The three-state model** (from prior research cross-referenced with Pencil & Paper, Toptal, Sentry):

| State           | Trigger                              | Pattern                                              |
| --------------- | ------------------------------------ | ---------------------------------------------------- |
| First-use empty | No adapters configured               | Icon + one-sentence explanation + single primary CTA |
| Filtered empty  | Active search/filter returns nothing | "No results for [term]" + clear filter link          |
| Error empty     | Load failure                         | Error message + retry action + optional contact      |

**Power user empty states should NOT have:**

- Decorative illustrations (Linear and Notion use monochromatic icon-only treatment at most)
- Multiple CTAs (causes decision paralysis)
- Marketing copy explaining the feature's value — Kai already knows why he's here
- Tour triggers or "Get started" guides

**Power user empty states SHOULD have:**

- A single, immediately actionable button ("Add Adapter", not "Get Started with Relay")
- Optionally, 2-3 bullet points of what the user will be able to do — only if the feature is genuinely non-obvious
- The same visual language as the rest of the panel (no special empty-state component styles)

**Applied to Relay ConnectionsTab**: When no adapters exist, show:

```
[icon: plug or similar neutral icon]
No adapters configured
Add an adapter to route messages from Telegram, Slack, or webhooks
to your agents.

[Add Adapter]
```

No illustration. No onboarding checklist. One button. If there are adapters but none match the current filter, show "No adapters match" with a "Clear filter" link — not a full empty state.

**Applied to Agent-Settings ConnectionsTab**: This tab always has content (Pulse/Relay/Mesh subsystem rows), so a first-use empty state is not needed. The "passive" problem is a different issue addressed in Topic 4.

---

### 2. Card Component Decomposition Patterns (457-Line AdapterCard)

**Finding**: The correct decomposition for a card that acts as both a display surface and an action host (with inline dialogs/sheets) is **dialog host extraction**, not compound components. Compound components are for display composition; dialog lifecycle management is a separate concern.

**Prior research** (`research/20260310_statusline_compound_component_patterns.md`) established the compound component pattern for display-only components (StatusLine). For AdapterCard, the issues are different: a 457-line file containing both card rendering and dialog/sheet management is a **colocation problem**, not a composition problem.

#### The Dialog Host Extraction Pattern

Separate three concerns into three files:

**File 1: `AdapterCard.tsx`** — display-only, receives data and callbacks as props, no internal state beyond UI interactions (hover, expand). Renders the card chrome, binding rows, toggle, and action menu. Emits events upward via callbacks. ~100-130 lines.

**File 2: `AdapterCardActions.tsx`** (or `useAdapterCardActions.ts`) — manages dialog open/close state, coordinates between card events and sheet/dialog lifecycle. The "orchestrator" layer. ~80-100 lines.

**File 3: `AdapterSetupSheet.tsx`** / `BindingEditSheet.tsx` — the Sheet/Dialog component itself, completely decoupled from the card. Accepts the entity as a prop, manages its own form state. Reusable from other surfaces (e.g., the topology view). ~150-200 lines each.

**The key principle**: Sheets/Dialogs should never be embedded inside card components. They should be rendered at a higher tree level (ideally via a portal at the page/panel root), with the card just emitting an intent ("user clicked edit on binding X") that the orchestrator layer handles.

This is the pattern used by shadcn/ui itself — `Dialog` is rendered at any tree level and uses `createPortal` internally, but the _decision_ to open it lives in the orchestrator, not the card.

#### When Compound Components Apply

Compound components are appropriate if the card's _internal display structure_ needs to be composed differently in different contexts. Example: an `AdapterCard.Compact` vs `AdapterCard.Full` variant. For DorkOS's current use case (one card style, one context), compound components add overhead without benefit. Skip them for the card decomposition — use plain function extraction and dialog host pattern.

#### Practical Decomposition Plan for AdapterCard

```
features/relay/
  components/
    AdapterCard.tsx              ← card display (props in, callbacks out)
    AdapterCard/
      AdapterCardHeader.tsx      ← icon, name, status dot, toggle
      AdapterCardBindings.tsx    ← binding rows list
      AdapterCardMenu.tsx        ← kebab/overflow action menu
    AdapterSetupSheet.tsx        ← wizard sheet (reusable)
    BindingEditSheet.tsx         ← binding CRUD sheet (reusable)
  hooks/
    useAdapterCardState.ts       ← dialog orchestration, open/close state
```

`AdapterCard.tsx` stays under 150 lines. The sheets are independently testable. The hooks are mockable in tests.

---

### 3. Interactive Row Discoverability (Binding Rows)

**Finding**: In developer tool UIs, list rows signal clickability through **hover background change + trailing edge chevron that appears on hover only**. Permanent visual affordances (always-visible chevrons, underlines) are noise in dense UIs. The hover state IS the affordance.

#### Industry Pattern (from Pencil & Paper, Vercel design guidelines, Stripe)

The canonical pattern for clickable list rows in developer/admin tools:

```
Default state:
┌────────────────────────────────────────────┐
│  Chat "Design Review" → Builder Agent       │
└────────────────────────────────────────────┘

Hover state:
┌────────────────────────────────────────────┐
│  Chat "Design Review" → Builder Agent    ›  │  ← chevron appears
└───────────────────── bg: muted/50 ─────────┘
```

Key design decisions from the research:

1. **Background change is mandatory** — without a bg change, hover affordance is invisible to users who don't move their mouse. Use `bg-muted/40` or `bg-accent/20` on hover.
2. **Trailing chevron on hover** — `›` (or `ChevronRight` icon, 14px, muted color) appears at the far right on hover. It disappears when not hovering. This is the standard Linear, Vercel, and Stripe pattern.
3. **No cursor:pointer by default** — the cursor change is implicit from the hover bg. Adding explicit `cursor-pointer` is redundant in most modern designs but acceptable.
4. **Inline action buttons use `opacity-0 group-hover:opacity-100`** — buttons on the row (edit, delete) are hidden until hover. This prevents the "Christmas tree" effect in dense binding lists.
5. **Click target is the entire row** — use `<button>` or an `<a>` wrapping the row content, not a small icon. Vercel's guidelines explicitly state: "no dead zones — if part of a control looks interactive, it should be interactive."

#### Applied to Binding Rows in AdapterCard

```tsx
// Binding row — signals interactivity via hover, not permanent chrome
<button
  className="group hover:bg-muted/40 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors"
  onClick={() => onEditBinding(binding.id)}
>
  <span className="flex-1 text-sm">{binding.label}</span>
  <span className="text-muted-foreground text-xs">{binding.agentName}</span>
  {/* Edit icon — appears on hover only */}
  <PencilIcon className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
  {/* Chevron — appears on hover only */}
  <ChevronRightIcon className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
</button>
```

The `group` Tailwind utility enables child elements to respond to the parent's hover state. This is the correct implementation for the DorkOS design system.

#### Edit-in-Place vs Click-to-Edit

For binding rows, **click-to-edit** (opens a Sheet) is correct — bindings have enough configuration fields that in-place editing would require too many inputs to appear simultaneously. Reserve inline editing for single-field values (e.g., renaming an adapter label directly in the card header).

---

### 4. Status Display vs Actionable Panels

**Finding**: A read-only status tab that tells users to "go configure in panel X" without a clickable link is a UX dead end. The correct pattern is **direct navigation actions** embedded in the status display itself — not prose instructions.

#### The Cross-Panel Navigation Pattern

The best admin UIs (Datadog, Home Assistant, Grafana, Stripe) treat status displays as launching pads, not dead ends. Every status row that indicates an actionable state (error, unbound, degraded) includes an inline link or button that takes the user directly to the resolution surface.

**Examples from the industry:**

- **Datadog Integration Tile**: A tile showing "Detected but not installed" has a prominent "Install" button directly on it — not a note saying "Go to Integrations to install."
- **Home Assistant**: A failed integration card shows a "Fix it" button (or "Reconfigure") directly on the card — clicking it opens the reconfiguration flow without requiring manual navigation.
- **Grafana Data Source**: A data source showing "data source is not working" has a "Test & Save" button accessible right from the source's detail view.
- **Stripe Connected Accounts**: "Actions required" items in the dashboard include a direct "Complete setup" button linked to the specific form — not "Go to Settings > Connected Accounts to complete."

#### Applied to Agent-Settings ConnectionsTab

The current passive pattern:

```
Pulse     ● Enabled    [info text about scheduling]
Relay     ● Enabled    [info text about messaging]
Mesh      ● Enabled    [info text about discovery]
```

The improved pattern with direct navigation actions:

```
Pulse     ● Scheduled (3 jobs)    [View in Pulse ↗]
Relay     ● 2 adapters bound      [Configure ↗]
Mesh      ● Registered            [View topology ↗]
```

For degraded/inactive states:

```
Pulse     ● No schedules          [Add schedule ↗]
Relay     ● No adapter bound      [Connect adapter ↗]
Mesh      ● Not registered        [Troubleshoot ↗]
```

The `↗` icon (or `ArrowTopRightOnSquare` / `ExternalLink` icon, 12px) signals cross-panel navigation. The click navigates to the relevant panel section — not just the tab, but ideally the specific subsection (e.g., `/relay?agent=agent-id` with context pre-filtered).

#### The "Always Enabled" Badge Problem (Mesh)

Hardcoding "always enabled" for Mesh is both inaccurate and noise. Replace with real state from the mesh registry:

- If the agent appears in the mesh registry → `● Registered`
- If the agent is in the registry but reporting errors → `● Degraded`
- If the agent is not in the registry → `● Not registered` (with link to troubleshoot)

Mesh enablement is not a toggle — it's a consequence of the agent running. Display the actual registration state, not a synthetic "enabled" badge.

#### Loading States: Skeleton Over Text

From the skeleton loading research, replacing "Loading..." text with skeleton placeholders is unambiguously correct for structured content like subsystem status rows.

The rule: **use skeleton when the layout is known ahead of time** (which it is for a fixed 3-row subsystem status display). Skeleton screens preserve spatial layout and prevent CLS, while "Loading..." text causes the layout to shift when content arrives.

```tsx
// Before: text placeholder
{
  isLoading ? 'Loading...' : subsystemStatus.pulse;
}

// After: skeleton (uses shadcn Skeleton component)
{
  isLoading ? <Skeleton className="h-4 w-24" /> : <StatusBadge state={subsystemStatus.pulse} />;
}
```

For the Agent-Settings ConnectionsTab with 3 rows, show 3 skeleton rows that mirror the height and width distribution of the real content.

**Accessibility note**: Skeleton animations should respect `prefers-reduced-motion`. shadcn's `Skeleton` component already handles this.

---

### 5. Relative Time Formatting

**Finding**: For DorkOS's use case, the best solution is `@nkzw/use-relative-time` (zero-dependency, `Intl.RelativeTimeFormat`-backed) combined with a simple `useEffect + setInterval` wrapper for live updates. No additional library needed beyond what the standard browser provides.

#### Library Comparison

| Library                          | Bundle size            | Auto-update    | Intl.RelativeTimeFormat | Notes                                 |
| -------------------------------- | ---------------------- | -------------- | ----------------------- | ------------------------------------- |
| `moment.js`                      | 19.7kb gzip            | No             | No                      | Obsolete, do not use                  |
| `date-fns formatDistanceToNow`   | ~2kb for this function | No             | No                      | String output only; no auto-update    |
| `dayjs + relativeTime plugin`    | ~2.5kb                 | No             | No                      | Good API; no auto-update              |
| `react-time-ago`                 | ~3-4kb                 | Yes (built-in) | Optional                | Full-featured; i18n; component + hook |
| `@nkzw/use-relative-time`        | Zero dependencies      | No (manual)    | Yes (native)            | Simplest; requires manual interval    |
| `Intl.RelativeTimeFormat` direct | 0kb                    | No             | Native                  | Requires manual thresholding logic    |

#### Recommendation: `@nkzw/use-relative-time` + interval wrapper

```tsx
// hooks/useAutoRelativeTime.ts
import useRelativeTime from '@nkzw/use-relative-time';
import { useState, useEffect } from 'react';

/** Returns a live-updating relative time string (e.g., "3 minutes ago"). */
export function useAutoRelativeTime(timestamp: number): string {
  const [tick, setTick] = useState(0);
  const label = useRelativeTime(timestamp);

  useEffect(() => {
    // Update frequently when recent, less often when older
    const age = Date.now() - timestamp;
    const interval =
      age < 60_000
        ? 10_000 // < 1 min: update every 10s
        : age < 3_600_000
          ? 60_000 // < 1 hr: update every minute
          : 3_600_000; // older: update every hour

    const timer = setInterval(() => setTick((t) => t + 1), interval);
    return () => clearInterval(timer);
  }, [timestamp, tick]);

  return label;
}
```

Usage:

```tsx
function SubsystemStatusRow({ lastSeenAt }: { lastSeenAt: number }) {
  const timeAgo = useAutoRelativeTime(lastSeenAt);
  return <span className="text-muted-foreground text-xs">{timeAgo}</span>;
}
```

#### When to Show Relative vs Absolute Time

The DorkOS convention should be:

- **Relative** (e.g., "3 minutes ago"): default for `lastSeenAt`, `lastMessageAt`, recent activity
- **Absolute on hover/tooltip**: `<time title={new Date(ts).toLocaleString()}>{timeAgo}</time>` — the `title` attribute shows the precise timestamp on hover without extra UI
- **Absolute only**: for scheduled events (Pulse jobs at "09:00 daily"), for log timestamps in the message feed

The `<time>` HTML element with a `dateTime` attribute is the correct semantic wrapper:

```tsx
<time dateTime={new Date(timestamp).toISOString()} title={new Date(timestamp).toLocaleString()}>
  {timeAgo}
</time>
```

---

### 6. Responsive Card Grids for Adapter Catalogs

**Finding**: The forced two-column grid in a sidebar panel is the wrong approach. CSS Grid's `repeat(auto-fill, minmax(MIN, 1fr))` eliminates hardcoded column counts and adapts to the available container width — the correct idiom for adapter/integration catalog grids.

#### The `auto-fill` + `minmax` Pattern

```css
/* The gold standard for responsive integration grids */
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
```

- **`auto-fill`**: Creates as many columns as fit, filling empty tracks with zero-width columns (preserves alignment when fewer items exist than columns)
- **`auto-fit`**: Collapses empty tracks (preferred when you want items to expand to fill space)
- **`minmax(280px, 1fr)`**: Each card is at minimum 280px wide, growing to fill available space

**For DorkOS's sidebar panel (typically 320-400px):**

At 320px panel width → `minmax(280px, 1fr)` → 1 column (280px fits once, 560px does not)
At 700px panel width → `minmax(280px, 1fr)` → 2 columns (280px × 2 = 560px < 700px)
At 900px panel width → `minmax(280px, 1fr)` → 3 columns

This means in the standard sidebar context, you naturally get 1 column (correct for narrow panels) and only go to 2 columns when the panel is wider than ~580px. No media queries needed.

**Tailwind v4 equivalent:**

```html
<div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3"></div>
```

#### Industry Patterns for Integration Catalogs

- **Zapier Catalog**: `auto-fill minmax(~220px, 1fr)` — adapts from 1 to 4+ columns. Cards are minimal: icon + name + category badge only.
- **n8n Integrations**: `auto-fill minmax(~180px, 1fr)` — very compact cards; scales well to large lists.
- **Vercel Integrations Marketplace**: Fixed 3-column grid at full-width; falls back to 2-col at medium breakpoint.
- **Home Assistant Integration Catalog**: `auto-fill minmax(~240px, 1fr)` — single column on mobile, 2-3 on tablet/desktop.

#### Applied to DorkOS AdapterCatalog

For the **catalog grid** (browsing available adapter types to add):

```
grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))
gap: 12px (gap-3)
```

For the **active adapters list** (configured adapter instances):

```
grid-template-columns: 1fr  (always single column — full-width cards with binding rows)
gap: 8px (gap-2)
```

The current problem (forced 2-col grid) is because the active adapters list uses a catalog-style grid when it should be a single-column list. Active adapter cards contain binding rows and controls that need the full width. Reserve the multi-column grid for the catalog (type selection) view only.

#### Container Queries Over Media Queries

For sidebar panels that can be resized, **CSS container queries** are more appropriate than media queries:

```css
/* panel wrapper */
.relay-panel-content {
  container-type: inline-size;
}

/* catalog grid inside it */
@container (min-width: 560px) {
  .adapter-catalog-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}
```

This makes the grid respond to the _panel's_ width, not the viewport width — critical for sidebars and resizable panels. Not yet in Tailwind v4 via utility class (needs a `@layer` override or inline style), but supported by all major browsers.

---

## Detailed Analysis

### Synthesis: Relay ConnectionsTab Improvements

Based on all six topics:

**Empty state**: Replace the passive empty state with a single-CTA empty state (see Topic 1). When adapters exist but bindings are missing, show the amber inline badge pattern from prior research (not a new empty state).

**Card decomposition**: Extract `AdapterSetupSheet`, `BindingEditSheet`, and `AdapterCardMenu` into their own files. Keep `AdapterCard.tsx` as a display-only component under 150 lines. Dialog lifecycle is managed by `useAdapterCardState`.

**Binding row affordance**: Apply `group` + `hover:bg-muted/40` + opacity-0-to-visible chevron and edit icon pattern. Wrap each row in a `<button>` for keyboard accessibility.

**Grid**: Use `1fr` (single column) for the active adapters list. Reserve multi-column only for the catalog (type-selection) view.

### Synthesis: Agent-Settings ConnectionsTab Improvements

**Status rows**: Replace each static badge with a badge + count/detail + direct navigation link. "Relay ● Enabled" becomes "Relay ● 2 adapters bound [Configure ↗]".

**Mesh badge**: Remove hardcoded "always enabled." Derive from mesh registry state. Three real states: Registered, Degraded, Not registered.

**Loading**: Replace all "Loading..." text with `<Skeleton>` components shaped like the real content.

**Relative time**: Use `useAutoRelativeTime` for `lastSeenAt` fields. Wrap in `<time dateTime={...} title={...}>` for absolute time on hover.

**Cross-panel navigation**: All "go configure in panel X" prose becomes clickable `[Action ↗]` links with TanStack Router navigation or `window.location` updates that open the target panel and pre-select the relevant entity.

---

## Sources & Evidence

### Empty State UX

- "Different contexts between a user performing a search, landing on a dashboard for the first time, and someone who has just cleared all their tasks require different empty state approaches." — [Empty State UX Examples — Pencil & Paper](https://www.pencilandpaper.io/articles/empty-states)
- "Linear uses simple, monochromatic illustrations that blend into the interface while still offering warmth and clarity." — [Empty States Design Best Practices — Medium](https://cadabrastudio.medium.com/empty-states-design-best-practices-4ae6f72b654b)
- Sentry's "Waiting for first event" pattern — prior research `20260311_adapter_binding_ux_overhaul_gaps.md`

### Card Component Decomposition

- Compound component pattern (Context API, `Object.assign`) — [Compound Components — Vercel Academy](https://vercel.com/academy/shadcn-ui/compound-components-and-advanced-composition)
- StatusLine compound component decomposition (AnimatePresence, registration context, dialog host extraction) — prior research `20260310_statusline_compound_component_patterns.md`
- Dialog/Sheet rendering via createPortal, separation from card display — shadcn/ui source

### Interactive Row Affordances

- "Table interfaces are by nature very dense so our goal isn't to overcharge the UI with buttons everywhere. Instead, opportunistically display the right interactions only when and where they are needed." — [Data Table Design UX Patterns — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
- "Whole row clickable upon hover hints to users that more details exist in a secondary view." — same source
- "No dead zones — if part of a control looks interactive, it should be interactive." — [Web Interface Guidelines — Vercel](https://vercel.com/design/guidelines)
- Chevron/arrow at right edge for navigable rows — Pencil & Paper data tables article

### Status Display vs Actionable Panels

- Datadog "Available / Detected / Installed" with Install button — prior research `20260311_adapter_binding_ux_overhaul_gaps.md`
- Home Assistant "Fix it" / "Reconfigure" button on failed integration card — same source
- "Match notification prominence to actual risk level" — [Error Message UX — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-error-feedback)

### Relative Time Formatting

- [Fast and Light Relative Time Strings in JS — Builder.io](https://www.builder.io/blog/relative-time) — critique of moment.js; Intl.RelativeTimeFormat advocacy
- [use-relative-time — nkzw-tech/use-relative-time](https://github.com/nkzw-tech/use-relative-time) — zero-dependency hook; falls back gracefully if Intl.RelativeTimeFormat unavailable
- [react-time-ago — catamphetamine](https://github.com/catamphetamine/react-time-ago) — full-featured alternative with built-in auto-update; heavier
- [Intl.RelativeTimeFormat — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat) — native browser API; `numeric: 'auto'` for "yesterday" vs "1 day ago"
- [Relative Time · Day.js](https://day.js.org/docs/en/plugin/relative-time) — dayjs plugin; no auto-update

### Skeleton Loading

- "Skeleton screens create anticipation of what is to come and reduce cognitive load." — [Skeleton Loading — LogRocket Blog](https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/)
- "Only use skeletons for loads longer than 0.5 seconds." — [Skeleton Loading — Medium (Babar Bilal)](https://medium.com/@babarbilal303/building-a-smooth-and-lightweight-skeleton-loader-for-react-df23aee58596)
- "Skeleton loaders reduce bounce rates and improve perceived performance." — [Skeleton Loading — Medium (Alhassan Mohammed)](https://medium.com/@bigboss200535/skeleton-loading-boost-ux-with-placeholder-magic-07babac3f709)

### Responsive Card Grids

- `repeat(auto-fill, minmax(200px, 1fr))` as the canonical responsive grid — [Responsive Card Layout with CSS Grid — DEV](https://dev.to/m97chahboun/responsive-card-layout-with-css-grid-a-step-by-step-guide-3ej1)
- `auto-fill` vs `auto-fit` semantic difference — [Responsive CSS Grid Layouts — Harshal Ladhe](https://harshal-ladhe.netlify.app/post/responsive-css-grid-layouts)
- Container queries for sidebar-aware responsive layouts — CSS Container Queries spec

---

## Research Gaps & Limitations

- **Container queries in Tailwind v4**: The exact Tailwind v4 syntax for container queries was not confirmed — the `@container` query CSS approach is well-established but may need a `@layer` override or a plugin (`tailwindcss-container-queries`) rather than a plain utility class. Verify before implementation.
- **`@nkzw/use-relative-time` auto-update**: The library itself does not auto-update. The `useAutoRelativeTime` hook pattern proposed above requires a `tick` state trigger, which causes the hook to re-run `useRelativeTime`. Verify that this pattern does not cause excessive re-renders on components with many timestamps.
- **TanStack Router cross-panel navigation**: The specific URL schema for deep-linking to the Relay panel with a pre-selected agent context (`/relay?agent=X`) was not validated against DorkOS's current router configuration. This needs a routing plan separate from this UX research.
- **Vercel's specific hover animation** (background sliding between hovered items) was noted but not deeply researched. This is the "magic highlight" pattern (also seen in Raycast). It requires tracking mouse position and animating a background element. May be too elaborate for binding rows but worth evaluating for the adapter list.

---

## Contradictions & Disputes

- **Illustrations in empty states**: Some sources ("make it cute if you can") advocate for illustrations even in professional tools. The DorkOS position (Kai/Priya personas, "Calm Tech" philosophy, Dieter Rams "as little design as possible") points clearly toward no illustrations. Use icon-only treatment at most — an SVG icon in muted color, not a rendered scene.
- **Always-visible vs hover-only chevrons**: Some admin UIs (Salesforce Lightning, older GitHub) show permanent chevrons on every row. Modern developer tools (Linear, Vercel, Stripe) have moved to hover-only reveal. The latter is correct for DorkOS — dense binding lists with 5-10 rows would become visually noisy with permanent chrome.
- **`auto-fill` vs `auto-fit`**: For the catalog grid where you want items to center when there are fewer than a full row, `auto-fit` is actually better. For the catalog where you always want left-aligned items regardless of count, `auto-fill` is better. Both are valid; the choice depends on the exact layout intent.

---

## Companion Research

The following prior research reports are directly relevant to the ConnectionsTab improvements and should be read alongside this report:

- `research/20260311_adapter_binding_ux_overhaul_gaps.md` — Five-state status model (green/blue/amber/orange/red), amber dot for unbound adapters, three-tier nudge system, Datadog/Stripe/Home Assistant status patterns
- `research/20260311_adapter_binding_configuration_ux_patterns.md` — Binding list UI, catch-all vs specific bindings, progressive disclosure levels 0-5, contextual filtering
- `research/20260227_adapter_catalog_patterns.md` — ConfigField descriptor pattern, AdapterManifest structure, multi-step setup wizard, catalog endpoint design
- `research/20260310_statusline_compound_component_patterns.md` — Compound component pattern with AnimatePresence, registration context, CSS separator

---

## Search Methodology

- Searches performed: 12
- Most productive search terms: "clickable list row hover affordance developer tools", "skeleton loading vs text placeholder React 2025", "useRelativeTime React hook Intl.RelativeTimeFormat auto-refresh", "responsive card grid auto-fill minmax integration catalog", "empty state developer admin panel power user"
- Primary information sources: Pencil & Paper UX patterns, Vercel design guidelines, nkzw-tech/use-relative-time GitHub, catamphetamine/react-time-ago GitHub, Builder.io blog, Smashing Magazine, DEV Community, LogRocket Blog
- Prior DorkOS research: 4 directly relevant reports leveraged (see Companion Research section)
