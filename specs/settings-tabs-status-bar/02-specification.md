# Settings Tabs & Status Bar Configuration

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-13
**Slug:** settings-tabs-status-bar

---

## 1. Overview

Restructure the SettingsDialog from a single scrollable view with two inline sections (Preferences + Server) into a tabbed layout with three tabs: **Preferences**, **Status Bar**, and **Server**. The new Status Bar tab provides 5 toggle switches that control visibility of each item in the StatusLine component.

## 2. Background / Problem Statement

The settings dialog currently uses a flat scrollable layout with two sections separated by a `<Separator />`. As the application grows, more configuration surfaces will be added (context files, system prompt overrides, etc.), making the single-scroll layout unwieldy. Additionally, users have no way to customize the status bar — all items are always shown (or hidden only by data availability), with no user preference control.

Tabs solve both problems: they organize growing settings into discoverable categories and provide a natural home for new configuration sections as they're added.

## 3. Goals

- Reorganize the settings dialog into a 3-tab layout (Preferences / Status Bar / Server)
- Allow users to toggle each of the 5 status bar items on/off independently
- Maintain all existing settings functionality unchanged
- Establish a tab pattern that accommodates future settings sections
- Persist status bar visibility preferences to localStorage

## 4. Non-Goals

- Sidebar navigation (overkill for 3-6 sections)
- New "Context Files" or "System Prompt" tabs (future work)
- Rethinking Server info section content
- Mobile-specific tab variants (standard horizontal tabs work in both Dialog and Drawer)
- Per-tab "Reset to defaults" buttons
- Configurable status bar item order

## 5. Technical Dependencies

| Dependency               | Version  | Purpose                                        |
| ------------------------ | -------- | ---------------------------------------------- |
| `@radix-ui/react-tabs`   | ^1.1.13  | Tab primitives (Root, List, Trigger, Content)  |
| `@radix-ui/react-switch` | ^1.2.6   | Toggle switches (already installed)            |
| `zustand`                | existing | State management with localStorage persistence |
| `@tanstack/react-query`  | existing | Server config fetching (unchanged)             |

**Note:** The `radix-ui` umbrella package v1.4.3 is already installed and includes tabs in the lockfile. We just need to add the explicit `@radix-ui/react-tabs` dependency to `apps/client/package.json`.

## 6. Detailed Design

### 6.1 New UI Component: `tabs.tsx`

**File:** `apps/client/src/components/ui/tabs.tsx` (CREATE)

Standard shadcn/ui wrapper around Radix Tabs primitives. Four exports:

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

### 6.2 Zustand Store Extensions

**File:** `apps/client/src/stores/app-store.ts` (MODIFY)

Add 5 new boolean preferences following the existing `autoHideToolCalls` pattern (default `true`, stored as `!== 'false'`):

**New State Fields:**

| Field                     | Type      | Storage Key                          | Default |
| ------------------------- | --------- | ------------------------------------ | ------- |
| `showStatusBarCwd`        | `boolean` | `gateway-show-status-bar-cwd`        | `true`  |
| `showStatusBarPermission` | `boolean` | `gateway-show-status-bar-permission` | `true`  |
| `showStatusBarModel`      | `boolean` | `gateway-show-status-bar-model`      | `true`  |
| `showStatusBarCost`       | `boolean` | `gateway-show-status-bar-cost`       | `true`  |
| `showStatusBarContext`    | `boolean` | `gateway-show-status-bar-context`    | `true`  |

**Getter pattern** (same as `autoHideToolCalls`):

```typescript
showStatusBarCwd: (() => {
  try { return localStorage.getItem('gateway-show-status-bar-cwd') !== 'false'; }
  catch { return true; }
})(),
```

**Setter pattern:**

```typescript
setShowStatusBarCwd: (v) => {
  try { localStorage.setItem('gateway-show-status-bar-cwd', String(v)); } catch {}
  set({ showStatusBarCwd: v });
},
```

**Update `resetPreferences()`** — add 5 new `localStorage.removeItem()` calls and reset all 5 fields to `true`:

```typescript
resetPreferences: () => {
  try {
    // ... existing removeItem calls ...
    localStorage.removeItem('gateway-show-status-bar-cwd');
    localStorage.removeItem('gateway-show-status-bar-permission');
    localStorage.removeItem('gateway-show-status-bar-model');
    localStorage.removeItem('gateway-show-status-bar-cost');
    localStorage.removeItem('gateway-show-status-bar-context');
  } catch {}
  // ... existing resets ...
  set({
    // ... existing reset values ...
    showStatusBarCwd: true,
    showStatusBarPermission: true,
    showStatusBarModel: true,
    showStatusBarCost: true,
    showStatusBarContext: true,
  });
},
```

### 6.3 SettingsDialog Restructure

**File:** `apps/client/src/components/settings/SettingsDialog.tsx` (MODIFY)

**Key changes:**

1. **Import Tabs components:**

   ```typescript
   import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
   ```

2. **Add tab state** — controlled `value`/`onValueChange` with `useState` inside SettingsDialog itself:

   ```typescript
   const [activeTab, setActiveTab] = useState('preferences');
   ```

   This persists across open/close (React state survives unmount if parent stays mounted, which it does since SessionSidebar stays mounted). Resets on page refresh.

3. **Add status bar store access:**

   ```typescript
   const {
     // ... existing destructuring ...
     showStatusBarCwd,
     setShowStatusBarCwd,
     showStatusBarPermission,
     setShowStatusBarPermission,
     showStatusBarModel,
     setShowStatusBarModel,
     showStatusBarCost,
     setShowStatusBarCost,
     showStatusBarContext,
     setShowStatusBarContext,
   } = useAppStore();
   ```

4. **Replace content layout** — the current `<div className="overflow-y-auto flex-1 p-4 space-y-6">` wrapping both sections becomes a `<Tabs>` wrapper with three `<TabsContent>` panels:

   ```tsx
   <Tabs
     value={activeTab}
     onValueChange={setActiveTab}
     className="flex flex-1 flex-col overflow-hidden"
   >
     <TabsList className="mx-4 mt-3 grid w-full grid-cols-3" style={{ width: 'calc(100% - 2rem)' }}>
       <TabsTrigger value="preferences">Preferences</TabsTrigger>
       <TabsTrigger value="statusBar">Status Bar</TabsTrigger>
       <TabsTrigger value="server">Server</TabsTrigger>
     </TabsList>

     <div className="flex-1 overflow-y-auto p-4">
       <TabsContent value="preferences" className="mt-0 space-y-6">
         {/* Existing preferences content — all 7 SettingRow items + Reset link */}
       </TabsContent>

       <TabsContent value="statusBar" className="mt-0 space-y-4">
         {/* 5 new SettingRow toggle switches */}
       </TabsContent>

       <TabsContent value="server" className="mt-0 space-y-3">
         {/* Existing server config content — unchanged */}
       </TabsContent>
     </div>
   </Tabs>
   ```

5. **Remove the `<Separator />` between sections** — tabs replace it.

6. **Set min-height on tab content area** to prevent layout shifts when switching between tabs of different heights:
   ```tsx
   <div className="overflow-y-auto flex-1 p-4 min-h-[280px]">
   ```

### 6.4 Status Bar Tab Content

Five `SettingRow` entries using the existing component pattern:

```tsx
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
```

### 6.5 StatusLine Visibility Logic

**File:** `apps/client/src/components/status/StatusLine.tsx` (MODIFY)

**Import and read store:**

```typescript
import { useAppStore } from '../../stores/app-store';

// Inside component:
const {
  showStatusBarCwd,
  showStatusBarPermission,
  showStatusBarModel,
  showStatusBarCost,
  showStatusBarContext,
} = useAppStore();
```

**Conditional rendering with smart separators:**

The current approach uses inline `<Separator />` components after each item. With toggleable visibility, separators must only appear _between_ visible items. The cleanest approach: collect visible items into an array and render separators between them.

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
      onChangeMode={(mode) => updateSession({ permissionMode: mode })}
    />
  );
}
if (showStatusBarModel) {
  items.push(
    <ModelItem
      key="model"
      model={status.model}
      onChangeModel={(model) => updateSession({ model })}
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
    className="text-muted-foreground flex flex-wrap items-center justify-center gap-2 px-1 pt-2 text-xs whitespace-nowrap sm:justify-start"
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

**Empty state:** When all items are toggled off (or no data available for any enabled item), the component returns `null` and the status bar area collapses completely.

### 6.6 No API Changes

This feature is entirely client-side. No server routes, transport methods, or shared types need modification.

## 7. User Experience

### User Journey

1. User opens Settings via the gear icon in the sidebar
2. Dialog opens showing the **Preferences** tab (default, or last-selected tab if reopened)
3. User clicks **Status Bar** tab
4. User sees 5 toggle switches, all ON by default
5. User toggles "Show cost" OFF
6. The cost item immediately disappears from the status bar (visible behind the dialog if dialog doesn't cover it, or upon closing)
7. User closes dialog; setting persists

### Edge Cases

- **All items off:** Status bar area collapses completely. User re-enables via Settings > Status Bar tab.
- **Data-conditional items:** If `showStatusBarCost` is ON but `status.costUsd` is `null`, the cost item still doesn't render (data availability takes precedence). The toggle controls _user preference_, not data availability.
- **Reset:** "Reset to defaults" on the Preferences tab resets all preferences including status bar toggles (all back to ON).
- **Tab memory:** Reopening the dialog returns to the last-viewed tab within the same page session.

## 8. Testing Strategy

### Unit Tests — SettingsDialog

**File:** `apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx` (MODIFY)

**Additional mocks needed:**

```typescript
// Mock @radix-ui/react-tabs (or rely on jsdom rendering — Radix tabs work in jsdom)
// No additional mock needed if Radix tabs render in jsdom (they should)
```

**New test cases:**

```typescript
// Purpose: Verify tab navigation structure renders correctly
it('renders three tabs: Preferences, Status Bar, Server', async () => {
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper });
  expect(screen.getByRole('tab', { name: /preferences/i })).toBeDefined();
  expect(screen.getByRole('tab', { name: /status bar/i })).toBeDefined();
  expect(screen.getByRole('tab', { name: /server/i })).toBeDefined();
});

// Purpose: Verify Preferences tab is shown by default
it('shows Preferences tab content by default', async () => {
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper });
  expect(screen.getByText(/theme/i)).toBeDefined();
  expect(screen.getByText(/font size/i)).toBeDefined();
});

// Purpose: Verify tab switching works and shows correct content
it('switches to Status Bar tab and shows toggle switches', async () => {
  const user = userEvent.setup();
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper });

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
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper });

  await user.click(screen.getByRole('tab', { name: /status bar/i }));
  const switches = screen.getAllByRole('switch');
  switches.forEach(sw => {
    expect(sw.getAttribute('data-state')).toBe('checked');
  });
});

// Purpose: Verify server tab content is accessible
it('switches to Server tab and shows config', async () => {
  const user = userEvent.setup();
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper });

  await user.click(screen.getByRole('tab', { name: /server/i }));
  await screen.findByText(/version/i);
});
```

**Update existing tests:** The test `'displays all preference controls'` may need updating if it searches for controls that are now behind a tab click. Verify existing tests still pass after restructuring — the Preferences tab is default, so most should work unchanged.

### Unit Tests — app-store

Verify the 5 new settings follow the persistence pattern. Can be validated by the existing `resetPreferences` test pattern — add assertions that status bar fields reset to `true`.

### Manual Testing Checklist

1. Open Settings — Preferences tab shown by default
2. Click each tab — content switches correctly
3. Status Bar tab — all 5 toggles shown, all ON
4. Toggle one OFF — status bar item disappears immediately
5. Close and reopen dialog — still on Status Bar tab
6. Refresh page — dialog opens on Preferences tab (state reset)
7. Toggle ALL status bar items OFF — status bar area collapses
8. "Reset to defaults" on Preferences tab — all status bar toggles revert to ON
9. Keyboard: Tab to tab list, arrow keys between tabs, Enter to select
10. Mobile: Dialog renders as Drawer, tabs still functional

## 9. Performance Considerations

- **Minimal impact.** Five additional boolean reads from Zustand store in StatusLine (selector-based, no unnecessary re-renders).
- **Tab content is lazy by default** — Radix `TabsContent` only renders the active panel's DOM. The server config `useQuery` fires regardless (it's at dialog level, not tab level), which is the existing behavior.
- **No new network requests.** All new functionality is client-side localStorage.

## 10. Security Considerations

- No security impact. All new data is client-side UI preferences stored in localStorage. No user data, credentials, or sensitive information involved.

## 11. Documentation

- No documentation changes needed. The settings dialog is self-documenting via its labels and descriptions.
- `guides/design-system.md` does not need updates — tabs follow existing patterns.

## 12. Implementation Phases

### Phase 1: Core (Single PR)

1. Install `@radix-ui/react-tabs` dependency
2. Create `tabs.tsx` UI component
3. Add 5 status bar toggle fields to `app-store.ts`
4. Restructure `SettingsDialog.tsx` with tabs + Status Bar tab content
5. Update `StatusLine.tsx` with conditional rendering
6. Update tests

All changes are in `apps/client/` only — no server changes, no shared type changes.

### Phase 2: Future (Separate PRs)

- Add "Context Files" tab when that feature is built
- Add "System Prompt" tab when that feature is built
- Split Preferences into General/Chat when it exceeds ~12 items

## 13. Files Modified/Created

| File                                                                    | Action     | Description                                                           |
| ----------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `apps/client/package.json`                                              | **Modify** | Add `@radix-ui/react-tabs` dependency                                 |
| `apps/client/src/components/ui/tabs.tsx`                                | **Create** | Radix Tabs shadcn-style wrapper (4 exports)                           |
| `apps/client/src/stores/app-store.ts`                                   | **Modify** | Add 5 status bar visibility toggles + update resetPreferences         |
| `apps/client/src/components/settings/SettingsDialog.tsx`                | **Modify** | Restructure with Tabs, add Status Bar tab content                     |
| `apps/client/src/components/status/StatusLine.tsx`                      | **Modify** | Read visibility toggles, conditional item rendering, smart separators |
| `apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx` | **Modify** | Add tab navigation + status bar toggle tests                          |

## 14. Acceptance Criteria

1. Settings dialog shows 3 horizontal tabs: Preferences, Status Bar, Server
2. Existing preferences appear under the Preferences tab (unchanged behavior)
3. Server info appears under the Server tab (unchanged content)
4. Status Bar tab shows 5 toggle switches, all ON by default
5. Toggling a switch immediately hides/shows the corresponding status bar item
6. Separators between status bar items only render between visible items (no orphaned dots)
7. All toggles off → status bar area collapses completely
8. "Reset to defaults" on Preferences tab resets status bar toggles too (all back to ON)
9. Tab selection persists across dialog open/close within the same page session
10. Tabs are keyboard-navigable (arrow keys, Enter/Space)
11. Build passes: `npx turbo build`
12. Existing tests pass + new tests for tab switching and status bar toggles

## 15. Open Questions

None — all decisions resolved during ideation.

## 16. References

- **Ideation document:** `specs/settings-tabs-status-bar/01-ideation.md`
- **Radix UI Tabs docs:** https://www.radix-ui.com/primitives/docs/components/tabs
- **shadcn/ui Tabs:** https://ui.shadcn.com/docs/components/tabs
- **Design system:** `guides/design-system.md`
- **Component rules:** `.claude/rules/components.md`
