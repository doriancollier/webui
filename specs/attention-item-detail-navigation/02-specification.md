---
slug: attention-item-detail-navigation
number: 149
created: 2026-03-20
status: draft
---

# Attention Item Detail Navigation

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-03-20

## Overview

When users click "View" on attention items in the dashboard's "Needs Attention" section, the button currently opens a generic subsystem panel with no item specificity. This spec implements proper detail navigation: each "View" action opens a purpose-built Sheet showing the specific item's details and available actions, driven by TanStack Router search params for deep-linkable, back-button-friendly URLs.

## Background / Problem Statement

The dashboard's "Needs Attention" section surfaces four item types requiring user action:

1. **Stalled sessions** — sessions idle >30min (navigate to `/session` — already works correctly)
2. **Failed Pulse runs** — runs with `status: 'failed'` in the last 24h
3. **Dead Relay letters** — undeliverable messages grouped by source + reason
4. **Offline Mesh agents** — agents with `unreachable` status

For items 2-4, clicking "View" calls `setPulseOpen(true)` / `setRelayOpen(true)` / `setMeshOpen(true)` — opening the generic subsystem panel with no indication of which specific item triggered it. The user must then manually search for the item within the panel. This is the dashboard equivalent of "take me to the library" when the user asked for a specific book.

## Goals

- Clicking "View" on a dead letter, failed run, or offline agent opens a dedicated Sheet showing that item's details and available actions
- Detail navigation is deep-linkable via URL search params (e.g., `/?detail=dead-letter&itemId=abc`)
- Browser back button closes the Sheet and returns to the dashboard
- Each Sheet provides the primary action for resolving the item (dismiss, re-run, reconnect)
- Stalled sessions continue navigating to `/session?session=<id>` (unchanged)

## Non-Goals

- Modifying existing subsystem panel (Pulse/Relay/Mesh) internals
- Adding new server API endpoints — all data is already available client-side
- Batch actions on attention items
- Notification/alert system for new attention items
- Tool approval detail views (not currently in the attention section)

## Technical Dependencies

- `@tanstack/react-router` — search param validation via `zodValidator`
- `@tanstack/zod-adapter` — Zod schema adapter for route search params
- `zod` — search param schema validation
- `@/layers/shared/ui` — Sheet, Badge, Button, ScrollArea components (all exist)
- Entity hooks — `useRun()`, `useDeadLetters()`, `useMeshAgentHealth()`, `useDismissDeadLetterGroup()`, `useCancelRun()` (all exist)

## Detailed Design

### 1. Dashboard Route Search Schema

Add a validated search schema to the dashboard index route:

```typescript
// router.tsx — dashboard search schema
const dashboardSearchSchema = z.object({
  detail: z.enum(['dead-letter', 'failed-run', 'offline-agent']).optional(),
  itemId: z.string().optional(),
});

export type DashboardSearch = z.infer<typeof dashboardSearchSchema>;

const indexRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/',
  validateSearch: zodValidator(dashboardSearchSchema),
  component: DashboardPage,
  beforeLoad: ({ location }) => {
    // Existing ?session= redirect logic preserved
    const params = new URLSearchParams(location.searchStr);
    const session = params.get('session');
    if (session) {
      throw redirect({
        to: '/session',
        search: { session, dir: params.get('dir') ?? undefined },
      });
    }
  },
});
```

**Search param semantics:**

- `detail` — which Sheet to open (discriminated union)
- `itemId` — the specific item identifier within that Sheet type
- Both `undefined` → no Sheet open (default dashboard state)

### 2. Attention Item Action Handler Updates

Update `use-attention-items.ts` to navigate via search params instead of Zustand panel state:

```typescript
// For failed Pulse runs — navigate with search params
action: {
  label: 'View',
  onClick: () =>
    navigate({
      to: '/',
      search: (prev) => ({ ...prev, detail: 'failed-run', itemId: run.id }),
    }),
},

// For dead letters — navigate with search params
action: {
  label: 'View',
  onClick: () =>
    navigate({
      to: '/',
      search: (prev) => ({
        ...prev,
        detail: 'dead-letter',
        itemId: `${group.source}::${group.reason}`,
      }),
    }),
},

// For offline agents — navigate with search params
action: {
  label: 'View',
  onClick: () =>
    navigate({
      to: '/',
      search: (prev) => ({ ...prev, detail: 'offline-agent', itemId: 'offline' }),
    }),
},

// Stalled sessions — unchanged, keep existing /session navigation
action: {
  label: 'Open',
  onClick: () =>
    navigate({
      to: '/session',
      search: { session: session.id, dir: session.cwd ?? '' },
    }),
},
```

**Dead letter itemId encoding:** Dead letters are aggregated by `source::reason` pair, not by individual message ID. The `itemId` uses `${source}::${reason}` as a compound key. The Sheet splits on `::` to fetch the matching group.

**Offline agent itemId:** When `meshStatus.unreachableCount > 0`, the attention item represents "N agents offline" as a group. The Sheet shows all unreachable agents using existing `useRegisteredAgents()` filtered by status, rather than drilling into a single agent. The `itemId` is `'offline'` as a sentinel value.

**Zustand panel state removal:** The `setRelayOpen`, `setMeshOpen`, `setPulseOpen` imports are removed from `use-attention-items.ts` since attention items no longer use them. The subsystem cards in `SystemStatusRow.tsx` continue to use these for their own click handlers (unchanged).

### 3. Sheet Detail Components

Three new Sheet components in `features/dashboard-attention/ui/`:

#### 3a. DeadLetterDetailSheet

**File:** `apps/client/src/layers/features/dashboard-attention/ui/DeadLetterDetailSheet.tsx`

**Data source:** `useAggregatedDeadLetters()` from `@/layers/entities/relay`, filtered by the `source::reason` compound key from `itemId`.

**Content:**

- **Header:** "Dead Letters" title + source name subtitle
- **Summary row:** count + reason + first/last seen timestamps
- **Sample payload:** if `sample` exists, render as formatted JSON in a `<pre>` block with `text-xs font-mono` styling
- **Action:** "Dismiss Group" button using `useDismissDeadLetterGroup()` mutation — on success, close Sheet via navigate

```typescript
interface DeadLetterDetailSheetProps {
  open: boolean;
  itemId: string | undefined;
  onClose: () => void;
}
```

**Available data fields from `AggregatedDeadLetter`:**

| Field       | Rendering                  |
| ----------- | -------------------------- |
| `source`    | Subtitle text              |
| `reason`    | Badge with reason code     |
| `count`     | "N undeliverable messages" |
| `firstSeen` | Relative timestamp         |
| `lastSeen`  | Relative timestamp         |
| `sample`    | JSON code block (optional) |

#### 3b. FailedRunDetailSheet

**File:** `apps/client/src/layers/features/dashboard-attention/ui/FailedRunDetailSheet.tsx`

**Data source:** `useRun(itemId)` from `@/layers/entities/pulse` — fetches the individual run by ID.

**Content:**

- **Header:** "Failed Run" title + run ID subtitle (truncated to 8 chars)
- **Status badge:** red "Failed" badge
- **Trigger badge:** "Scheduled" or "Manual"
- **Timeline:** `startedAt` → `finishedAt` with formatted duration
- **Error message:** `error` field in a destructive alert/card
- **Output summary:** `outputSummary` in a scrollable `<pre>` block (if available)
- **Actions:**
  - "View Session" link (if `sessionId` exists) — navigates to `/session?session=<sessionId>`
  - "Cancel" button (if still running, via `useCancelRun()`)

```typescript
interface FailedRunDetailSheetProps {
  open: boolean;
  itemId: string | undefined;
  onClose: () => void;
}
```

**Available data fields from `PulseRun`:**

| Field           | Rendering                      |
| --------------- | ------------------------------ |
| `id`            | Subtitle (truncated)           |
| `status`        | Colored badge                  |
| `trigger`       | Badge ("Scheduled" / "Manual") |
| `startedAt`     | Formatted timestamp            |
| `finishedAt`    | Formatted timestamp            |
| `durationMs`    | Formatted duration             |
| `error`         | Error alert                    |
| `outputSummary` | Scrollable text area           |
| `sessionId`     | Link to session view           |

#### 3c. OfflineAgentDetailSheet

**File:** `apps/client/src/layers/features/dashboard-attention/ui/OfflineAgentDetailSheet.tsx`

**Data source:** `useRegisteredAgents()` from `@/layers/entities/mesh`, filtered to agents with `status === 'unreachable'`. Uses `useAgentVisual()` from `@/layers/entities/agent` for agent identity.

**Content:**

- **Header:** "Offline Agents" title + count subtitle
- **Agent list:** Each offline agent shows:
  - Agent emoji + color dot + name (via `useAgentVisual`)
  - Status badge: "Unreachable" in red
  - Last seen timestamp (relative)
  - Runtime badge (claude-code, cursor, etc.)
- **Empty state:** "All agents are online" with green checkmark (handles race condition where agents come back online before Sheet opens)

```typescript
interface OfflineAgentDetailSheetProps {
  open: boolean;
  onClose: () => void;
}
```

**Available data fields from `AgentHealth`:**

| Field           | Rendering             |
| --------------- | --------------------- |
| `name`          | Agent name with emoji |
| `status`        | Colored badge         |
| `lastSeenAt`    | Relative timestamp    |
| `lastSeenEvent` | Event type text       |
| `runtime`       | Badge                 |
| `registeredAt`  | Relative timestamp    |

### 4. DashboardPage Wiring

Update `DashboardPage` to read search params and render conditional Sheets:

```typescript
// DashboardPage.tsx
import { useSearch, useNavigate } from '@tanstack/react-router';
import { DeadLetterDetailSheet } from '@/layers/features/dashboard-attention';
import { FailedRunDetailSheet } from '@/layers/features/dashboard-attention';
import { OfflineAgentDetailSheet } from '@/layers/features/dashboard-attention';

export function DashboardPage() {
  const { detail, itemId } = useSearch({ strict: false });
  const navigate = useNavigate();

  const closeSheet = () =>
    navigate({
      to: '/',
      search: (prev) => ({ ...prev, detail: undefined, itemId: undefined }),
    });

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        <NeedsAttentionSection />
        <ActiveSessionsSection />
        <SystemStatusRow />
        <RecentActivityFeed />
      </div>

      <DeadLetterDetailSheet
        open={detail === 'dead-letter'}
        itemId={itemId}
        onClose={closeSheet}
      />
      <FailedRunDetailSheet
        open={detail === 'failed-run'}
        itemId={itemId}
        onClose={closeSheet}
      />
      <OfflineAgentDetailSheet
        open={detail === 'offline-agent'}
        onClose={closeSheet}
      />
    </ScrollArea>
  );
}
```

### 5. File Organization (FSD)

All new Sheet components live in the `dashboard-attention` feature module:

```
layers/features/dashboard-attention/
├── model/
│   └── use-attention-items.ts          # MODIFY — update action handlers
├── ui/
│   ├── AttentionItem.tsx               # NO CHANGE
│   ├── NeedsAttentionSection.tsx       # NO CHANGE
│   ├── DeadLetterDetailSheet.tsx       # NEW
│   ├── FailedRunDetailSheet.tsx        # NEW
│   └── OfflineAgentDetailSheet.tsx     # NEW
├── __tests__/
│   ├── use-attention-items.test.ts     # MODIFY — update action tests
│   ├── DeadLetterDetailSheet.test.tsx  # NEW
│   ├── FailedRunDetailSheet.test.tsx   # NEW
│   └── OfflineAgentDetailSheet.test.tsx # NEW
└── index.ts                            # MODIFY — export new components
```

**FSD layer compliance:** The Sheet components import from `entities/` (relay, pulse, mesh, agent) and `shared/` (ui) — this is allowed for a `features/` module. `DashboardPage` in `widgets/dashboard/` imports from `features/dashboard-attention/` — also allowed.

### 6. Sheet Design Patterns

All three Sheets follow consistent Calm Tech design:

- **Side:** `right` (consistent with existing subsystem panels)
- **Width:** default Sheet width (sm breakpoint — ~384px)
- **Animation:** Sheet's built-in slide animation (no custom motion)
- **Header pattern:** `SheetTitle` + `SheetDescription` (subtitle with context)
- **Content spacing:** `space-y-4` vertical rhythm
- **Timestamps:** relative format ("5m ago", "2h ago", "3d ago") — reuse `formatRelativeTime` from `AttentionItem.tsx` (extract to shared utility or import)
- **Badges:** use existing `Badge` component with appropriate variants
- **Code blocks:** `rounded-md bg-muted p-3 text-xs font-mono` for JSON/error output
- **Actions:** primary action in `SheetFooter`, destructive actions use `variant="destructive"`
- **Loading state:** Skeleton shimmer while data loads
- **Error state:** inline error message if fetch fails
- **Empty/resolved state:** if the item no longer exists (resolved between attention item render and Sheet open), show "This item has been resolved" with close button

## User Experience

### Flow: View Dead Letter

1. User sees "3 undeliverable Relay messages" in Needs Attention section
2. Clicks "View" button
3. URL updates to `/?detail=dead-letter&itemId=slack::hop_limit`
4. Sheet slides in from right showing: source (slack), reason (hop_limit), count (3), first/last seen, sample payload
5. User clicks "Dismiss Group" → mutation fires → Sheet closes → item disappears from Needs Attention
6. Alternatively, user presses Back or clicks X → Sheet closes → URL returns to `/`

### Flow: View Failed Run

1. User sees "Pulse run failed" in Needs Attention section
2. Clicks "View"
3. URL updates to `/?detail=failed-run&itemId=run_abc123`
4. Sheet shows: status badge, trigger type, timeline, error message, output summary
5. User clicks "View Session" → navigates to `/session?session=<sessionId>`
6. Or closes Sheet → returns to dashboard

### Flow: View Offline Agents

1. User sees "2 agents offline" in Needs Attention section
2. Clicks "View"
3. URL updates to `/?detail=offline-agent&itemId=offline`
4. Sheet shows list of unreachable agents with their last-seen times and runtime info
5. User can close Sheet to return to dashboard

### Flow: Deep Link

1. User shares URL `/?detail=dead-letter&itemId=slack::hop_limit`
2. Recipient opens URL → dashboard loads → Sheet opens automatically to the dead letter detail
3. If the dead letter has been resolved, Sheet shows "This item has been resolved"

## Testing Strategy

### Unit Tests

**`use-attention-items.test.ts` updates:**

- Verify failed run action calls `navigate` with `{ detail: 'failed-run', itemId: run.id }`
- Verify dead letter action calls `navigate` with `{ detail: 'dead-letter', itemId: 'source::reason' }`
- Verify offline agent action calls `navigate` with `{ detail: 'offline-agent', itemId: 'offline' }`
- Verify stalled session action still calls `navigate` with `{ to: '/session', search: { session: id, dir: cwd } }`
- Verify Zustand panel state setters are no longer called

**`DeadLetterDetailSheet.test.tsx`:**

- Renders dead letter details when `open=true` and matching data exists
- Shows dismiss button, clicking it calls `useDismissDeadLetterGroup` mutation
- Shows "resolved" state when no matching dead letter found
- Does not render when `open=false`

**`FailedRunDetailSheet.test.tsx`:**

- Renders run details (status, error, timeline) when data loads
- Shows "View Session" link when `sessionId` exists
- Hides "View Session" when `sessionId` is null
- Shows loading skeleton while `useRun()` is loading
- Shows error state when fetch fails

**`OfflineAgentDetailSheet.test.tsx`:**

- Renders list of unreachable agents
- Shows empty state when all agents are online
- Displays agent identity (emoji, color, name) via mock agent data

### Integration Tests

**Router integration:**

- Navigating to `/?detail=dead-letter&itemId=test` opens the Sheet
- Closing the Sheet clears search params back to `/`
- Invalid `detail` values are handled gracefully (Sheet stays closed)

## Performance Considerations

- **No new API calls in the hot path:** Sheets use existing entity hooks that are already cached by TanStack Query. The `useRun()` hook for individual run detail is the only potentially new fetch, and it's triggered on-demand (when Sheet opens).
- **Lazy rendering:** Sheets render their content only when `open=true`. The Sheet component itself handles this — content is not in the DOM when closed.
- **Search param parsing:** Zod validation adds negligible overhead (~0.1ms per route change).

## Security Considerations

- Search params are validated via Zod schema — arbitrary values for `detail` are rejected
- `itemId` is a free-form string validated only for presence — it's used as a lookup key against existing entity data, not passed to server APIs directly
- The compound key `source::reason` for dead letters uses `::` as delimiter — if source or reason contains `::`, the split will be incorrect. This is acceptable because source and reason are server-generated values that don't contain `::`.

## Documentation

- Update `contributing/project-structure.md` to document the new Sheet components in `dashboard-attention`
- No external documentation needed — this is internal UI behavior

## Implementation Phases

### Phase 1: Foundation (P1)

1. Add `dashboardSearchSchema` to `router.tsx` index route with `validateSearch`
2. Export `DashboardSearch` type
3. Extract `formatRelativeTime` from `AttentionItem.tsx` to a shared utility in `dashboard-attention/lib/` (or keep as internal import)

### Phase 2: Sheet Components (P2)

4. Create `DeadLetterDetailSheet.tsx` with dismiss action
5. Create `FailedRunDetailSheet.tsx` with session link and error display
6. Create `OfflineAgentDetailSheet.tsx` with agent list
7. Update `dashboard-attention/index.ts` barrel to export new components

### Phase 3: Wiring (P3)

8. Update `use-attention-items.ts` — replace Zustand panel opens with search param navigation
9. Update `DashboardPage.tsx` — read search params and render conditional Sheets
10. Remove unused Zustand imports from `use-attention-items.ts`

### Phase 4: Tests (P4)

11. Update `use-attention-items.test.ts` for new navigation behavior
12. Add `DeadLetterDetailSheet.test.tsx`
13. Add `FailedRunDetailSheet.test.tsx`
14. Add `OfflineAgentDetailSheet.test.tsx`

## Open Questions

None — all decisions resolved during ideation.

## Related ADRs

- ADR-0043: Agent Storage (file-first write-through pattern)
- Dashboard Content spec (#147) — established the Needs Attention section architecture

## References

- Ideation: `specs/attention-item-detail-navigation/01-ideation.md`
- Research: `research/20260320_attention_item_detail_navigation.md`
- Dashboard content spec: `specs/dashboard-content/02-specification.md`
- TanStack Router search params: https://tanstack.com/router/latest/docs/guide/search-params
