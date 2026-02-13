---
slug: shortcut-chips
---

# Task Breakdown: Shortcut Chips

**Spec:** [02-spec.md](./02-spec.md)
**Date:** 2026-02-13

---

## P1: Zustand Store Toggle

**Subject:** `[shortcut-chips] [P1] Add showShortcutChips preference to Zustand store`
**Dependencies:** None
**Active Form:** Adding showShortcutChips boolean preference with localStorage persistence to the app store

### Implementation

**File:** `apps/client/src/stores/app-store.ts`

1. Add to the `AppState` interface:

```typescript
showShortcutChips: boolean;
setShowShortcutChips: (v: boolean) => void;
```

2. Add the state initializer and setter in the `create` call, after the `autoHideToolCalls` block (to group with other UI visibility settings):

```typescript
showShortcutChips: (() => {
  try {
    const stored = localStorage.getItem('gateway-show-shortcut-chips');
    return stored === null ? true : stored === 'true';
  }
  catch { return true; }
})(),
setShowShortcutChips: (v) => {
  try { localStorage.setItem('gateway-show-shortcut-chips', String(v)); } catch {}
  set({ showShortcutChips: v });
},
```

Note: Default is `true` (not `false` like most other prefs) because chips should be ON for discoverability. The pattern `stored === null ? true : stored === 'true'` matches the existing `autoHideToolCalls` pattern which also defaults to `true`.

3. Add to `resetPreferences()` cleanup — add the localStorage removal:

```typescript
localStorage.removeItem('gateway-show-shortcut-chips');
```

4. Add `showShortcutChips: true` to the `set()` call inside `resetPreferences()`.

### Verification

- The store compiles without TypeScript errors
- `useAppStore.getState().showShortcutChips` returns `true` by default
- Setting to `false` persists in localStorage under key `gateway-show-shortcut-chips`
- `resetPreferences()` resets value to `true` and removes the localStorage key

---

## P2: Settings Dialog Toggle

**Subject:** `[shortcut-chips] [P2] Add shortcut chips toggle to Settings Preferences tab`
**Dependencies:** P1 (needs `showShortcutChips` and `setShowShortcutChips` in store)
**Active Form:** Adding a Show shortcut chips toggle switch to the Settings Dialog Preferences tab

### Implementation

**File:** `apps/client/src/components/settings/SettingsDialog.tsx`

1. Add `showShortcutChips` and `setShowShortcutChips` to the destructured `useAppStore()` call (line ~33-46):

```typescript
const {
  showTimestamps, setShowTimestamps,
  expandToolCalls, setExpandToolCalls,
  autoHideToolCalls, setAutoHideToolCalls,
  showShortcutChips, setShowShortcutChips,  // ADD THIS LINE
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

2. Add a new `<SettingRow>` after the "Auto-hide tool calls" row (after line 120), before "Show dev tools":

```tsx
<SettingRow label="Show shortcut chips" description="Display shortcut hints below the message input">
  <Switch checked={showShortcutChips} onCheckedChange={setShowShortcutChips} />
</SettingRow>
```

### Verification

- Open Settings dialog, Preferences tab
- "Show shortcut chips" label and description are visible
- Toggle switch appears and defaults to checked (ON)
- Toggling the switch updates the store value
- The toggle appears between "Auto-hide tool calls" and "Show dev tools"

---

## P3: ShortcutChips Component

**Subject:** `[shortcut-chips] [P3] Create ShortcutChips component with trigger chip buttons`
**Dependencies:** None (can run in parallel with P1 and P2)
**Active Form:** Creating the ShortcutChips component that renders clickable trigger chip buttons

### Implementation

**New file:** `apps/client/src/components/chat/ShortcutChips.tsx`

```tsx
import { motion } from 'motion/react';
import { Terminal, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ShortcutChipsProps {
  onChipClick: (trigger: string) => void;
}

interface ChipDef {
  trigger: string;
  label: string;
  icon: LucideIcon;
  ariaLabel: string;
}

const chips: ChipDef[] = [
  { trigger: '/', label: 'Commands', icon: Terminal, ariaLabel: 'Insert slash command trigger' },
  { trigger: '@', label: 'Files', icon: FileText, ariaLabel: 'Insert file mention trigger' },
];

export function ShortcutChips({ onChipClick }: ShortcutChipsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 mt-1.5"
    >
      {chips.map((chip) => (
        <button
          key={chip.trigger}
          type="button"
          aria-label={chip.ariaLabel}
          onClick={() => onChipClick(chip.trigger)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
        >
          <chip.icon className="size-3" />
          <kbd className="font-mono text-[10px] opacity-60">{chip.trigger}</kbd>
          {chip.label}
        </button>
      ))}
    </motion.div>
  );
}
```

### Visual spec details

- Container: `flex items-center gap-2 mt-1.5`
- Each chip: `<button>` with `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs`
- Colors: `bg-secondary text-muted-foreground` base, `hover:text-foreground hover:bg-muted` on hover
- Transition: `transition-colors duration-150`
- Trigger character: `<kbd>` with `font-mono text-[10px] opacity-60`
- Icons: 12px (`size-3`) Lucide icons — `Terminal` for `/`, `FileText` for `@`
- Animation: `motion.div` wrapper with fade-in (`opacity: 0 -> 1`, `duration: 0.2`)
- Chips stay visible and unchanged regardless of palette state

### Accessibility

- Each chip is a `<button>` with `type="button"`
- `aria-label`: "Insert slash command trigger" / "Insert file mention trigger"
- Focusable via Tab key (native button behavior)

---

## P4: ChatPanel Integration

**Subject:** `[shortcut-chips] [P4] Integrate ShortcutChips into ChatPanel with chip click handler`
**Dependencies:** P1 (needs `showShortcutChips` from store), P3 (needs `ShortcutChips` component)
**Active Form:** Integrating ShortcutChips into ChatPanel with the handleChipClick callback that inserts trigger characters

### Implementation

**File:** `apps/client/src/components/chat/ChatPanel.tsx`

1. Add imports at the top of the file:

```typescript
import { ShortcutChips } from './ShortcutChips';
import { useAppStore } from '../../stores/app-store';
```

2. Add store selector inside the `ChatPanel` component function body (near the top, after existing hook calls like `useDirectoryState`):

```typescript
const showShortcutChips = useAppStore((s) => s.showShortcutChips);
```

3. Add `handleChipClick` callback inside the component (after existing handler functions like `handleFileSelect`):

```typescript
const handleChipClick = useCallback((trigger: string) => {
  const newValue = input + trigger;
  setInput(newValue);
  detectTrigger(newValue, newValue.length);
}, [input, setInput]);
```

4. Render `<ShortcutChips>` between `<ChatInput>` and `<StatusLine>` inside the `chat-input-container` div, wrapped in `<AnimatePresence>`. The existing `AnimatePresence` import from `motion/react` on line 2 already covers this. Insert after the `<ChatInput ... />` closing tag and before `<StatusLine ...>`:

```tsx
<AnimatePresence>
  {showShortcutChips && (
    <ShortcutChips onChipClick={handleChipClick} />
  )}
</AnimatePresence>
```

The final JSX order inside `.chat-input-container` should be:
1. `<AnimatePresence>` for CommandPalette/FilePalette
2. `<ChatInput>`
3. `<AnimatePresence>` for ShortcutChips (NEW)
4. `<StatusLine>`

### Behavior

- Clicking a chip appends the trigger character (`/` or `@`) to the current input value
- `detectTrigger()` is called with the new value, which opens the corresponding palette (CommandPalette for `/`, FilePalette for `@`)
- The textarea receives focus automatically (the palette opening focuses the input via existing behavior)
- Chips remain visible when palettes are open (per spec decision)
- When `showShortcutChips` is `false` in the store, the chips are not rendered

### Verification

- Two chips ("/ Commands" and "@ Files") appear below the chat input
- Clicking "/ Commands" inserts `/` into the input and opens CommandPalette
- Clicking "@ Files" inserts `@` into the input and opens FilePalette
- Toggling the setting in Settings hides/shows chips immediately
- Chips remain visible when a palette is already open

---

## P5: Tests

**Subject:** `[shortcut-chips] [P5] Add tests for ShortcutChips component and settings toggle`
**Dependencies:** P1, P2, P3, P4 (all implementation must be complete)
**Active Form:** Writing unit tests for the ShortcutChips component and the new settings toggle

### Implementation

**New file:** `apps/client/src/components/chat/__tests__/ShortcutChips.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock motion/react to render plain elements
vi.mock('motion/react', () => ({
  motion: new Proxy({}, {
    get: (_target: unknown, prop: string) => {
      return ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
        const Tag = prop as keyof React.JSX.IntrinsicElements;
        return <Tag {...props}>{children}</Tag>;
      };
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ShortcutChips } from '../ShortcutChips';

describe('ShortcutChips', () => {
  it('renders both chips with correct labels', () => {
    render(<ShortcutChips onChipClick={vi.fn()} />);
    expect(screen.getByText('Commands')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('calls onChipClick with "/" when Commands chip is clicked', () => {
    const onChipClick = vi.fn();
    render(<ShortcutChips onChipClick={onChipClick} />);
    fireEvent.click(screen.getByText('Commands'));
    expect(onChipClick).toHaveBeenCalledWith('/');
  });

  it('calls onChipClick with "@" when Files chip is clicked', () => {
    const onChipClick = vi.fn();
    render(<ShortcutChips onChipClick={onChipClick} />);
    fireEvent.click(screen.getByText('Files'));
    expect(onChipClick).toHaveBeenCalledWith('@');
  });

  it('renders chips as accessible buttons with aria-labels', () => {
    render(<ShortcutChips onChipClick={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(screen.getByLabelText('Insert slash command trigger')).toBeInTheDocument();
    expect(screen.getByLabelText('Insert file mention trigger')).toBeInTheDocument();
  });

  it('renders trigger characters in kbd elements', () => {
    render(<ShortcutChips onChipClick={vi.fn()} />);
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('@')).toBeInTheDocument();
  });
});
```

**Modified file:** `apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx`

Add the following test cases to the existing `describe('SettingsDialog', ...)` block:

```typescript
// Verifies shortcut chips toggle appears in Preferences tab
it('displays "Show shortcut chips" toggle in Preferences tab', () => {
  render(
    <SettingsDialog open={true} onOpenChange={vi.fn()} />,
    { wrapper: createWrapper() },
  );
  expect(screen.getByText('Show shortcut chips')).toBeDefined();
  expect(screen.getByText('Display shortcut hints below the message input')).toBeDefined();
});

// Verifies the shortcut chips toggle defaults to checked (ON)
it('has shortcut chips toggle enabled by default', () => {
  render(
    <SettingsDialog open={true} onOpenChange={vi.fn()} />,
    { wrapper: createWrapper() },
  );
  const label = screen.getByText('Show shortcut chips');
  const row = label.closest('.flex')!;
  const toggle = row.querySelector('[role="switch"]');
  expect(toggle).toBeDefined();
  expect(toggle?.getAttribute('data-state')).toBe('checked');
});
```

### Verification

- Run `npx vitest run apps/client/src/components/chat/__tests__/ShortcutChips.test.tsx` — all 5 tests pass
- Run `npx vitest run apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx` — all existing + 2 new tests pass
- Run `npx turbo test --filter=@lifeos/client` — no regressions

---

## Dependency Graph

```
P1 (Store) ──────┬──→ P2 (Settings)
                  │
P3 (Component) ──┼──→ P4 (Integration) ──→ P5 (Tests)
                  │
P1 (Store) ──────┘
```

## Parallel Execution Opportunities

- **P1 and P3** can run in parallel (no dependencies between them)
- **P2** depends only on P1
- **P4** depends on P1 + P3
- **P5** depends on all of P1-P4
