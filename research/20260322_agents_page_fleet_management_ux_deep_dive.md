---
title: 'Agents Page Fleet Management UX — Deep Dive Across 7 Topics'
date: 2026-03-22
type: external-best-practices
status: active
tags:
  [
    agents-page,
    fleet-management,
    status-health-bar,
    agent-card,
    empty-state,
    view-switcher,
    micro-interactions,
    responsive,
    list-ux,
    developer-tools,
  ]
feature_slug: agents-page
searches_performed: 12
sources_count: 42
---

# Agents Page Fleet Management UX — Deep Dive Across 7 Topics

## Research Summary

This report synthesizes prior DorkOS research (which is highly comprehensive for Topics 1, 3, 4, 5) with new external research on the four less-covered topics: fleet-level health summary bars (Topic 2), micro-interactions for list items (Topic 6), responsive fleet management (Topic 7), and view-switcher animation patterns (Topic 5 supplemental). The prior research in `20260320_agents_page_ux_patterns.md`, `20260225_mesh_panel_ux_overhaul.md`, `20260226_agents_first_class_entity.md`, `20260228_graph_topology_visualization_ux.md`, and `20260301_ftue_best_practices_deep_dive.md` is foundational and is referenced throughout rather than repeated.

The central conclusion across all 7 topics: the DorkOS Agents page should be a **dense list with a segmented health summary bar, two-tab view switching (List/Topology), premium Motion-driven micro-interactions, and a mobile-responsive filter collapse** — a control panel, not a chatbot wrapper UI.

---

## Topic 1: Fleet Management UI Patterns

### Best Practices

The consensus across all respected developer tools is the **dense list (hybrid) pattern** — not card grids, not full data tables. The prior research (`20260320_agents_page_ux_patterns.md`) covers this exhaustively and its conclusions are definitive:

- Linear's issue list, GitHub's PR list, Railway's service list, Vercel's deployment list, and Headlamp's (Kubernetes) workload list all use this pattern
- For 5–50 named entities managed by name, status, and context: dense rows with progressive expand are superior to both alternatives
- Card grids add whitespace without information; data tables add complexity without progressive disclosure

**Information hierarchy (from best developer tools in this space):**

**Linear** — Each issue row: priority icon + issue ID + title + assignee avatar + label badges + status + due date. The density is extreme (44px row height) but scannable because the hierarchy is absolute: title dominates, metadata is secondary, actions emerge on hover. No hover action menus unless there are 4+ actions.

**Vercel** — Deployment rows: project color dot + project name (bold) + branch name + commit hash + environment badge + deployment status icon + relative timestamp. Two visual tiers: primary (project name + status) immediately scannable, secondary (branch, commit, environment) readable at will. Status uses redundant cues — color AND icon AND label text, never color alone.

**Railway** — Service list: service name + health indicator ring + deployment status text + last deployed timestamp + resource usage mini-sparkline. The health ring directly around the service icon is distinctive — it communicates both health and "this entity is running" in one visual element.

**GitHub Actions** — Workflow run rows: status icon (colored) + workflow name + trigger context + branch + committer avatar + duration + relative timestamp. The status icon is the first element, not buried. Duration is tabular-nums to prevent layout jitter.

**Kubernetes (Headlamp)** — Pod list: status colored cell + pod name + namespace + node + age + CPU usage + memory usage. Table format is justified here because Kubernetes has 50-500+ pods, not 5-50. The sortable table is warranted at that scale. Headlamp then adds a Topology tab that shows the graph view of the same data — this is the exact tab-within-page pattern.

**Grafana Fleet Management** — Collector list: health indicator dot (Green/Yellow/Red/Gray) + collector name + version + namespace + last seen. The dot uses exactly 3 meaningful states and one unknown state — never more. Fleet-level health is shown in a summary bar above the list: "4 Healthy · 1 Warning · 0 Error" as colored counts.

### Recommended Approach for DorkOS

Follow the prior research recommendation exactly:

```
┌─────────────────────────────────────────────────────────────────────┐
│ [▸] [●] backend-bot           claude-code   ~/projects/api   2m ago  │
│      [code] [test] [review]                    0 sessions    [Start] │
└─────────────────────────────────────────────────────────────────────┘
```

Row height: 52–56px collapsed. Always-visible primary action button. Health dot (not health ring — that complexity belongs in topology view). Maximum 3 capability badges in collapsed state. Relative timestamp in `text-muted-foreground`.

### Trade-offs

- Dense list is harder to visually differentiate agents at a glance vs. card grid. Mitigated by: deterministic agent color dot (derived from agent ID), capability badges, project path truncation.
- The always-visible "Start Session" button takes horizontal space. For very long agent names, the button may push the name to truncate early. Solution: button stays right-aligned with a fixed-width column (80px for the button area).

---

## Topic 2: Status Health Summary Bars

### Best Practices

This is the least covered area in prior DorkOS research. Here is what the monitoring dashboard ecosystem has converged on.

#### The Four Aggregate Health Patterns (ranked by clarity)

**Pattern A: Segmented Count Row (recommended)**

```
● 8 Active   ● 2 Inactive   ● 1 Stale
```

Three inline spans with semantic dot + count + label. Uses semantic colors: green (active), amber (inactive), gray (stale). Dots are 8px circles. Spans separated by `·` dividers or whitespace. This is the pattern Grafana, PagerDuty, and CloudWatch all use for fleet-level health at the top of a resource list. It is the fastest to scan because the numbers are adjacent to their semantic indicator.

**Pattern B: Segmented Progress Bar**

```
[████████░░░░░░░░░░] 8/11 healthy
```

A horizontal bar divided proportionally by state. Used by AWS CloudWatch Database Insights' "Fleet Health Dashboard" and Oracle Database Management's health visualization. The bar conveys proportion at a glance (how healthy is the fleet as a percentage?). Works well when proportion matters more than absolute counts. Falls apart when the fleet is tiny (5 agents — proportional bars become meaninglessly thin slices).

**Pattern C: Status Grid / Icon Matrix**

```
[●][●][●][●][●][●][●][●][◐][◐][○]
```

A row of colored dots, one per agent. Used by status pages (Statuspage.io, Atlassian) for showing at-a-glance history. At 5–50 agents, this works as a supplementary element inside the summary bar — dots link to individual agents. At scale (50+), it becomes noise.

**Pattern D: Stat Cards (heavy)**

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ 8 Active │  │ 2 Inactive│  │ 1 Stale  │
│  ●●●●    │  │  ◐◐      │  │  ○       │
└──────────┘  └──────────┘  └──────────┘
```

Full stat cards with counts, icons, and labels. Used by fleet management dashboards (Fleetio, Verizon Connect). Too heavy for a sub-header. Appropriate for a standalone dashboard section, not for the top of an agent list.

#### The Carbon Design System Authority

IBM's Carbon Design System documents the canonical status indicator pattern for fleet-level health:

- States: Critical (red), Error (red), Warning (amber), Caution (amber), Stable (green), Informational (blue), Minor (teal), Unknown/Undefined (gray)
- For developer tools, reduce to 3 operational states: Active (green), Inactive (amber), Stale (gray) — plus an implicit "Unreachable" (red, show only when detected)
- Always pair color with text label — never color alone
- Icon groupings with counts: `● 8 · ◐ 2 · ○ 1` is Carbon's own pattern for health summary rows
- Status dot size: 8px for inline indicators, 12px for standalone status cells

#### Grafana's Fleet Management Health Bar

Grafana's fleet management UI shows:

```
Fleet health:  ● Healthy: 42  ⚠ Warning: 3  ✕ Error: 1  ? Unknown: 0
```

Each state is a colored label + count. The entire summary is a single line at the top of the collector list. Clicking a count filters the list to show only agents in that state — the summary bar doubles as a filter control. This is the highest-value enhancement: **a clickable health summary that acts as a quick filter.**

#### Recommended Pattern for DorkOS

```
┌─────────────────────────────────────────────────────┐
│  ● 8 Active  ·  ◐ 2 Inactive  ·  ○ 1 Stale         │
│                                              11 agents│
└─────────────────────────────────────────────────────┘
```

- Component: `AgentHealthSummary` — a single-line bar above the filter bar
- Dots: 8px, `rounded-full`, semantic colors (`text-emerald-500`, `text-amber-500`, `text-muted-foreground`)
- Count labels: `tabular-nums` for stable width during polling updates
- Total count right-aligned: "11 agents" in `text-muted-foreground/70`
- **Clicking a status count applies it as an active filter** (sets status chip to that state, does not navigate)
- Show only states with count > 0 (if no stale agents, don't show "0 Stale")
- The bar disappears entirely when the filter is applied (replaced by filter chip "Active" with clear button) — no visual redundancy
- Respect polling: counts update via the same `useRegisteredAgents` TanStack Query that drives the list

#### Trade-offs

- Clickable summary-as-filter adds complexity to the filter state machine: clicking "2 Inactive" should set the status filter chip to "Inactive." This requires a callback between `AgentHealthSummary` and `AgentFilterBar`.
- Segmented progress bar (Pattern B) is visually richer but worse for absolute counts. For DorkOS (5–20 typical agents), absolute counts are more informative than proportional bars. Recommendation: counts only.

---

## Topic 3: Agent/Service Card Design

### Best Practices

**Two-line card layout authority:**

From Vercel's Web Interface Guidelines:

- Design for all states: empty, sparse, dense, error
- Use redundant status cues — color + icon + text label
- Layouts must be resilient to user-generated content: short names, very long names, missing data
- Nested radii: child radius ≤ parent radius (14px card → 10px badge is correct; 14px card → 16px badge is wrong)
- Two shadow layers for card depth: ambient + direct light

**From Linear (issue list at 44px row density):**

The information hierarchy principle: **one dominant element per row, everything else is secondary.** In Linear's issue list, the issue title is the only bold, full-weight text. Every other element — priority icon, assignee, labels, due date — is visually subordinate. The eye lands on the title and then scans secondary elements. The status and priority are to the left of the title because they qualify the title (before reading what it is, know whether it needs attention).

**For agent rows, apply the same hierarchy:**

1. **Health dot** — leftmost, before the name. If the agent is stale/unreachable, the user should know before reading the name.
2. **Agent name** — dominant, font-medium (not font-bold — bold is for headings; medium is for list items per Linear's standard)
3. **Runtime badge** — small, right of name or below it. Muted background.
4. **Project path** — `text-muted-foreground/70`, truncated with ellipsis
5. **Capability badges** — `text-muted-foreground/60` background, max 3
6. **Last active** — tabular-nums, `text-muted-foreground/60`
7. **Session count** — shown only when > 0, amber dot + count
8. **Start Session button** — right edge, fixed-width column

**From Vercel (deployment cards at 56px density):**

- The project name and status are visually inseparable — status indicator is directly adjacent to the name, not separated by several other elements
- Relative time is shown but is the lowest visual weight element
- Deployments with errors use a red left border accent (not just a red icon) — the error state has visual "weight" that passive states don't have

**Recommended DorkOS row anatomy — two visual tiers:**

```
Tier 1 (always visible, 52px row):
[expand] [health-dot] [name]   [runtime]   [path]   [last-active]
                      [cap1] [cap2] [cap3+N]    [sessions]  [Start]

Tier 2 (expanded, +80px):
─────────────────────────────────────────────────────────────────
Description text (truncated to 2 lines)
All capabilities: [cap1] [cap2] [cap3] [cap4] [cap5]
Response mode: always | Hops: 3 | Rate: 100/hr
Registered Feb 26 by filesystem-scanner
Namespace: api-team                         [Edit] [Unregister]
```

### Trade-offs

- Showing capability badges in collapsed state requires knowing max badge count before render. Solution: CSS `overflow: hidden` + `line-clamp` on the badge container with a `+N` overflow badge computed in JS. This is what GitHub does for label lists on issue cards.
- The "last active" timestamp must handle the never-active state gracefully: "Never" in `text-muted-foreground/60`. Avoid "undefined" or "N/A".

---

## Topic 4: Empty State / Onboarding Patterns

### Best Practices

The prior research (`20260225_mesh_panel_ux_overhaul.md` and `20260301_ftue_best_practices_deep_dive.md`) is the authoritative source and should be treated as gospel for DorkOS. Synthesizing the key points for the Agents page specifically:

**The three-function rule for empty states (NN/G):**

1. Communicate system status (why is this empty?)
2. Provide learning cues (what will this look like when populated?)
3. Enable direct task pathways (one action to get there)

**The "two parts instruction, one part delight" formula:**

Instruction must be complete before personality is added. A ghost graph showing dimmed placeholder agent nodes IS the delight — not animation for its own sake, but visual evidence of what the canvas will become.

**Developer tool empty states that set the standard:**

- **Linear**: Demonstrates the ideal state directly. Rather than explaining features, it pre-populates with demo data that models correct usage. The user learns by seeing, not by reading.
- **GitHub Actions**: Empty workflow list says "Get started with GitHub Actions — Build, test, and deploy your code" with two specific example templates shown as cards. The templates are not vague ("Start from template") — they are specific examples of real workflows.
- **Vercel**: Projects dashboard when empty: large illustrated graphic of what a deployment card looks like, grayed out, with "Import a project" as the single CTA. This is the ghost pattern for a list view, not just for a graph.

**For the DorkOS Agents page, two distinct empty states:**

**State A — Zero agents registered (Mode A):**

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│          [Radar scan animation — 3 ghost agent rows]           │
│                                                                │
│          No agents registered                                  │
│          Agents govern directories — give Claude Code          │
│          a name, description, and persistent context.          │
│                                                                │
│          [~/projects] [~/workspace] [~/]  + Add directory      │
│                                                                │
│                        Scan for Agents →                       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

Key elements:

- Ghost rows (3 dimmed, dashed-border agent rows) show what the list will look like when populated. This is the ghost graph pattern applied to a list view.
- Chip-based directory suggestions, pre-filled with CWD
- Single primary CTA: "Scan for Agents"
- No competing secondary links

**State B — Zero results after filter:**

```
No agents match "backend"  ·  [Clear filter]
```

One line. One action. No icon needed.

**State C — Module disabled (Mesh not enabled):**

```
Mesh is not enabled.
Agents require Mesh to be registered across projects.

Add to your .env:  DORKOS_MESH_ENABLED=true  [Copy]
```

**What makes an empty state feel like an onboarding moment vs. a dead end:**

1. A dead end explains what's missing. An onboarding moment shows what's possible.
2. A dead end has no path forward. An onboarding moment has exactly one clear path forward.
3. A dead end is generic ("No items found"). An onboarding moment is contextual ("No agents registered — here's how to find them using your current working directory").
4. A dead end is static. An onboarding moment has ambient visual life (a ghost scan animation, a subtle pulsing placeholder).

**Progressive disclosure in the setup flow:**

The discovery flow does NOT belong in a separate tab for the Agents page. It IS the Agents page in Mode A (zero agents). Once agents exist, Mode B (list view) takes over. The existing MeshPanel Mode A/Mode B architecture is the correct model — replicate it in the dedicated Agents page.

### Trade-offs

- Ghost agent rows require rendering placeholder motion components. Keep these accessible: `aria-hidden="true"` on the ghost rows, `role="status"` on the overlay with an `aria-label`.
- The "Scan for Agents" flow bridges to the discovery subsystem. The Agents page should import `DiscoveryView` directly (it already exists in `features/mesh/ui`). No new component needed.

---

## Topic 5: View Switcher (List vs. Graph) Patterns

### Best Practices

**The canonical patterns from production tools:**

**Linear (List / Board / Timeline):**
Linear uses segmented tab-like controls in the view header. The active view has a filled background pill; inactive views are text-only. Switching views is instant — no loading state. The view state persists in the URL (`?view=board`). Crucially, the selected issue persists across view changes — if you have issue #1234 selected in list view and switch to board, the board scrolls to reveal that issue. **Cross-view state persistence is the critical quality signal.**

**Figma (List / Grid in Files panel):**
Icon-based toggle buttons (list icon / grid icon) in the panel header. Toggle state is remembered per session. The transition between list and grid is a layout animation — items reflow from their list positions to grid positions using a FLIP-style animation. At low item count (~20-30 files), this animation feels premium. At high count (100+ files), Figma skips the animation entirely and swaps instantly. **Performance-aware animation** — animate when cheap, skip when expensive.

**Headlamp / Kiali (Kubernetes / Service Mesh):**
Table view (list) and topology graph view accessed via tab buttons in the resource header. The graph state (zoom, selected node, layout) is preserved when switching away and back. No animation on the transition — the tab switch is instant with a fade. This is the pattern the existing DorkOS MeshPanel uses.

**GitHub Repositories (List / Grid):**
Icon toggle in the top-right of the repo list. Grid shows 3 columns of cards; list shows dense rows. No animation on switch. State in localStorage. This is appropriate because GitHub's repo lists can have hundreds of items — layout animation at scale would be disorienting.

**The three levels of view switcher quality:**

| Level    | What it does                                                                                                                                                        | Implementation |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Basic    | Tab/button click swaps content, no animation                                                                                                                        | 2 hours        |
| Standard | Tab switch fades out old content, fades in new. Active state has visual indicator. State in URL.                                                                    | 4 hours        |
| Premium  | Cross-view state persistence (selected agent in list view highlights in graph view). Smooth layout animation at small scale. State in URL with back-button support. | 8 hours        |

#### Recommended pattern for DorkOS — Standard + one Premium feature

Use the existing `MeshPanel` tab pattern (Standard). Add exactly one Premium enhancement: **selection synchronization** — when an agent is selected (expanded row) in the list view, and the user switches to Topology view, the topology graph should `flyTo` that agent's node and select it.

**Tab animation spec:**

```typescript
// Outer: height collapse is NOT needed here — both views are full-height.
// Use content crossfade only:

<AnimatePresence mode="wait" initial={false}>
  <motion.div
    key={activeTab} // "agents" | "topology"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
    className="min-h-0 flex-1"
  >
    {activeTab === 'agents' ? <AgentList /> : <TopologyGraph />}
  </motion.div>
</AnimatePresence>
```

No `y` translation on the tab swap — the graph canvas has its own coordinate system and any `y` offset on its container will appear wrong relative to React Flow's internal state.

**Tab control anatomy:**

```
Agents (11)    Topology
──────────────────────
```

- Two tab buttons in the page header
- Active tab: `text-foreground font-medium` + `border-b-2 border-foreground`
- Count badge on "Agents" tab: shows total count (or filtered count when filter is active)
- No icon on tabs — text only (consistent with existing panel conventions)

**Why not a toggle button (list icon / grid icon)?**

Icon toggles work when the two views are equivalent alternatives for the same data (grid vs. list of files). The Agents list view and Topology view are semantically different — one is a management surface, the other is a visualization. They deserve labeled tab buttons, not interchangeable icons.

### Trade-offs

- Selection synchronization between list and topology requires the topology graph to accept a `selectedAgentId` prop and call `fitView()` when it changes. The existing `TopologyGraph.tsx` already supports `NodeToolbar` selection — extending this to accept a controlled selection is straightforward.
- `AnimatePresence mode="wait"` means the old view fully exits before the new view enters. The 150ms gap where neither view is visible is acceptable for a tab switch (users initiated the action) but would be wrong for a loading transition.

---

## Topic 6: Micro-Interactions for List Items

### Best Practices

Micro-interactions are where a good list becomes a great one. The research identifies six patterns that are worth implementing for the DorkOS Agents page, and three that are not worth the complexity.

#### Patterns Worth Implementing

**1. Expand/Collapse Height Animation (highest value)**

The two-div pattern from `theodorusclarence.com` is the correct approach:

```typescript
// Outer: animates height
<motion.div
  initial={{ height: 0 }}
  animate={{ height: 'auto' }}
  exit={{ height: 0 }}
  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
  className="overflow-hidden"
>
  {/* Inner: animates content opacity */}
  <div className="py-3">
    {/* expanded content */}
  </div>
</motion.div>
```

Critical: use `overflow-hidden` on the outer div to clip content during collapse. Use `padding` inside the inner div (not `margin`) — margins don't animate with height and cause layout flicker.

**2. Stagger on Filter Change (high value)**

When the filter changes and the list re-renders with fewer/different items, the remaining items should stagger-animate into their new positions:

```typescript
const listVariants = {
  visible: {
    transition: { staggerChildren: 0.04 }, // 40ms stagger
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.15 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.1 } },
};
```

Use `LayoutGroup` on the list container so that items animate to their new positions when siblings exit:

```tsx
<LayoutGroup>
  <AnimatePresence initial={false}>
    {filteredAgents.map((agent) => (
      <motion.div
        key={agent.id}
        layout
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <AgentRow agent={agent} />
      </motion.div>
    ))}
  </AnimatePresence>
</LayoutGroup>
```

The `layout` prop on each item handles position transitions when siblings enter/exit. This is what makes filter changes feel like a natural reflow rather than a content swap.

**3. Health Pulse Dot (medium value)**

The pulsing CSS animation for active agents signals "this agent is live" without requiring an icon or text:

```css
/* Applied to the health dot when status === 'active' */
@keyframes healthPulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0);
  }
}

.agent-active-dot {
  animation: healthPulse 2s ease-in-out infinite;
}
```

Use CSS animation (not Motion) for the pulse — it runs on the compositor thread and is zero JS cost. Set `animation-play-state: paused` when `prefers-reduced-motion: reduce` is set.

The pulse should only apply to `status === 'active'` agents. Inactive agents: `text-amber-500` dot, no pulse. Stale agents: `text-muted-foreground/50` dot, no pulse.

**4. Hover Depth Effect (medium value)**

The hover state for list items should add subtle depth, not change background color aggressively:

```typescript
<motion.div
  whileHover={{
    backgroundColor: 'hsl(var(--muted) / 0.5)', // very subtle
  }}
  transition={{ duration: 0.1 }}
  className="group rounded-lg px-3"
>
```

The `group` class enables Tailwind's group-hover utilities for revealing child elements (the chevron expander becomes fully opaque on hover, the "Start Session" button gets slightly more contrast).

**Do not** add `y: -1` or `scale: 1.01` on hover for list items — the scale creates visual instability in a dense list where adjacent items are very close. Depth should come from background lightening only.

**5. Skeleton Loading States (medium value)**

When `useRegisteredAgents` is loading, show skeleton rows instead of a spinner:

```tsx
// 3 skeleton rows
{
  isLoading &&
    Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="flex animate-pulse items-center gap-3 px-3 py-3">
        <div className="bg-muted h-2 w-2 rounded-full" />
        <div className="bg-muted h-3 w-32 rounded" />
        <div className="bg-muted ml-auto h-7 w-20 rounded-md" />
      </div>
    ));
}
```

This is the same pattern used by the existing `SessionList` skeleton loading in the codebase.

**6. Action Button Reveal (low value, but clean)**

The "Start Session" button is always visible (right-aligned, per the prior research recommendation). However, secondary actions (Edit, Unregister) should appear on row hover via the `group-hover` pattern:

```tsx
<div className="flex gap-1 opacity-0 transition-opacity duration-100 group-hover:opacity-100">
  <button>Edit</button>
  <button>Unregister</button>
</div>
```

This reduces visual noise in the default state while keeping actions discoverable.

#### Patterns NOT Worth Implementing

**Elaborate entrance animations on page load** — Staggering in all 10 agents on the initial render is visually expensive and annoying on repeat visits. Reserve stagger animation for filter changes only. Initial render: fade-in only (`initial={{ opacity: 0 }} animate={{ opacity: 1 }}`).

**Scale on hover** — As noted above, scale effects on dense list items create visual instability. Background lightening only.

**Particle effects / glow effects on "active" agents** — The pulse dot is sufficient. Glow effects add visual noise that competes with the health dot's semantic meaning.

### Trade-offs

- `LayoutGroup` with `layout` prop on list items adds a React context per layout group. For 5–50 agents, this is zero cost. If the list ever reaches 200+ agents, disabling layout animations at scale would be needed.
- The health pulse dot animation: CSS `animation: healthPulse 2s infinite` runs indefinitely. If 20 agents are all active, 20 simultaneous CSS animations are running. These are compositor-thread only (box-shadow + opacity via CSS animation) — not a JS cost. Acceptable.
- Stagger delay of 40ms × 20 items = 800ms total stagger duration. For a filter that removes 15 items, this means the last item finishes staggering-in 600ms after the filter was applied. Cap the stagger at 10 items maximum: `staggerChildren: Math.min(filteredAgents.length, 10) * 0.04 / filteredAgents.length` — or simply hard-cap at `staggerChildren: 0.04` with a short enough per-item duration that the total effect completes in <300ms regardless.

---

## Topic 7: Responsive Fleet Management

### Best Practices

The DorkOS Agents page runs primarily as a desktop developer tool (the primary use case is Kai working at his workstation). However, the sidebar is collapsible and the page should degrade gracefully to narrow viewports (collapsed sidebar + small monitor, or mobile device for quick status checks).

**From monitoring dashboard research:**

**Hicron's fleet management research (2025):**

- Priority KPIs surface to the top on small screens — secondary data moves to accordions or swipe-tabs
- Touch-friendly buttons: minimum 44px tap target height (this aligns with the current 52px row height — rows should have a minimum height regardless of content)
- Filter controls should collapse into a bottom sheet or dropdown on mobile rather than a full filter bar
- Cards with high-contrast status indicators remain legible on small screens where text truncation is aggressive

**Toptal's mobile dashboard research:**

- On mobile, switch from multi-column filter chips to a single "Filter" button that opens a bottom sheet
- Keep the health summary bar visible — it's the first thing a mobile user needs (fleet status at a glance)
- The primary action button (Start Session) must remain visible and touchable — don't hide it behind a "..." menu on mobile

**The responsive strategy for the Agents page:**

```
≥ 1024px (desktop / large tablet):
  [Health Summary Bar]
  [Search] [All] [Active] [Inactive] [Stale]  [Group by ▾]
  [Agent Row × N]
  [Agent Row × N]

640px–1023px (narrow desktop / tablet):
  [Health Summary Bar]
  [Search] [Filter ▾]   (chips collapse into a single dropdown)
  [Agent Row × N — path truncated more aggressively]

< 640px (mobile):
  [Health Summary: ●8 ◐2 ○1]  (inline, single line)
  [Search]  [Filter]
  [Agent Row × N — 2-line layout, button below text]
  (Start Session button moves to full row width on expand)
```

**Mobile-specific row changes:**

At < 640px, the agent row must reflow from a horizontal layout to a 2-line stacked layout:

```
Line 1: [●] backend-bot     [runtime badge]
Line 2: ~/projects/api  [code] [test]  [Start]
```

The project path and capabilities stack below the name. The Start Session button stays on the right side of line 2, not moved to line 3. This keeps the row compact (64px stacked, still touch-friendly).

**The filter bar collapse:**

On mobile (< 640px), replace the 3 status chips with a single `Filter` button that opens a dropdown or sheet:

```tsx
{/* Desktop */}
<div className="hidden md:flex gap-1">
  <FilterChip value="active" ... />
  <FilterChip value="inactive" ... />
  <FilterChip value="stale" ... />
</div>

{/* Mobile */}
<div className="flex md:hidden">
  <MobileFilterButton activeFilters={...} />
</div>
```

The `MobileFilterButton` shows a badge count when filters are active ("Filter · 1").

**Touch-friendly expand/collapse:**

On mobile, the expand chevron target should be enlarged to the full left column (44×44px touch target). The row itself should not expand on full-row tap (too easy to trigger accidentally when scrolling) — only the explicit chevron area.

### Trade-offs

- The 2-line mobile row increases row height. If an agent has all 5 optional fields showing, the collapsed mobile row could be 72px+ tall. This is fine — mobile lists are naturally taller due to touch targets.
- The health summary bar on mobile: showing "●8 ◐2 ○1" as a single compact line requires the clickable filter behavior to still work (tap on "●8" to filter by active). Ensure the tap target is at least 44px wide for each count group.
- The topology tab on mobile: the React Flow canvas is usable on touch devices (pinch to zoom, drag to pan) but the node detail is hard to read. Consider showing a simplified "Mobile topology" that does not use React Flow — just a list of connections as text. Or, more pragmatically: the Topology tab is intentionally desktop-first and shows a "Best viewed on desktop" notice on mobile.

---

## Synthesized Recommendation: The Complete Agents Page Design

### Page Structure

```
AgentsPage
├── AgentsHeader (page header, shared with AgentsPage route)
│   ├── Title: "Agents"
│   ├── Tab bar: [Agents (11)] [Topology]
│   └── Scan for Agents button (secondary, right)
│
└── AgentsContent (tab-switched via AnimatePresence)
    ├── Tab: "agents"
    │   ├── AgentHealthSummary (●8 Active · ◐2 Inactive · ○1 Stale · 11 agents)
    │   ├── AgentFilterBar (search + status chips + namespace dropdown)
    │   └── AgentList (LayoutGroup > AnimatePresence > AgentRow × N)
    │
    └── Tab: "topology"
        └── TopologyGraph (existing, with selectedAgentId prop for cross-view sync)
```

### Component Hierarchy

| Component            | Location                  | Status                                         |
| -------------------- | ------------------------- | ---------------------------------------------- |
| `AgentsPage`         | `widgets/agents/`         | New — route wrapper                            |
| `AgentsHeader`       | `widgets/agents/ui/`      | New — page header with tabs                    |
| `AgentHealthSummary` | `features/agent-list/ui/` | New                                            |
| `AgentFilterBar`     | `features/agent-list/ui/` | New (adapts existing `AgentsTab` filter logic) |
| `AgentList`          | `features/agent-list/ui/` | New (enhanced, replaces `AgentsTab` internals) |
| `AgentRow`           | `features/agent-list/ui/` | New (replaces/enhances `AgentCard.tsx`)        |
| `AgentRowExpanded`   | `features/agent-list/ui/` | New (the expand section)                       |
| `TopologyGraph`      | `features/mesh/ui/`       | Existing — reuse without modification          |
| `DiscoveryView`      | `features/mesh/ui/`       | Existing — reuse for Mode A                    |

### Animation Stack

```
Page load: no stagger — simple opacity fade-in
Filter change: LayoutGroup + stagger (staggerChildren: 0.04, max 10 items)
Expand/collapse: height animation (0.2s, overflow-hidden, padding inside inner div)
Tab switch: AnimatePresence mode="wait", opacity only (0.15s)
Health dot: CSS animation, compositor-thread, respects prefers-reduced-motion
Hover: motion.div whileHover (background), group-hover for secondary actions (CSS)
Skeleton: Tailwind animate-pulse (CSS)
```

### Status Indicator Semantic Mapping

| Agent Status  | Dot Color                  | Dot Animation           | Row Tint                       |
| ------------- | -------------------------- | ----------------------- | ------------------------------ |
| `active`      | `text-emerald-500`         | CSS pulse (2s infinite) | none                           |
| `inactive`    | `text-amber-500`           | none                    | none                           |
| `stale`       | `text-muted-foreground/40` | none                    | none                           |
| `unreachable` | `text-destructive`         | none                    | `bg-destructive/5` left border |

### Filter State Machine

```typescript
type AgentFilterState = {
  query: string;
  status: 'all' | 'active' | 'inactive' | 'stale';
  namespace: string | null; // null = all namespaces
};
```

The health summary bar's clickable counts set `status`. The filter bar's chips also set `status`. They are the same state — one controls the other. When the summary bar is clicked, the corresponding filter chip becomes active. This creates a coherent filter model with two entry points.

---

## Research Gaps and Limitations

- No direct user research on DorkOS Agents page usage patterns. All density, hierarchy, and interaction recommendations are synthesized from analogous tools.
- The health pulse animation has not been tested against `prefers-reduced-motion` in the current codebase — implementation will need to verify the CSS `@media (prefers-reduced-motion: reduce)` override.
- The `LayoutGroup` + stagger pattern performance at 50+ agents has not been profiled in React 19. React 19's concurrent rendering may change the frame budget for animated list updates.
- Cross-view selection synchronization (list row → topology node highlight) requires `TopologyGraph` to accept a `selectedAgentId` and call `fitView` — this prop does not currently exist and needs API design.
- Mobile topology tab experience is deferred — no design recommendation given for the responsive behavior of the React Flow canvas at mobile viewport widths.

---

## Contradictions and Disputes

- **Stagger on initial load vs. filter change**: Some premium developer tools (Linear, Vercel) do stagger items on initial page load for a polish effect. Prior DorkOS animation research (`20260320_chat_message_list_animations.md`) recommends against stagger on initial renders. The recommendation here: no stagger on initial render (it's annoying on repeat visits), stagger only on filter-driven re-renders.
- **Health summary bar visibility during filtering**: If the health summary bar shows "● 8 Active" and the user filters to only show Active agents, the summary bar becomes redundant. The resolution: hide the summary bar when any status filter is active (it's replaced by the active filter chip), show it only in the default "All" state.
- **Segmented progress bar vs. count row**: Some dashboards (AWS CloudWatch) prefer the proportional progress bar. For DorkOS at 5–50 agents, absolute counts are more readable than proportional bars. The count row is the correct choice.

---

## Source Summary

All prior DorkOS research:

- `research/20260320_agents_page_ux_patterns.md` — Core layout, filter, topology integration (authoritative)
- `research/20260226_agents_first_class_entity.md` — Agent identity, navigation approaches
- `research/20260225_mesh_panel_ux_overhaul.md` — Empty states, discovery tab, progressive disclosure
- `research/20260228_graph_topology_visualization_ux.md` — Topology view, LOD, empty state ghost nodes
- `research/20260301_ftue_best_practices_deep_dive.md` — FTUE philosophy, Linear/Vercel/Stripe patterns
- `research/20260222_scheduler_dashboard_ui_best_practices.md` — Skeleton loading, timestamp conventions

External sources consulted:

- [Grafana Fleet Management — Collector Status](https://grafana.com/docs/grafana-cloud/send-data/fleet-management/manage-fleet/collectors/collector-status/)
- [IBM Carbon Design System — Status Indicator Pattern](https://carbondesignsystem.com/patterns/status-indicator-pattern/)
- [List Animation with Motion for React — Theodorus Clarence](https://theodorusclarence.com/blog/list-animation)
- [Advanced Animation Patterns with Framer Motion — Maxime Heckel](https://blog.maximeheckel.com/posts/advanced-animation-patterns-with-framer-motion/)
- [CSS Pulse "Live" Indicator — CSS3 Shapes](https://css3shapes.com/how-to-make-a-pulsing-live-indicator/)
- [CSS Status Indicators with Pulsing Animation — DEV Community](https://dev.to/snippflow/css-status-indicators-with-pulsing-animation-4lg2)
- [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines)
- [Fleet Management Dashboard Design Guide — Hicron Software](https://hicronsoftware.com/blog/fleet-management-dashboard-design/)
- [Mobile Dashboard UI Best Practices — Toptal](https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui)
- [Motion — React stagger documentation](https://www.framer.com/motion/stagger/)
- [Motion — Layout Animation (FLIP)](https://www.framer.com/motion/layout-animations/)
- [Badges vs. Pills vs. Chips vs. Tags — Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/badges-chips-tags-pills/)
- [Grafana Learning Journey — Monitor Collector Health](https://grafana.com/docs/learning-journeys/fleet-mgt-monitor-health/)
- [UX Strategies for Real-Time Dashboards — Smashing Magazine](https://smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)

---

## Search Methodology

- Number of prior DorkOS research files read: 6 (exhaustive coverage of Topics 1, 3, 4, partially 5)
- Number of new web searches performed: 12
- Number of web fetches performed: 4
- Most productive new search terms: "aggregate fleet health status bar N healthy N degraded monitoring", "Grafana fleet management collector status", "framer motion layout animation list filter stagger AnimatePresence", "theodorusclarence list animation motion"
- Topics requiring significant new research: Topic 2 (health summary bars), Topic 6 (micro-interactions), Topic 7 (responsive)
- Topics fully covered by prior research: Topic 1 (fleet management UI patterns), Topic 4 (empty states), large portions of Topics 3 and 5
