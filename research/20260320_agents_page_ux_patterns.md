---
title: 'Agents Management Page — UX Patterns & Best Practices'
date: 2026-03-20
type: external-best-practices
status: active
tags:
  [
    agents,
    agents-page,
    list-ux,
    card-vs-table,
    filter-ux,
    topology-integration,
    session-launch,
    progressive-disclosure,
    developer-tools,
    fleet-management,
  ]
feature_slug: agents-page
searches_performed: 6
sources_count: 28
---

# Agents Management Page — UX Patterns & Best Practices

## Research Summary

This report synthesizes prior DorkOS research (agents-first-class-entity, mesh-topology-elevation, mesh-panel-ux-overhaul, dashboard-content-design-patterns, scheduler-dashboard-ui) with new external research on list/table/card display patterns, filter UX for small collections, and topology integration approaches. The core finding: for 5–50 named agents in a developer tool context, a **dense-list (hybrid) layout** significantly outperforms both pure card-grids and pure data-tables. Topology should be a **tab within the page** (not an overlay or split pane), consistent with the existing Mesh panel architecture that already ships this pattern. Search should be an **instant inline filter** (not a full search bar) at this scale. The "start session" flow should be a **direct primary action button on each agent row** — no contextual menu.

This report also consolidates what is already built in the `MeshPanel` component and identifies which elements of the proposed Agents page design already exist versus what needs to be created.

---

## Key Findings

### 1. Dense-List (Hybrid) Layout Beats Both Cards and Tables for Developer Fleet Management

For developer tools managing named entities (agents, deployments, services), the **dense list with expandable rows** pattern consistently outperforms both card grids and full data tables:

- **Card grids** favor visual differentiation over scannable data — they excel when the user's task is "pick one that looks right" (e.g., template galleries, media libraries). Agents are not picked by appearance; they are identified by name, status, and project context. A 3-column card grid adds whitespace that slows scan speed without adding information.
- **Data tables** favor bulk operations and column-level comparison. For 5–50 agents, the complexity overhead of a full TanStack Table implementation (sortable headers, pagination, column resize) is unjustified. Tables imply "I need to compare column values across rows" — developers managing agents want to take action on a specific agent, not compare `maxHopsPerMessage` values across all agents at once.
- **Dense list (hybrid)** delivers the scan density of a table with the contextual richness of a card. Each row shows: identity (name + color dot) + status + project path + capabilities summary + action buttons. Expanded state reveals full details. This is the pattern used by: Linear's issue list, GitHub PR list, Railway service list, Vercel deployment list — the most respected developer tool UIs.

**Key principle from uxpatterns.dev**: "Tables work best when users need to scan large datasets, compare values across rows/columns, or take bulk actions. Cards are better when visual differentiation aids selection. Lists (dense rows) work best when users need to identify and act on individual items by name."

### 2. For 5–50 Items, Instant Inline Filtering Beats a Full Search Bar

NNGroup and LogRocket research on filtering UX at small scale:

- A full search bar (text input with debounce, API call) is warranted when the dataset has more than 100 items, or when filtering requires server-side computation.
- For 5–50 agents (the realistic DorkOS range), **instant client-side filter** (a text input that filters the already-loaded list in real time) is the correct pattern. Zero network round-trips, zero debounce needed, instant feedback.
- Supplementary filter **chips** (for status, namespace, runtime type) should be shown inline above the list — not in a collapsed sidebar. At this scale, filtering is a one-step action, not a workflow.
- "If there are too many filtering options (50+ items), consider collapsing the full list and showing only the top 5–6 with expandable 'Show more'" — Pencil & Paper filter UX research. At 5–50 agents, this complexity is unnecessary.

**The right filter set for agents** (in priority order):

1. Instant name/description text filter (always visible)
2. Status chips: All / Active / Inactive / Stale
3. Namespace/project filter (dropdown, shown when >1 namespace exists)
4. Runtime type filter (secondary, collapsed by default)

### 3. Topology Integration: Tab Within the Page Is the Established Pattern

Three approaches were compared:

**Option A: Tab/toggle within the page (existing Mesh pattern)**
The current `MeshPanel` already implements topology as a tab (Topology / Discovery / Agents / Denied / Access). This is the established DorkOS pattern. Users navigate between list and graph by clicking a tab — the state persists between tabs (selected agent, zoom level). This is also how Headlamp (Kubernetes), Railway, and Datadog APM structure their resource views.

**Option B: Split pane (list + topology side by side)**
Split panes work well in tools where the list and graph are both in constant use simultaneously (e.g., a circuit diagram editor where component selection and board view are always co-visible). For DorkOS agents, users are either scanning/filtering the list OR exploring topology — not simultaneously. A persistent split pane wastes 40-50% of the viewport on content the user isn't currently using. Railway and Render do not use split panes for their service topology.

**Option C: Overlay/modal**
Modals interrupt flow and are the wrong pattern for a persistent navigational view. The prior Mesh topology research explicitly recommended against modal interruptions. The Calm Tech principle "no modal interruptions" applies here.

**Verdict: Tab within the page.** The existing Mesh panel tab structure is architecturally correct and consistent. The Agents page should follow the same pattern, with the topology tab showing the graph for all registered agents.

### 4. Session Launch: Direct Button on Each Agent Row

How to start a session from an agent:

- **Direct button (primary action)**: Each agent row/card shows a "Start Session" (or "Open") button that navigates to `/session?dir={agent.projectPath}`. This is a single click, zero ambiguity.
- **Contextual menu**: A three-dot menu with "Start Session" as one option introduces a second interaction (click to open menu, click to select action). This is appropriate when there are 4+ actions per item. At current agent capabilities, there are 2-3 max (Start Session, Edit, Unregister).
- **Double-click or row click**: Navigating on row click is appropriate only when the primary intent of the page is "navigate to this item's detail view." On an agents page, clicking a row might mean "expand to see details" — separate from "start a session." These should not share the same trigger.

**Verdict: Primary action button per agent row.** The button label should match the current agent status:

- Agent healthy, no active session: "Start Session"
- Agent has an active session: "Open Session" (with session indicator)
- Agent stale/offline: "Start Session" (disabled with tooltip: "Agent unreachable")

This is the same pattern used in GitHub Copilot Mission Control (each task row has an "Open" or "Redirect" button), Linear's issue list (each issue has inline action buttons), and Railway's service list (each service has a "Deploy" or "View" button).

### 5. What Information to Show at a Glance vs. On Expansion

**At a glance (visible in collapsed row, always):**

| Field                         | Rationale                                                |
| ----------------------------- | -------------------------------------------------------- |
| Agent name                    | Primary identifier                                       |
| Health/status dot             | Immediate state awareness — is this agent live?          |
| Runtime badge                 | claude-code / other — informs what sessions will be like |
| Project path (truncated)      | Which project does this agent govern?                    |
| Active sessions count (if >0) | "2 active sessions" — Kai cares about fleet utilization  |
| Capabilities (top 2-3 badges) | What can this agent do?                                  |
| Last active timestamp         | When did it last do something?                           |

**On expansion (revealed in expandable section):**

| Field                            | Rationale                                                    |
| -------------------------------- | ------------------------------------------------------------ |
| Full description                 | Not scannable — read when you care about this specific agent |
| All capabilities                 | Complete capability set                                      |
| Behavior config                  | Response mode, escalation threshold                          |
| Budget limits                    | Hops, rate limit                                             |
| Registration date + registeredBy | Provenance                                                   |
| Namespace                        | Organizational context, more relevant in Topology view       |
| "Edit" link to full settings     | Opens AgentDialog                                            |

**Never show in the list:**

- Agent ID (ULID) — internal, not human-readable
- Full project path in expanded state (already shown truncated in collapsed)
- Raw agent.json file contents
- Token usage or cost data

### 6. Grouping and Filtering for 5–50 Agents

**Grouping options in priority order:**

1. **By namespace** (default if >1 namespace exists): Groups agents by their mesh namespace, with namespace name as a section header. This mirrors the existing topology structure and aligns with how Kai thinks about "my projects."
2. **By status** (toggle option): Groups active / inactive / stale. Useful for fleet health review ("which of my agents are stale?").
3. **By runtime** (minor, rarely needed at current scale): Not worth implementing until there are multiple runtime types.
4. **Flat list** (default for single-namespace installations): Most common case for solo developers — just an alphabetical list with instant filter.

**The right default**: Flat list for single namespace, grouped by namespace when multiple exist. Don't force grouping on users who don't need it.

### 7. Empty States Must Be Onboarding Moments

Prior Mesh panel research (20260225_mesh_panel_ux_overhaul.md) established this principle thoroughly. For the Agents page specifically:

- **Zero agents**: Show a scan prompt (CWD pre-filled, suggested directories as chips) + "Scan for Agents" CTA. The empty state IS the discovery flow — not a separate tab. This is the Mode A / Mode B pattern already implemented in `MeshPanel`.
- **Zero agents after filter**: "No agents match your filter. Clear filter →" — no icon needed, one action.
- **Zero active sessions on an agent**: Normal state — show "No active sessions" in the expanded area, not an error state.

---

## Detailed Analysis

### Layout Comparison Matrix

| Criteria                           | Card Grid                                     | Data Table                            | Dense List (Hybrid)                      |
| ---------------------------------- | --------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| Scan speed for named items         | Slow — eye must traverse 2D grid              | Fast — linear vertical scan           | Fast — linear vertical scan              |
| Visual differentiation             | High — space for color, icon, description     | Low — data-dense, sameness            | Medium — name + health dot differentiate |
| Mobile/narrow sidebar friendliness | Poor — 3 columns → 1 column = worse than list | Poor — needs horizontal scroll        | Good — degrades gracefully to list       |
| Action discoverability             | Moderate — hover to reveal                    | Moderate — row actions in last column | High — actions always visible in row     |
| Progressive disclosure             | Poor — everything visible or nothing          | Poor — limited expansion in tables    | Excellent — expand row for full detail   |
| Implementation complexity          | Medium                                        | High (sortable, paginated table)      | Low                                      |
| Appropriate scale                  | 5-20 items                                    | 50-10,000 items                       | 5-200 items                              |
| DorkOS fit                         | Poor                                          | Poor                                  | Excellent                                |

**Verdict: Dense list wins clearly for the DorkOS agents use case.**

### Topology Integration Comparison Matrix

| Criteria                            | Tab in Page                                  | Split Pane                       | Overlay/Modal                         |
| ----------------------------------- | -------------------------------------------- | -------------------------------- | ------------------------------------- |
| Viewport efficiency                 | Excellent — full viewport per mode           | Poor — 50% each, neither optimal | Good — full viewport but interrupts   |
| State persistence                   | Excellent — tab state preserved              | Excellent                        | Poor — modal closed = state lost      |
| User mental model                   | "I'm in the agents section, switching views" | "I need both simultaneously"     | "I'm temporarily inspecting topology" |
| Match to Kiai/Datadog/Headlamp      | Yes — all use tab/view toggle                | No                               | No                                    |
| Consistent with existing Mesh panel | Yes (same pattern)                           | No — new pattern                 | No — prior research rejected this     |
| Implementation cost                 | Minimal — extends existing tab pattern       | High                             | Medium                                |

**Verdict: Tab integration wins. The existing MeshPanel tab architecture is proven and consistent.**

### Agent Row Anatomy (Dense List)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [▸] [●] backend-bot           claude-code   ~/projects/api   2m ago  │
│      [code] [test] [review]                    0 sessions    [Start] │
└─────────────────────────────────────────────────────────────────────┘

Expanded:
┌─────────────────────────────────────────────────────────────────────┐
│ [▾] [●] backend-bot           claude-code   ~/projects/api   2m ago  │
│      [code] [test] [review]                    0 sessions    [Start] │
│ ─────────────────────────────────────────────────────────────────── │
│  REST API specialist. Handles endpoint development and testing.      │
│  All capabilities: code, test, review, debug, document               │
│  Response mode: always | Relay depth: 3 hops | Rate: 100/hr         │
│  Registered Feb 26, 2026 by filesystem-scanner                       │
│  Namespace: api-team                              [Edit] [Unregister] │
└─────────────────────────────────────────────────────────────────────┘
```

Key design decisions in this anatomy:

- `[▸]`/`[▾]` is a chevron expand button — not a row-click trigger. Row click is reserved for nothing (prevents accidental navigation).
- `[●]` is the health dot — green (active), amber (inactive), gray (stale). No arc ring needed in list view; that's topology-view complexity.
- `[Start]` button uses the stretched-link pattern from accessible table row research — it's a real `<button>` in the row, not an onClick on the row element.
- Capabilities show max 3 badges in collapsed state. "+" badge for overflow (e.g., "+4 more").
- Timestamp shows relative time (per scheduler-dashboard research): "2m ago" / "1h ago" / "Mar 15" for >7 days.

### Search and Filter Bar Anatomy

```
┌──────────────────────────────────────────────────────┐
│ [Search agents...]        [All ▾] [Active] [Inactive] │
└──────────────────────────────────────────────────────┘

  3 agents                          Group by: [Namespace ▾]
```

- Text input: instant client-side filter on name + description + capabilities. No API calls.
- Status chips: "All" (default), "Active", "Inactive", "Stale" — mutually exclusive.
- Namespace dropdown: only shown when >1 namespace exists (progressive disclosure).
- "3 agents" count: updates instantly as filter is applied.
- "Group by" dropdown: only shown when filtering is not active (grouping + filtering simultaneously is visually complex).

### Session Launch Flow

```
User clicks "Start Session" on backend-bot:
→ setDir(agent.projectPath)
→ Navigate to /session?dir={agent.projectPath}
→ Session page opens with backend-bot's directory pre-selected
```

The existing `handleOpenChat` in `MeshPanel` already implements this exact flow (`setDir` from `useDirectoryState`). The Agents page should reuse this pattern.

**Enhancement for active sessions**: If an agent has ≥1 active session, the button label changes to "Open Session" and a secondary indicator shows "1 active". Clicking opens the most recent active session directly (`/session?session={mostRecentSessionId}&dir={agent.projectPath}`).

### Progressive Disclosure Architecture

The Agents page has three levels of complexity that should be surfaced progressively:

| Level              | What the user sees                                                | User state                         |
| ------------------ | ----------------------------------------------------------------- | ---------------------------------- |
| **Overview**       | Name, health, project, capabilities summary, action button        | Scanning fleet, quick health check |
| **Agent detail**   | Expanded row: full description, all capabilities, behavior config | Investigating a specific agent     |
| **Agent settings** | AgentDialog (already exists)                                      | Editing agent configuration        |

This maps cleanly to the existing pattern:

1. Row in list → `AgentCard` in `MeshPanel` (needs enhancement)
2. Expanded row → currently partially implemented in `AgentCard.tsx` (chevron expand)
3. Full settings → `AgentDialog` in `features/agent-settings` (already complete)

### What Already Exists vs. What Needs Building

#### Already exists (reuse without modification):

- `AgentDialog` — full agent settings/editing
- `DiscoveryView` — scan for agents, register candidates
- `TopologyGraph` + `TopologyPanel` — topology view
- `AgentHealthDetail` — agent health side panel
- `useRegisteredAgents` — TanStack Query hook
- `useUnregisterAgent` — mutation
- `useDirectoryState` / `handleOpenChat` — session launch
- `MeshStatsHeader` — stats/summary strip
- `MeshEmptyState` — empty state component

#### Needs significant enhancement:

- `AgentCard.tsx` — currently minimal (chevron expand, edit/unregister buttons). Needs: health dot, last-active timestamp, active session count, "Start Session" button, capability badge overflow handling.
- `AgentsTab` in `MeshPanel` — currently a simple `map` over `AgentCard`. Needs: search/filter bar, grouping, result count, skeleton loading states.

#### New components needed:

- `AgentFilterBar` — text filter + status chips + namespace dropdown
- `AgentListGroup` — optional namespace grouping header with collapse/expand

#### Architecture question: New dedicated page or enhanced Mesh panel?

The prior research (20260226_agents_first_class_entity.md) recommended Approach 2 — agents as first-class session context. A dedicated `/agents` route (separate from the Mesh sidebar panel) would elevate agents to first-class navigation, consistent with the long-term vision. However, the `MeshPanel` already has well-designed infrastructure. Two options:

**Option A: Enhance the existing Mesh Agents tab** — Add filter, improved `AgentCard`, session launch. Low risk, consistent with existing navigation.

**Option B: New standalone `/agents` page** — Dedicated route, matches the "agents as first-class navigation" vision from ADR research, allows agents to be directly linked from dashboard "Mesh" card. Medium effort but architecturally forward-looking.

For the feature brief's requirements (list, filter, scan, topology toggle, session launch), **Option B is recommended** — a dedicated page gives agents the visual hierarchy they deserve and enables the dashboard's Mesh status card to link directly to it. The Mesh panel becomes topology/discovery/access-control focused, while the Agents page becomes the primary fleet management surface.

---

## Recommendation Summary

### Layout: Dense List with Expandable Rows

Use a dense vertical list with a chevron-expand pattern for progressive disclosure. Each row shows: health dot + name + runtime badge + project path + active session count + capability badges (max 3) + last active timestamp + "Start Session" button. Expanded row shows full description, all capabilities, behavior config, and Edit/Unregister actions.

### Topology Integration: Tab Within the Page

Follow the existing `MeshPanel` tab architecture. The Agents page has two tabs: **Agents** (list) and **Topology** (graph). The topology view shows all registered agents in the mesh graph — the exact same `TopologyGraph` component. No split pane, no modal.

### Search and Filter: Instant Inline Filter

A single text input for instant name/description filter + three status chips (Active / Inactive / Stale) + namespace dropdown (conditional on >1 namespace). All client-side, no debounce needed. Group-by control for namespace grouping.

### Session Launch: Direct Primary Action Button

Each agent row has a "Start Session" button (right side, always visible). When the agent has active sessions, the button becomes "Open Session" with a badge showing session count. One click, zero confirmation dialogs.

### Grouping: By Namespace When >1 Namespace Exists

Default to flat list for single-namespace setups (most common for solo developers). Auto-group by namespace when multiple namespaces exist. Provide a "Group by" dropdown for user control.

### Agent Details at Glance vs. Expansion

**Always visible**: name, health, runtime, project path (truncated), session count (if >0), top capabilities (max 3), last active.
**On expand**: description, all capabilities, behavior config, budget limits, registration metadata, Edit/Unregister actions.

### Empty States

- Zero agents: show Mode A (discovery flow) — pre-filled CWD, suggested directories, "Scan for Agents" CTA. This is already implemented in `MeshPanel` as Mode A.
- Zero results after filter: "No agents match. [Clear filter]"

---

## Comparison: Approaches for Main Layout

### Approach 1: Card Grid

- 2–3 columns of cards, each card ~180px tall
- Shows: name, health status, project path, top capabilities, action button
- **Pros**: Visually differentiated, shows more info per item, natural for mouse interaction
- **Cons**: Wastes vertical space, poor scan speed for named items, breaks at <300px width, requires hover for actions
- **Score**: Poor fit for developer fleet management (5–50 named agents)

### Approach 2: Data Table

- Traditional table with columns: Name | Status | Runtime | Project | Last Active | Sessions | Actions
- Sortable headers, optional pagination
- **Pros**: Maximum information density, column-level comparison, bulk action friendly
- **Cons**: Overkill for 5–50 items, no progressive disclosure, limited space for capabilities display, implementation complexity
- **Score**: Better fit for >100 items; over-engineered for current DorkOS scale

### Approach 3: Dense List (Hybrid) — RECOMMENDED

- Vertical list of rows, each row is a mini-card with fixed height (~56px collapsed)
- Chevron to expand to ~120px detailed view
- Always-visible action button (not hover-revealed)
- **Pros**: Fast vertical scan, progressive disclosure, graceful at any width, natural action discovery, low implementation complexity, extensible to 200+ agents
- **Cons**: Slightly less visual differentiation than cards (mitigated by health dot color)
- **Score**: Excellent fit — used by Linear, GitHub, Vercel, Railway, Headlamp

---

## Comparison: Topology Integration Approaches

### Approach 1: Tab Within the Page — RECOMMENDED

- "Agents" tab and "Topology" tab in the same page
- Clicking Topology tab shows the full `TopologyGraph`
- Consistent with existing `MeshPanel` architecture
- **Pros**: Full viewport for each view, state persists across tab switches, matches industry tools (Headlamp, Kiali), consistent with existing DorkOS patterns
- **Cons**: Requires two clicks to switch between agent row and topology view of that agent (minor)

### Approach 2: Split Pane

- Left pane: agent list; Right pane: topology graph
- Selecting an agent in the list highlights it in the graph
- **Pros**: Simultaneous list and graph visibility; strong for power users exploring relationships
- **Cons**: Both views compete for viewport; neither has enough space; topology needs more space to be useful; Mesh panel already tried this approach and uses tabs instead; adds significant layout complexity
- **Score**: Not recommended

### Approach 3: Overlay/Modal

- Topology accessed via a "View Topology" button that opens a full-screen modal
- **Pros**: Topology gets full viewport
- **Cons**: Modal pattern breaks flow, Calm Tech research explicitly rejects modals for persistent navigational views, state is lost on close
- **Score**: Not recommended

---

## Sources and Evidence

- [Table vs List vs Cards: When to Use Each — UX Patterns for Developers](https://uxpatterns.dev/pattern-guide/table-vs-list-vs-cards) — core layout decision framework
- [Cards versus Table: UX Patterns — Medium](https://cwcorbin.medium.com/redux-cards-versus-table-ux-patterns-1911e3ca4b16) — comparative analysis
- [Filter UX Design Patterns — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering) — instant vs. batch filtering for small lists
- [Getting Filters Right — LogRocket](https://blog.logrocket.com/ux-design/filtering-ux-ui-design-patterns-best-practices/) — progressive disclosure for filter UX
- [Search Filter UX Best Practices — Algolia](https://www.algolia.com/blog/ux/search-filter-ux-best-practices) — instant filtering is expected for lower-stake interactions with small lists
- [Don't Turn a Table into an ARIA Grid — Adrian Roselli](https://adrianroselli.com/2023/11/dont-turn-a-table-into-an-aria-grid-just-for-a-clickable-row.html) — accessible row interaction patterns
- [Headlamp Workload Management — DeepWiki](https://deepwiki.com/kubernetes-sigs/headlamp/3.4-workload-management) — Kubernetes resource list table + graph toggle pattern
- [Kiali Topology Features](https://kiali.io/docs/features/topology/) — list + graph tab pattern in service mesh management
- [Datadog APM Service Map](https://docs.datadoghq.com/tracing/services/services_map/) — service node graph with list complement
- [Dashboard Content Design Patterns — DorkOS Research](research/20260320_dashboard_content_design_patterns.md) — calm tech principles, status card taxonomy
- [Agents as First-Class Entity — DorkOS Research](research/20260226_agents_first_class_entity.md) — agent identity schema, navigation approaches, recommendation for Approach 2 (session context)
- [Mesh Topology Elevation — DorkOS Research](research/20260226_mesh_topology_elevation.md) — TopologyGraph enhancement patterns, NodeToolbar, fly-to selection, LOD zoom
- [Mesh Panel UX Overhaul — DorkOS Research](research/20260225_mesh_panel_ux_overhaul.md) — empty states, smart defaults, contextual guidance
- [Scheduler Dashboard UI Best Practices — DorkOS Research](research/20260222_scheduler_dashboard_ui_best_practices.md) — accessible clickable rows (stretched link), timestamp conventions, skeleton loading

---

## Research Gaps and Limitations

- No direct user research data on how DorkOS users (Kai profile) currently navigate between list and topology views — tab vs. split pane preference is inferred from industry tools, not observed from actual users.
- The "active session count per agent" display requires a join between the agents list and active sessions data — the current API may not provide this in a single call. Implementation would need to check.
- The "Group by namespace" feature requires the API to return namespace information alongside agent records — currently `useRegisteredAgents` returns flat `AgentManifest[]`. Namespace grouping may need `useNamespaces` data joined client-side.
- The recommendation for a dedicated `/agents` route (vs. enhancing the Mesh panel Agents tab) has architectural implications for the sidebar navigation and the existing `MeshPanel` component structure that would need careful design.

---

## Search Methodology

- Searches performed: 6 web searches
- Prior DorkOS research files read: 5 (agents-first-class-entity, mesh-topology-elevation, mesh-panel-ux-overhaul, dashboard-content-design-patterns, scheduler-dashboard-ui)
- Codebase files read: `MeshPanel.tsx`, `AgentCard.tsx` (both in `features/mesh/ui`)
- Most productive search terms: "table vs list vs cards UX developer tools 2025", "search filter UX small lists under 50 items instant filter"
- Primary source categories: Prior DorkOS research (highest relevance), UX Patterns for Developers, LogRocket UX blog, Adrian Roselli accessibility research, industry tool documentation (Headlamp, Kiali, Datadog)
