# Settings Tabs & Status Bar — Task Breakdown

**Spec:** `specs/settings-tabs-status-bar/02-specification.md`
**Feature Slug:** `settings-tabs-status-bar`
**Generated:** 2026-02-13

---

## Phase 1: Foundation

### Task 1.1: Create tabs.tsx UI component + install dependency

**Status:** TODO
**Files:** `apps/client/package.json`, `apps/client/src/components/ui/tabs.tsx`
**Blocked by:** None

#### Description

Install `@radix-ui/react-tabs` dependency and create the shadcn/ui-style Tabs wrapper component with 4 exports (Tabs, TabsList, TabsTrigger, TabsContent). Follow the existing pattern from `switch.tsx` (Radix primitive + `cn()` + `forwardRef` + `displayName`).

#### Implementation

**Step 1:** Add `@radix-ui/react-tabs` to `apps/client/package.json` dependencies:

```bash
cd apps/client && npm install @radix-ui/react-tabs
```

Note: The `radix-ui` umbrella package v1.4.3 is already installed and includes tabs in the lockfile. We just need the explicit dependency entry.

**Step 2:** Create `apps/client/src/components/ui/tabs.tsx` with the following content:

```typescript
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

#### Acceptance Criteria
- `@radix-ui/react-tabs` is listed in `apps/client/package.json` dependencies
- `tabs.tsx` exports `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- Component follows the same `forwardRef` + `cn()` + `displayName` pattern as `switch.tsx`
- `npx turbo build --filter=@lifeos/client` passes

---

### Task 1.2: Add 5 status bar visibility toggles to app-store.ts

**Status:** TODO
**Files:** `apps/client/src/stores/app-store.ts`
**Blocked by:** None

#### Description

Add 5 new boolean preferences to the Zustand store for controlling status bar item visibility. Each follows the existing `autoHideToolCalls` pattern: default `true`, localStorage persistence, getter reads on init, setter writes to localStorage + updates state. Also update `resetPreferences()` to clear and reset all 5 new fields.

#### Implementation

**Step 1:** Add 5 new fields to the `AppState` interface (after `verboseLogging` / `setVerboseLogging`):

```typescript
showStatusBarCwd: boolean;
setShowStatusBarCwd: (v: boolean) => void;
showStatusBarPermission: boolean;
setShowStatusBarPermission: (v: boolean) => void;
showStatusBarModel: boolean;
setShowStatusBarModel: (v: boolean) => void;
showStatusBarCost: boolean;
setShowStatusBarCost: (v: boolean) => void;
showStatusBarContext: boolean;
setShowStatusBarContext: (v: boolean) => void;
```

**Step 2:** Add getters and setters in the store implementation (after `setVerboseLogging`). Each follows the `autoHideToolCalls` pattern (default `true`, stored as `!== 'false'`):

```typescript
showStatusBarCwd: (() => {
  try { return localStorage.getItem('gateway-show-status-bar-cwd') !== 'false'; }
  catch { return true; }
})(),
setShowStatusBarCwd: (v) => {
  try { localStorage.setItem('gateway-show-status-bar-cwd', String(v)); } catch {}
  set({ showStatusBarCwd: v });
},

showStatusBarPermission: (() => {
  try { return localStorage.getItem('gateway-show-status-bar-permission') !== 'false'; }
  catch { return true; }
})(),
setShowStatusBarPermission: (v) => {
  try { localStorage.setItem('gateway-show-status-bar-permission', String(v)); } catch {}
  set({ showStatusBarPermission: v });
},

showStatusBarModel: (() => {
  try { return localStorage.getItem('gateway-show-status-bar-model') !== 'false'; }
  catch { return true; }
})(),
setShowStatusBarModel: (v) => {
  try { localStorage.setItem('gateway-show-status-bar-model', String(v)); } catch {}
  set({ showStatusBarModel: v });
},

showStatusBarCost: (() => {
  try { return localStorage.getItem('gateway-show-status-bar-cost') !== 'false'; }
  catch { return true; }
})(),
setShowStatusBarCost: (v) => {
  try { localStorage.setItem('gateway-show-status-bar-cost', String(v)); } catch {}
  set({ showStatusBarCost: v });
},

showStatusBarContext: (() => {
  try { return localStorage.getItem('gateway-show-status-bar-context') !== 'false'; }
  catch { return true; }
})(),
setShowStatusBarContext: (v) => {
  try { localStorage.setItem('gateway-show-status-bar-context', String(v)); } catch {}
  set({ showStatusBarContext: v });
},
```

**Step 3:** Update `resetPreferences()` to include the 5 new localStorage keys and reset values:

Add to the `try` block's `localStorage.removeItem` calls:
```typescript
localStorage.removeItem('gateway-show-status-bar-cwd');
localStorage.removeItem('gateway-show-status-bar-permission');
localStorage.removeItem('gateway-show-status-bar-model');
localStorage.removeItem('gateway-show-status-bar-cost');
localStorage.removeItem('gateway-show-status-bar-context');
```

Add to the `set()` call:
```typescript
showStatusBarCwd: true,
showStatusBarPermission: true,
showStatusBarModel: true,
showStatusBarCost: true,
showStatusBarContext: true,
```

#### Acceptance Criteria
- All 5 boolean fields exist in `AppState` interface with corresponding setters
- Initial values default to `true` (read from localStorage, fallback `true`)
- Setters persist to localStorage and update Zustand state
- `resetPreferences()` removes all 5 localStorage keys and resets fields to `true`
- TypeScript compiles without errors

---

## Phase 2: Integration

### Task 2.1: Restructure SettingsDialog with tabs + Status Bar tab content

**Status:** TODO
**Files:** `apps/client/src/components/settings/SettingsDialog.tsx`
**Blocked by:** Task 1.1 (tabs component), Task 1.2 (store fields)

#### Description

Restructure the SettingsDialog from a flat scrollable layout with two sections (Preferences + Server separated by a `<Separator />`) into a tabbed layout with three tabs: Preferences, Status Bar, and Server. The Preferences tab contains all existing preference controls unchanged. The Status Bar tab contains 5 new toggle switches for status bar item visibility. The Server tab contains the existing server config content unchanged.

#### Implementation

**Step 1:** Add new imports at the top of the file:

```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
```

**Step 2:** Remove the `Separator` import (no longer needed):

```typescript
// REMOVE: import { Separator } from '@/components/ui/separator';
```

**Step 3:** Add tab state inside the `SettingsDialog` function (after the existing `useAppStore()` destructure):

```typescript
const [activeTab, setActiveTab] = useState('preferences');
```

**Step 4:** Expand the `useAppStore()` destructure to include status bar toggles:

```typescript
const {
  showTimestamps, setShowTimestamps,
  expandToolCalls, setExpandToolCalls,
  autoHideToolCalls, setAutoHideToolCalls,
  devtoolsOpen, toggleDevtools,
  verboseLogging, setVerboseLogging,
  fontSize, setFontSize,
  resetPreferences,
  showStatusBarCwd, setShowStatusBarCwd,
  showStatusBarPermission, setShowStatusBarPermission,
  showStatusBarModel, setShowStatusBarModel,
  showStatusBarCost, setShowStatusBarCost,
  showStatusBarContext, setShowStatusBarContext,
} = useAppStore();
```

**Step 5:** Replace the entire content `<div>` (line 57-180 in current file) with the tabbed layout. The outer `<div className="overflow-y-auto flex-1 p-4 space-y-6">` becomes:

```tsx
<Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
  <TabsList className="grid w-full grid-cols-3 mx-4 mt-3" style={{ width: 'calc(100% - 2rem)' }}>
    <TabsTrigger value="preferences">Preferences</TabsTrigger>
    <TabsTrigger value="statusBar">Status Bar</TabsTrigger>
    <TabsTrigger value="server">Server</TabsTrigger>
  </TabsList>

  <div className="overflow-y-auto flex-1 p-4 min-h-[280px]">
    <TabsContent value="preferences" className="mt-0 space-y-6">
      {/* Existing preferences content — all 7 SettingRow items + Reset header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Preferences</h3>
          <button
            onClick={() => { resetPreferences(); setTheme('system'); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            Reset to defaults
          </button>
        </div>

        <SettingRow label="Theme" description="Choose your preferred color scheme">
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label="Font size" description="Adjust the text size across the interface">
          <Select value={fontSize} onValueChange={(v) => setFontSize(v as 'small' | 'medium' | 'large')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label="Show timestamps" description="Display message timestamps in chat">
          <Switch checked={showTimestamps} onCheckedChange={setShowTimestamps} />
        </SettingRow>

        <SettingRow label="Expand tool calls" description="Auto-expand tool call details in messages">
          <Switch checked={expandToolCalls} onCheckedChange={setExpandToolCalls} />
        </SettingRow>

        <SettingRow label="Auto-hide tool calls" description="Fade out completed tool calls after a few seconds">
          <Switch checked={autoHideToolCalls} onCheckedChange={setAutoHideToolCalls} />
        </SettingRow>

        <SettingRow label="Show dev tools" description="Enable developer tools panel">
          <Switch checked={devtoolsOpen} onCheckedChange={() => toggleDevtools()} />
        </SettingRow>

        <SettingRow label="Verbose logging" description="Show detailed logs in the console">
          <Switch checked={verboseLogging} onCheckedChange={setVerboseLogging} />
        </SettingRow>
      </div>
    </TabsContent>

    <TabsContent value="statusBar" className="mt-0 space-y-4">
      <SettingRow label="Show directory" description="Display current working directory">
        <Switch checked={showStatusBarCwd} onCheckedChange={setShowStatusBarCwd} />
      </SettingRow>
      <SettingRow label="Show permission mode" description="Display current permission setting">
        <Switch checked={showStatusBarPermission} onCheckedChange={setShowStatusBarPermission} />
      </SettingRow>
      <SettingRow label="Show model" description="Display selected AI model">
        <Switch checked={showStatusBarModel} onCheckedChange={setShowStatusBarModel} />
      </SettingRow>
      <SettingRow label="Show cost" description="Display session cost in USD">
        <Switch checked={showStatusBarCost} onCheckedChange={setShowStatusBarCost} />
      </SettingRow>
      <SettingRow label="Show context usage" description="Display context window utilization">
        <Switch checked={showStatusBarContext} onCheckedChange={setShowStatusBarContext} />
      </SettingRow>
    </TabsContent>

    <TabsContent value="server" className="mt-0 space-y-3">
      {/* Existing server config content — unchanged */}
      <h3 className="text-sm font-semibold text-foreground">Server</h3>
      {/* ... all existing server content (isLoading skeleton, config rows, etc.) ... */}
    </TabsContent>
  </div>
</Tabs>
```

**Step 6:** Remove the `<Separator />` that was between Preferences and Server sections (it is replaced by tabs).

**Key points:**
- The "Preferences" heading and "Reset to defaults" button stay inside the Preferences tab
- The "Server" heading stays inside the Server tab
- The `<Separator />` between sections is removed entirely
- `min-h-[280px]` on the scroll container prevents layout shifts between tabs
- Tab state persists across dialog open/close within the same page session (React state in parent)

#### Acceptance Criteria
- Dialog shows 3 horizontal tabs: Preferences, Status Bar, Server
- Preferences tab is selected by default and shows all 7 existing preference controls
- Status Bar tab shows 5 toggle switches (directory, permission mode, model, cost, context usage)
- Server tab shows the existing server config content unchanged
- No `<Separator />` between sections
- Tab selection persists across dialog open/close
- Tabs are keyboard-navigable (arrow keys, Enter/Space)
- `npx turbo build --filter=@lifeos/client` passes

---

### Task 2.2: Update StatusLine with conditional rendering + update tests

**Status:** TODO
**Files:** `apps/client/src/components/status/StatusLine.tsx`, `apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx`
**Blocked by:** Task 1.2 (store fields), Task 2.1 (settings dialog tabs)

#### Description

Update StatusLine to read the 5 visibility toggles from the app store and conditionally render each status bar item. Replace the current inline separator approach with a "collect visible items into array, render separators between them" pattern. When all items are hidden, return `null`. Also add 5 new test cases to the SettingsDialog test file for tab navigation and status bar toggles.

#### Implementation — StatusLine.tsx

**Step 1:** Add import for useAppStore:

```typescript
import { useAppStore } from '../../stores/app-store';
```

**Step 2:** Add React import for Fragment:

```typescript
import React from 'react';
```

**Step 3:** Inside the `StatusLine` component, read the 5 visibility toggles:

```typescript
const {
  showStatusBarCwd,
  showStatusBarPermission,
  showStatusBarModel,
  showStatusBarCost,
  showStatusBarContext,
} = useAppStore();
```

**Step 4:** Replace the entire return JSX with the items-array pattern:

```tsx
// Build array of visible items
const items: React.ReactNode[] = [];

if (showStatusBarCwd && status.cwd) {
  items.push(<CwdItem key="cwd" cwd={status.cwd} />);
}
if (showStatusBarPermission) {
  items.push(
    <PermissionModeItem
      key="permission"
      mode={status.permissionMode}
      onChangeMode={(mode) => status.updateSession({ permissionMode: mode })}
    />
  );
}
if (showStatusBarModel) {
  items.push(
    <ModelItem
      key="model"
      model={status.model}
      onChangeModel={(model) => status.updateSession({ model })}
    />
  );
}
if (showStatusBarCost && status.costUsd !== null) {
  items.push(<CostItem key="cost" costUsd={status.costUsd} />);
}
if (showStatusBarContext && status.contextPercent !== null) {
  items.push(<ContextItem key="context" percent={status.contextPercent} />);
}

// Don't render container if no items visible
if (items.length === 0) return null;

// Render with separators between items
return (
  <div
    role="toolbar"
    aria-label="Session status"
    aria-live="polite"
    className="flex flex-wrap items-center justify-center sm:justify-start gap-2 px-1 pt-2 text-xs text-muted-foreground whitespace-nowrap"
  >
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && <Separator />}
        {item}
      </React.Fragment>
    ))}
  </div>
);
```

The `Separator` local component stays unchanged.

#### Implementation — SettingsDialog.test.tsx

**Step 1:** Add `userEvent` import:

```typescript
import userEvent from '@testing-library/user-event';
```

**Step 2:** Add 5 new test cases inside the existing `describe('SettingsDialog')` block:

```typescript
// Purpose: Verify tab navigation structure renders correctly
it('renders three tabs: Preferences, Status Bar, Server', async () => {
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper: createWrapper() });
  expect(screen.getByRole('tab', { name: /preferences/i })).toBeDefined();
  expect(screen.getByRole('tab', { name: /status bar/i })).toBeDefined();
  expect(screen.getByRole('tab', { name: /server/i })).toBeDefined();
});

// Purpose: Verify Preferences tab is shown by default
it('shows Preferences tab content by default', async () => {
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper: createWrapper() });
  expect(screen.getByText(/theme/i)).toBeDefined();
  expect(screen.getByText(/font size/i)).toBeDefined();
});

// Purpose: Verify tab switching works and shows correct content
it('switches to Status Bar tab and shows toggle switches', async () => {
  const user = userEvent.setup();
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper: createWrapper() });

  await user.click(screen.getByRole('tab', { name: /status bar/i }));
  expect(screen.getByText(/show directory/i)).toBeDefined();
  expect(screen.getByText(/show permission mode/i)).toBeDefined();
  expect(screen.getByText(/show model/i)).toBeDefined();
  expect(screen.getByText(/show cost/i)).toBeDefined();
  expect(screen.getByText(/show context usage/i)).toBeDefined();
});

// Purpose: Verify status bar toggles default to ON
it('has all status bar toggles enabled by default', async () => {
  const user = userEvent.setup();
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper: createWrapper() });

  await user.click(screen.getByRole('tab', { name: /status bar/i }));
  const switches = screen.getAllByRole('switch');
  switches.forEach(sw => {
    expect(sw.getAttribute('data-state')).toBe('checked');
  });
});

// Purpose: Verify server tab content is accessible
it('switches to Server tab and shows config', async () => {
  const user = userEvent.setup();
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper: createWrapper() });

  await user.click(screen.getByRole('tab', { name: /server/i }));
  await screen.findByText(/version/i);
});
```

**Step 3:** Verify existing tests still pass. The `'displays all preference controls'` test should still work since Preferences is the default tab. The `'displays server configuration after loading'` test may need updating to first click the Server tab:

```typescript
// If this test breaks because server content is now behind the Server tab:
it('displays server configuration after loading', async () => {
  const user = userEvent.setup();
  const transport = createMockTransport();
  render(
    <SettingsDialog open={true} onOpenChange={vi.fn()} />,
    { wrapper: createWrapper(transport) },
  );
  // Click Server tab first
  await user.click(screen.getByRole('tab', { name: /server/i }));
  const version = await screen.findByText('1.0.0');
  expect(version).toBeDefined();
  expect(screen.getByText('6942')).toBeDefined();
  expect(screen.getByText('/home/user/project')).toBeDefined();
});
```

Similarly update `'shows badges for sensitive values instead of raw data'` and `'formats uptime as human-readable string'` to click the Server tab first.

#### Acceptance Criteria
- StatusLine reads 5 visibility toggles from useAppStore
- Each status bar item is conditionally rendered based on its toggle
- Separators only appear between visible items (no orphaned dots)
- When all items are toggled off (or no data), StatusLine returns `null`
- 5 new test cases pass: tab rendering, default tab, status bar tab switching, toggles default ON, server tab switching
- Existing tests updated to account for tabbed layout (click Server tab before checking server content)
- `npx turbo test` passes
- `npx turbo build` passes

---

## Dependency Graph

```
Task 1.1 (tabs.tsx) ──────┐
                           ├──→ Task 2.1 (SettingsDialog tabs) ──→ Task 2.2 (StatusLine + tests)
Task 1.2 (store toggles) ─┘                                   ──→ Task 2.2 (StatusLine + tests)
```

## Summary

| Task | Phase | Title | Blocked By | Files |
|------|-------|-------|------------|-------|
| 1.1 | 1 | Create tabs.tsx UI component + install dependency | — | `apps/client/package.json`, `apps/client/src/components/ui/tabs.tsx` |
| 1.2 | 1 | Add 5 status bar visibility toggles to app-store.ts | — | `apps/client/src/stores/app-store.ts` |
| 2.1 | 2 | Restructure SettingsDialog with tabs + Status Bar tab content | 1.1, 1.2 | `apps/client/src/components/settings/SettingsDialog.tsx` |
| 2.2 | 2 | Update StatusLine with conditional rendering + update tests | 1.2, 2.1 | `apps/client/src/components/status/StatusLine.tsx`, `apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx` |

**Total:** 4 tasks across 2 phases. All changes are client-side only (no server or shared package modifications).
