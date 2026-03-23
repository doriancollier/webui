---
slug: connections-tab-ux-improvements
number: 165
created: 2026-03-22
status: specified
authors: Claude Code
ideation: ./01-ideation.md
---

# ConnectionsTab UX Improvements

## Status

Specified

## Overview

Improve both ConnectionsTab components in the DorkOS client: the Relay adapter management surface (`features/relay`) and the Agent-Settings status display (`features/agent-settings`). This spec covers 8 complementary changes spanning UX improvements (empty states, responsive grid, binding row discoverability, actionable deep-links, relative time), code quality (AdapterCard decomposition, AdapterSetupWizard hook extraction), and functional enhancements (QuickBindingPopover agent filtering).

## Background / Problem Statement

The Relay ConnectionsTab was implemented in spec 132 (relay-panel-redesign) and refined in spec 134 (relay-panel-ux-fixes). While functional, several UX and code quality issues have accumulated:

1. **Passive empty state** — "No adapters configured yet." is a dead end with no CTA
2. **AdapterCard.tsx is 462 lines** — exceeds the 300-line file size limit, embedding 3 dialogs, 8 useState hooks, and 3 mutations inside a card component
3. **AdapterSetupWizard.tsx is 512 lines** — exceeds the 500-line hard limit, heavy form state management mixed with wizard UI
4. **Binding rows lack edit affordance** — clickable but the hover state is too subtle; users don't know they can click to edit
5. **Agent-Settings ConnectionsTab is entirely passive** — says "go configure in panel X" without linking, showing no actual data
6. **Forced 2-column grid** — CatalogCard grid uses `grid-cols-2` which cramps on narrow sidebar panels
7. **No auto-updating relative time** — timestamps use `toLocaleString()` or static `formatTimeAgo`, never refresh
8. **Dead code in QuickBindingPopover** — `void adapterId` suppresses unused prop that should filter agents

## Goals

- Decompose AdapterCard.tsx from 462 lines to under 300, with sub-components under 150 each
- Extract AdapterSetupWizard form state into a dedicated hook, reducing wizard to under 300 lines
- Transform the Agent-Settings ConnectionsTab from passive status display to actionable navigation hub
- Improve discoverability of binding row editing via hover affordances
- Replace passive empty states with action-focused CTAs
- Make the CatalogCard grid responsive to panel width
- Add auto-updating relative time for Mesh health and event timestamps
- Make QuickBindingPopover filter out already-bound agents

## Non-Goals

- New adapter types or binding API changes (backend unchanged)
- Wizard step consolidation (e.g., collapsing the Confirm step)
- Marketing site or external docs changes
- New e2e/browser tests (unit test coverage only)
- Moving hooks between FSD layers (entities stay as-is)

## Technical Dependencies

- No new external dependencies — all changes use existing libraries
- `motion/react` for AnimatePresence (already in bundle)
- `sonner` for toast notifications (already in bundle)
- `lucide-react` for icons (already in bundle)
- `@dorkos/shared/relay-schemas` for adapter types (no changes)

## Detailed Design

### 1. Empty State — Action-Focused CTA

**Current:** `<p>No adapters configured yet.</p>` (plain text)

**New:** Muted Plug icon + one-line explanation + single "Add Adapter" button. The CTA scrolls to or highlights the Available Adapters section below, since that section already has per-adapter "Add" buttons.

```tsx
// In ConnectionsTab, replace empty state paragraph:
{configuredCards.length === 0 ? (
  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-8">
    <Plug2 className="text-muted-foreground/40 size-8" />
    <div className="text-center">
      <p className="text-muted-foreground text-sm">No adapters configured</p>
      <p className="text-muted-foreground/60 text-xs">
        Add an adapter below to connect agents to external services
      </p>
    </div>
  </div>
) : (/* ... */)}
```

The text points downward to the "Available Adapters" section. No button needed — the CatalogCard "Add" buttons are directly below. This avoids duplicate CTAs and keeps the empty state minimal per Calm Tech principles.

### 2. AdapterCard Decomposition

**Current structure (462 lines, single file):**

- Header rendering (status dot, emoji, name, toggle, kebab menu)
- Subtitle (type + category badge)
- Body (binding rows with overflow, quick-bind)
- Footer (collapsible error)
- 3 inline dialogs (remove AlertDialog, events Sheet, BindingDialog)
- 8 useState hooks, 3 mutation hooks

**New structure:**

#### `AdapterCard.tsx` (~120 lines) — Display-only orchestrator

Props unchanged. Delegates rendering to sub-components and emits intent callbacks for dialog actions. Retains the `useBindings()` and `useRegisteredAgents()` data fetching since sub-components need it.

```tsx
export function AdapterCard({ instance, manifest, onToggle, onConfigure, onRemove }: AdapterCardProps) {
  // Data hooks stay here — shared across sub-components
  const { data: allBindings = [] } = useBindings();
  const { data: agentsData } = useRegisteredAgents();
  // ... binding computation, agent lookup

  return (
    <div className={cn('shadow-soft hover:shadow-elevated rounded-xl border p-5 transition-shadow', ...)}>
      <AdapterCardHeader
        manifest={manifest}
        instance={instance}
        primaryName={primaryName}
        secondaryName={secondaryName}
        statusDotClass={statusDotClass}
        onToggle={onToggle}
        onShowEvents={onShowEvents}
        onConfigure={onConfigure}
        onRemove={onRemove}
        onAddBinding={onAddBinding}
        isBuiltinClaude={isBuiltinClaude}
      />
      <AdapterCardBindings
        instance={instance}
        manifest={manifest}
        isBuiltinClaude={isBuiltinClaude}
        boundAgentRows={boundAgentRows}
        adapterBindings={adapterBindings}
        totalAgentCount={totalAgentCount}
        isConnected={isConnected}
        hasBindings={hasBindings}
        onEditBinding={onEditBinding}
        onQuickBind={handleQuickBind}
        onAdvancedBind={onAddBinding}
        createBindingPending={createBinding.isPending}
      />
      <AdapterCardError instance={instance} />
    </div>
  );
}
```

**Dialogs move to ConnectionsTab** — the parent component that already manages wizard state. ConnectionsTab gains a `useAdapterCardDialogs` hook managing remove, events, and binding dialog state:

```tsx
// In ConnectionsTab.tsx — new dialog state management
const dialogs = useAdapterCardDialogs();

// Each AdapterCard emits intents:
<AdapterCard
  onShowEvents={(instanceId) => dialogs.openEvents(instanceId)}
  onEditBinding={(binding) => dialogs.openBindingEdit(binding)}
  onRemoveConfirm={(instanceId, name) => dialogs.openRemove(instanceId, name)}
  onAddBinding={(instanceId, adapterId) => dialogs.openBindingCreate(instanceId, adapterId)}
  // ... existing props
/>

// Dialogs rendered at ConnectionsTab level (portaled, no z-index issues):
{dialogs.removeTarget && <AlertDialog ... />}
{dialogs.eventsTarget && <Sheet ... />}
{dialogs.bindingTarget && <BindingDialog ... />}
```

#### `AdapterCardHeader.tsx` (~80 lines) — Status, name, toggle, menu

Renders the card header row: status dot, emoji, primary/secondary name, toggle switch, and kebab dropdown menu. All actions are callbacks to the parent.

#### `AdapterCardBindings.tsx` (~90 lines) — Binding rows + quick-bind

Renders the body section: built-in CCA summary, binding rows with overflow (show more/less), and the QuickBindingPopover trigger. Handles only rendering logic — mutation callbacks come from props.

#### `AdapterCardError.tsx` (~50 lines) — Collapsible error footer

Renders the error indicator with collapsible full message. Pure display component — reads `instance.status.errorCount` and `instance.status.lastError`.

#### `useAdapterCardDialogs.ts` (~60 lines) — Dialog state hook

Custom hook managing which dialog is open and for which adapter instance:

```tsx
interface DialogState {
  removeTarget: { instanceId: string; name: string } | null;
  eventsTarget: { instanceId: string } | null;
  bindingTarget: { mode: 'create' | 'edit'; adapterId: string; binding?: AdapterBinding } | null;
}

export function useAdapterCardDialogs() {
  const [state, setState] = useState<DialogState>({
    removeTarget: null,
    eventsTarget: null,
    bindingTarget: null,
  });

  return {
    ...state,
    openRemove: (instanceId: string, name: string) =>
      setState((s) => ({ ...s, removeTarget: { instanceId, name } })),
    closeRemove: () => setState((s) => ({ ...s, removeTarget: null })),
    openEvents: (instanceId: string) => setState((s) => ({ ...s, eventsTarget: { instanceId } })),
    closeEvents: () => setState((s) => ({ ...s, eventsTarget: null })),
    openBindingCreate: (adapterId: string) =>
      setState((s) => ({ ...s, bindingTarget: { mode: 'create', adapterId } })),
    openBindingEdit: (adapterId: string, binding: AdapterBinding) =>
      setState((s) => ({ ...s, bindingTarget: { mode: 'edit', adapterId, binding } })),
    closeBinding: () => setState((s) => ({ ...s, bindingTarget: null })),
  };
}
```

### 3. AdapterSetupWizard Form State Extraction

**Current:** 512 lines with form state management (values, errors, validation, setupStepIndex, label, adapterId) mixed with wizard step rendering and dialog lifecycle.

**New structure:**

#### `use-adapter-setup-form.ts` (~150 lines)

Extracts into a hook:

- `values` / `setValues` state
- `errors` / `setErrors` state
- `label` / `setLabel` state
- `adapterId` (generated via `generateDefaultId`)
- `setupStepIndex` / `setSetupStepIndex` state
- `botUsername` / `setBotUsername` state
- `validate(fieldsToValidate)` function
- `handleFieldChange(key, value)` callback
- `visibleFields` memoized computation
- `unflattenConfig()` utility (exported for testing)
- `initializeValues()` utility (exported for testing)
- `generateDefaultId()` utility (exported for testing)

The hook returns a structured object:

```tsx
export function useAdapterSetupForm(
  manifest: AdapterManifest,
  existingInstance?: CatalogInstance & { config?: Record<string, unknown> },
  existingAdapterIds?: string[]
) {
  // ... all form state

  return {
    values,
    errors,
    label,
    setLabel,
    adapterId,
    setupStepIndex,
    setSetupStepIndex,
    botUsername,
    setBotUsername,
    visibleFields,
    handleFieldChange,
    validate,
    unflattenConfig: () => unflattenConfig(values as Record<string, unknown>),
    reset: () => {
      /* reset all state to initial */
    },
  };
}
```

#### `AdapterSetupWizard.tsx` (~250 lines)

Retains:

- Wizard step navigation (`step`, `handleContinue`, `handleBack`)
- Dialog rendering (DialogContent, DialogHeader, DialogFooter)
- Mutation orchestration (`handleSave`, `handleBind`, `handleSkipBind`)
- Bind step state (`createdAdapterId`, `bindAgentId`, `bindStrategy`)
- `SetupGuideSheet` rendering

Uses the form hook:

```tsx
const form = useAdapterSetupForm(manifest, existingInstance, existingAdapterIds);
```

### 4. Binding Row Discoverability — Group Hover + Chevron

**Current:** Binding rows use `group/row` naming but the only hover affordance is a subtle `hover:bg-muted/50` background. No visual indicator that the row is editable.

**New:** Add a ChevronRight icon that fades in on hover via `group-hover`:

```tsx
// In the binding row button (AdapterCardBindings.tsx):
<button
  type="button"
  className="group/row hover:bg-muted/50 flex w-full cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors"
  onClick={() => onEditBinding(binding)}
>
  <AdapterBindingRow
    agentName={row.agentName}
    sessionStrategy={row.sessionStrategy}
    // ... other props
  />
  <ChevronRight className="text-muted-foreground/50 size-3 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100" />
</button>
```

The chevron uses `opacity-0 group-hover/row:opacity-100` so it only appears on hover. The named group (`group/row`) prevents parent card hover from triggering the chevron.

### 5. Agent-Settings ConnectionsTab — Actionable Deep-Links

**Current:** 82 lines, 3 read-only sections with generic text.

**New:** Each section shows real data and a navigation button.

**App store actions (verified):**

- `setAgentDialogOpen(false)` — close the agent dialog
- `setRelayOpen(true)` — open Relay panel
- `openPulseForAgent(agentId)` — open Pulse panel filtered to this agent (sets `pulseAgentFilter` + `pulseOpen`)

**Data sources (verified):**

- `useSchedules(pulseEnabled)` from `@/layers/entities/pulse` — filter by `agentId` for count
- `useBindings()` from `@/layers/entities/binding` — filter by `agentId` for count
- `useMeshAgentHealth(agentId)` from `@/layers/entities/mesh` — real status

**Implementation:**

```tsx
export function ConnectionsTab({ agent }: ConnectionsTabProps) {
  const pulseEnabled = usePulseEnabled();
  const relayEnabled = useRelayEnabled();
  const { data: health } = useMeshAgentHealth(agent.id);
  const { data: schedules = [] } = useSchedules(pulseEnabled);
  const { data: bindings = [] } = useBindings();
  const { setAgentDialogOpen, setRelayOpen, openPulseForAgent } = useAppStore();

  const agentScheduleCount = schedules.filter((s) => s.agentId === agent.id).length;
  const agentBindingCount = bindings.filter((b) => b.agentId === agent.id).length;

  const navigateTo = (open: () => void) => {
    setAgentDialogOpen(false);
    // Small delay to let dialog close animation complete before opening new panel
    requestAnimationFrame(() => open());
  };

  return (
    <div className="space-y-6">
      {/* Pulse */}
      <SubsystemRow
        label="Pulse Schedules"
        enabled={pulseEnabled}
        summary={
          pulseEnabled
            ? agentScheduleCount > 0
              ? `${agentScheduleCount} ${agentScheduleCount === 1 ? 'schedule' : 'schedules'}`
              : 'No schedules'
            : undefined
        }
        action={
          pulseEnabled
            ? {
                label: 'View in Pulse',
                onClick: () => navigateTo(() => openPulseForAgent(agent.id)),
              }
            : undefined
        }
      />

      {/* Relay */}
      <SubsystemRow
        label="Relay Bindings"
        enabled={relayEnabled}
        summary={
          relayEnabled
            ? agentBindingCount > 0
              ? `${agentBindingCount} ${agentBindingCount === 1 ? 'binding' : 'bindings'}`
              : 'No bindings'
            : undefined
        }
        action={
          relayEnabled
            ? {
                label: 'View in Relay',
                onClick: () => navigateTo(() => setRelayOpen(true)),
              }
            : undefined
        }
      />

      {/* Mesh */}
      <SubsystemRow
        label="Mesh Health"
        enabled={true}
        status={
          health
            ? {
                state: health.status,
                lastSeenAt: health.lastSeenAt,
              }
            : undefined
        }
        loading={!health}
      />
    </div>
  );
}
```

**`SubsystemRow` component** (~60 lines) — Extracted shared UI for the 3 sections:

```tsx
interface SubsystemRowProps {
  label: string;
  enabled: boolean;
  summary?: string;
  status?: { state: string; lastSeenAt?: string };
  loading?: boolean;
  action?: { label: string; onClick: () => void };
}

function SubsystemRow({ label, enabled, summary, status, loading, action }: SubsystemRowProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{label}</h3>
          <Badge variant={enabled ? 'default' : 'secondary'} className="text-xs">
            {enabled ? (status?.state ?? 'Enabled') : 'Disabled'}
          </Badge>
        </div>
        {action && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 gap-1 text-xs"
            onClick={action.onClick}
          >
            {action.label}
            <ArrowUpRight className="size-3" />
          </Button>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-4 w-48" />
      ) : summary ? (
        <p className="text-muted-foreground text-sm">{summary}</p>
      ) : status?.lastSeenAt ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Last seen</span>
          <RelativeTime dateStr={status.lastSeenAt} />
        </div>
      ) : null}
    </section>
  );
}
```

### 6. Responsive Catalog Grid

**Current:** `<div className="grid grid-cols-2 gap-2">`

**New:** Use CSS auto-fill for responsive behavior:

```tsx
<div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
```

This produces 1 column when the panel is under ~500px wide (typical sidebar) and 2 columns when space allows. The inline style is used because Tailwind v4 doesn't have a built-in utility for `auto-fill` with `minmax`. The configured adapter list (AdapterCard) keeps single-column layout (no change needed).

### 7. Relative Time — Enhanced formatTimeAgo + useAutoRelativeTime

#### `format-time.ts` enhancement

Add "just now" for timestamps under 1 minute:

```tsx
export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

#### `use-auto-relative-time.ts` (~30 lines)

Hook that auto-refreshes relative time strings with adaptive intervals:

```tsx
export function useAutoRelativeTime(dateStr: string | undefined): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!dateStr) return;
    const age = Date.now() - new Date(dateStr).getTime();
    const interval =
      age < 60_000
        ? 10_000 // < 1 min: refresh every 10s
        : age < 3_600_000
          ? 60_000 // < 1 hr: refresh every minute
          : 3_600_000; // older: refresh every hour

    const timer = setInterval(() => setTick((t) => t + 1), interval);
    return () => clearInterval(timer);
  }, [dateStr]);

  return dateStr ? formatTimeAgo(dateStr) : '';
}
```

#### `RelativeTime` component (~15 lines)

Wraps the hook output in a semantic `<time>` element:

```tsx
export function RelativeTime({ dateStr }: { dateStr: string }) {
  const relativeLabel = useAutoRelativeTime(dateStr);
  const date = new Date(dateStr);

  return (
    <time
      dateTime={date.toISOString()}
      title={date.toLocaleString()}
      className="text-muted-foreground text-xs"
    >
      {relativeLabel}
    </time>
  );
}
```

Used in Agent-Settings Mesh health row and available for AdapterEventLog timestamps.

### 8. QuickBindingPopover Agent Filtering

**Current:** `void adapterId` — dead code, all agents shown regardless.

**New:** Filter out agents that already have a binding to this specific adapter:

```tsx
export function QuickBindingPopover({
  adapterId,
  onQuickBind,
  onAdvanced,
  isPending,
  children,
}: QuickBindingPopoverProps) {
  const [open, setOpen] = useState(false);
  const { data: agentsData } = useRegisteredAgents();
  const { data: allBindings = [] } = useBindings();

  const agents = agentsData?.agents ?? [];

  // Filter out agents already bound to this adapter
  const boundAgentIds = new Set(
    allBindings.filter((b) => b.adapterId === adapterId).map((b) => b.agentId)
  );
  const unboundAgents = agents.filter((a) => !boundAgentIds.has(a.id));

  // ... rest of component

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search agents..." />
          <CommandList>
            <CommandEmpty>
              {agents.length === 0 ? 'No agents registered' : 'All agents bound'}
            </CommandEmpty>
            {unboundAgents.map((agent) => (
              <CommandItem
                key={agent.id}
                value={agent.name}
                onSelect={() => handleSelect(agent.id)}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
                {agent.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
        <div className="border-t px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground w-full text-xs"
            onClick={handleAdvanced}
          >
            Advanced...
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

## File Organization

### Modified Files

| File                                            | Current Lines | After | Changes                                                     |
| ----------------------------------------------- | ------------- | ----- | ----------------------------------------------------------- |
| `features/relay/ui/ConnectionsTab.tsx`          | 157           | ~220  | Empty state, responsive grid, host dialogs from AdapterCard |
| `features/relay/ui/AdapterCard.tsx`             | 462           | ~120  | Display-only orchestrator, dialogs removed                  |
| `features/relay/ui/AdapterSetupWizard.tsx`      | 512           | ~250  | Form state extracted to hook                                |
| `features/relay/ui/AdapterBindingRow.tsx`       | 86            | 86    | No changes (chevron added in parent button wrapper)         |
| `features/relay/ui/QuickBindingPopover.tsx`     | 94            | ~90   | Agent filtering, remove dead code                           |
| `features/relay/lib/format-time.ts`             | 11            | ~15   | Add "just now" threshold                                    |
| `features/relay/index.ts`                       | ~30           | ~35   | Export new sub-components                                   |
| `features/agent-settings/ui/ConnectionsTab.tsx` | 82            | ~100  | Deep-links, real data, SubsystemRow                         |

### New Files

| File                                               | Lines | Purpose                                        |
| -------------------------------------------------- | ----- | ---------------------------------------------- |
| `features/relay/ui/AdapterCardHeader.tsx`          | ~80   | Status dot, emoji, name, toggle, kebab menu    |
| `features/relay/ui/AdapterCardBindings.tsx`        | ~90   | Binding rows with overflow, quick-bind trigger |
| `features/relay/ui/AdapterCardError.tsx`           | ~50   | Collapsible error footer                       |
| `features/relay/model/use-adapter-card-dialogs.ts` | ~60   | Dialog state management hook                   |
| `features/relay/model/use-adapter-setup-form.ts`   | ~150  | Wizard form state hook                         |
| `features/relay/model/use-auto-relative-time.ts`   | ~30   | Auto-updating relative time hook               |

## User Experience

### Relay ConnectionsTab

**Before:** Passive empty state, static 2-col grid, binding rows appear non-interactive, card contains hidden dialogs.

**After:**

- Empty state guides user to available adapters section with clear visual cue
- CatalogCard grid adapts to panel width (1-col in narrow sidebar, 2-col when wide)
- Binding rows show a subtle chevron on hover, signaling editability
- Card is lighter (display-only), dialogs render at parent level

### Agent-Settings ConnectionsTab

**Before:** Three identical read-only sections saying "go configure elsewhere" with no links.

**After:**

- Pulse row shows schedule count with "View in Pulse" deep-link button
- Relay row shows binding count with "View in Relay" deep-link button
- Mesh row shows real health status with auto-updating relative time
- Clicking a deep-link closes the agent dialog and opens the target panel
- Loading state uses skeleton instead of text

## Testing Strategy

### Existing Test Updates

**`features/relay/__tests__/AdapterCard.test.tsx` (598 lines)**

This test file needs restructuring for the decomposed components:

1. **Keep:** Tests for AdapterCard rendering (status dot colors, primary/secondary name, toggle, bindings)
2. **Move dialog tests** to a new `ConnectionsTab.test.tsx` since dialogs now live in ConnectionsTab
3. **Add:** Tests for sub-component rendering in isolation:
   - `AdapterCardHeader` renders correct status dot class, handles toggle callback
   - `AdapterCardBindings` shows overflow logic, handles edit/quick-bind callbacks
   - `AdapterCardError` renders collapsible error message

**Mocking pattern (from existing tests):**

```tsx
vi.mock('@/layers/entities/binding', () => ({
  useBindings: (...args: unknown[]) => mockUseBindings(...args),
  useCreateBinding: () => ({ mutate: mockMutate, mutateAsync: mockMutateAsync, isPending: false }),
  // ...
}));
```

### New Tests

**`features/relay/__tests__/ConnectionsTab.test.tsx`**

- Renders empty state when no adapters configured (icon + text visible)
- Renders configured adapter cards when data present
- Renders responsive catalog grid
- Opens wizard when CatalogCard "Add" clicked
- Dialog lifecycle: remove confirmation, events sheet, binding dialog
- Purpose: Validates the parent-level dialog hosting after extraction from AdapterCard

**`features/relay/__tests__/use-adapter-setup-form.test.ts`**

- `initializeValues` returns defaults for new adapters
- `initializeValues` uses existing config for edit mode (password sentinel)
- `validate` catches required empty fields
- `validate` respects `showWhen` conditions
- `handleFieldChange` clears field error
- `generateDefaultId` returns non-colliding IDs
- `unflattenConfig` converts dot-notation to nested objects
- Purpose: Tests form logic in isolation without wizard rendering overhead

**`features/relay/__tests__/use-auto-relative-time.test.ts`**

- Returns "just now" for timestamps under 1 minute
- Returns "Xm ago" for timestamps under 1 hour
- Auto-refreshes at correct intervals (mock timers)
- Returns empty string for undefined input
- Purpose: Validates adaptive refresh intervals don't leak timers

**`features/agent-settings/__tests__/ConnectionsTab.test.tsx`**

- Renders Pulse row with schedule count when enabled
- Renders Relay row with binding count when enabled
- Shows "Disabled" badge when subsystem is off
- Renders skeleton while health is loading
- Deep-link button calls setAgentDialogOpen(false) then opens target panel
- Mesh row shows real status badge from health query
- Purpose: Validates the transformation from passive display to actionable hub

**`features/relay/__tests__/QuickBindingPopover.test.tsx`**

- Filters out agents already bound to this adapter
- Shows "All agents bound" when no unbound agents remain
- Shows "No agents registered" when agent list is empty
- Calls onQuickBind with correct agentId on selection
- Purpose: Validates the new filtering logic

### Mocking Strategies

- **App store:** `vi.mock('@/layers/shared/model')` with mock actions for `setAgentDialogOpen`, `setRelayOpen`, `openPulseForAgent`
- **Entity hooks:** Same pattern as existing AdapterCard.test.tsx — `vi.mock` with factory functions returning mock data
- **Timer mocks:** `vi.useFakeTimers()` for `useAutoRelativeTime` interval testing
- **Child components:** Stub complex children (BindingDialog, AdapterEventLog) to avoid deep rendering

## Performance Considerations

- **useAutoRelativeTime** uses adaptive intervals (10s/60s/1hr) to avoid unnecessary re-renders. The timer is cleaned up on unmount.
- **useBindings()** called in QuickBindingPopover adds one TanStack Query subscription per popover instance. This is cached and shared across the app — no additional network requests since bindings are already fetched by AdapterCard.
- **Agent-Settings** adds `useSchedules()` and `useBindings()` queries. Both are already cached by TanStack Query from other panels. No new API calls unless the agent-settings tab is opened before Pulse/Relay panels.
- **Dialog extraction** from AdapterCard to ConnectionsTab means dialog components are only mounted when needed (conditional rendering), same as before but at a higher level.

## Security Considerations

No security implications. All changes are client-side UI — no new API endpoints, no new data exposure, no authentication changes.

## Documentation

No external documentation updates needed. The changes are internal UI improvements. The `contributing/` guides remain accurate:

- `contributing/design-system.md` — follows Calm Tech patterns
- `contributing/state-management.md` — follows Zustand/TanStack Query patterns

## Implementation Phases

### Phase 1: Code Quality Refactors

Extract and decompose without changing visible behavior:

1. **AdapterCard decomposition** — Split into AdapterCardHeader, AdapterCardBindings, AdapterCardError. Move dialogs to ConnectionsTab. Create `useAdapterCardDialogs` hook.
2. **AdapterSetupWizard extraction** — Create `useAdapterSetupForm` hook. Update wizard to use it.
3. **Update existing tests** — Adapt AdapterCard.test.tsx for new structure. Add new test files.

All visible behavior unchanged after Phase 1.

### Phase 2: UX Improvements

Apply visible UX changes:

4. **Empty state** — Replace passive text with icon + description
5. **Responsive grid** — Replace `grid-cols-2` with `auto-fill`
6. **Binding row chevron** — Add `group-hover` ChevronRight
7. **Relative time** — Enhance `formatTimeAgo`, create `useAutoRelativeTime` hook and `RelativeTime` component
8. **QuickBindingPopover filtering** — Implement agent filtering, remove dead code

### Phase 3: Agent-Settings Deep-Links

Transform the Agent-Settings ConnectionsTab:

9. **SubsystemRow component** — Extract shared section UI
10. **Real data** — Show schedule/binding counts from entity hooks
11. **Deep-link navigation** — Close dialog, open target panel via app store
12. **Skeleton loading** — Replace text with Skeleton components
13. **Mesh real status** — Derive from health query, use RelativeTime
14. **Add ConnectionsTab tests** for both features

## Open Questions

None. All decisions resolved during ideation:

1. Deep-link behavior → Navigate + close dialog (via app store)
2. Wizard scope → Include form state extraction
3. Relative time → Enhance existing utility, zero new deps
4. QuickBindingPopover → Implement agent filtering

## Related ADRs

No directly constraining ADRs. The implementation follows established patterns from:

- Spec 132 (relay-panel-redesign) — current component structure
- Spec 134 (relay-panel-ux-fixes) — binding CRUD patterns
- `.claude/rules/file-size.md` — file size limits driving decomposition

## References

- `specs/connections-tab-ux-improvements/01-ideation.md` — ideation document
- `research/20260322_connections_tab_ux_best_practices.md` — UX research (empty states, decomposition, responsive grids, relative time)
- `research/20260311_adapter_binding_ux_overhaul_gaps.md` — status model, Datadog/Stripe patterns
- App store: `apps/client/src/layers/shared/model/app-store.ts` — verified actions: `setRelayOpen`, `setPulseOpen`, `setAgentDialogOpen`, `openPulseForAgent`
- DialogHost: `apps/client/src/layers/widgets/app-layout/ui/DialogHost.tsx` — panel rendering
