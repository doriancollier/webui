---
slug: mobile-input-collapse-gesture
---

# Mobile Input Collapse Gesture — Tasks

**Generated:** 2026-02-13
**Spec:** `specs/mobile-input-collapse-gesture/02-specification.md`

---

## Phase 1: Core Collapse/Expand

### Task 1.1: Create DragHandle component

**File:** `apps/client/src/components/chat/DragHandle.tsx` (NEW)

Create a small, accessible button component rendered as a horizontal pill bar for mobile drag-to-collapse affordance.

**Props interface:**

```tsx
interface DragHandleProps {
  collapsed: boolean;
  onToggle: () => void;
}
```

**Visual spec:**

- Container: `h-6` (24px) flex center, full width — provides 48px effective touch target with surrounding padding
- Pill: `w-9 h-1 rounded-full bg-muted-foreground/30` (36x4px, subtle gray)
- Hover/active: `bg-muted-foreground/50`
- Collapsed state: pill shows subtle visual indicator (e.g., chevron-up via opacity or rotation)
- `role="button"`, `aria-label` toggles between "Collapse input extras" / "Expand input extras"
- `tabIndex={0}`, keyboard Enter/Space triggers toggle

**Implementation:**

```tsx
export function DragHandle({ collapsed, onToggle }: DragHandleProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={collapsed ? 'Expand input extras' : 'Collapse input extras'}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className="flex h-6 w-full cursor-pointer items-center justify-center"
    >
      <div className="bg-muted-foreground/30 hover:bg-muted-foreground/50 active:bg-muted-foreground/50 h-1 w-9 rounded-full transition-colors" />
    </div>
  );
}
```

**Acceptance criteria:**

- Renders a 36x4px pill bar centered in a 24px tall container
- `role="button"` and correct `aria-label` based on `collapsed` prop
- Click and Enter/Space key call `onToggle`
- Uses Tailwind utility classes only, no custom CSS

---

### Task 1.2: Add collapse gesture and wrapper to ChatPanel

**File:** `apps/client/src/components/chat/ChatPanel.tsx` (MODIFY)

Add mobile-only collapse/expand behavior for ShortcutChips and StatusLine, with a DragHandle and swipe gesture.

**Changes:**

1. Add imports:

```tsx
import { useIsMobile } from '../../hooks/use-is-mobile';
import { DragHandle } from './DragHandle';
import type { PanInfo } from 'motion/react';
```

2. Add local state inside `ChatPanel`:

```tsx
const isMobile = useIsMobile();
const [collapsed, setCollapsed] = useState(false);
```

3. Add drag handler:

```tsx
const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;
const handleDragEnd = (_: unknown, info: PanInfo) => {
  const { offset, velocity } = info;
  if (offset.y > SWIPE_THRESHOLD || velocity.y > VELOCITY_THRESHOLD) {
    setCollapsed(true);
  } else if (offset.y < -SWIPE_THRESHOLD || velocity.y < -VELOCITY_THRESHOLD) {
    setCollapsed(false);
  }
};
```

4. Replace the existing ShortcutChips + StatusLine rendering (after ChatInput) with:

**Mobile path:**

```tsx
{
  isMobile && (
    <>
      <DragHandle collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            style={{ touchAction: 'pan-y' }}
          >
            {showShortcutChips && <ShortcutChips onChipClick={handleChipClick} />}
            <StatusLine
              sessionId={sessionId}
              sessionStatus={sessionStatus}
              isStreaming={status === 'streaming'}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

**Desktop path (unchanged rendering):**

```tsx
{
  !isMobile && (
    <>
      <AnimatePresence>
        {showShortcutChips && <ShortcutChips onChipClick={handleChipClick} />}
      </AnimatePresence>
      <StatusLine
        sessionId={sessionId}
        sessionStatus={sessionStatus}
        isStreaming={status === 'streaming'}
      />
    </>
  );
}
```

**Acceptance criteria:**

- Mobile: DragHandle appears between ChatInput and collapsible content
- Mobile: Swipe down (80px or 500px/s) collapses chips + status bar
- Mobile: Swipe up (80px or 500px/s) expands chips + status bar
- Mobile: Tap handle toggles collapsed state
- Desktop: No DragHandle, no drag gesture, ShortcutChips + StatusLine render exactly as before
- `showShortcutChips` preference is respected independently of collapse state
- Spring animation uses `stiffness: 300, damping: 30`
- `MotionConfig reducedMotion="user"` (already wrapping app) handles reduced motion

---

### Task 1.3: Write DragHandle tests

**File:** `apps/client/src/components/chat/__tests__/DragHandle.test.tsx` (NEW)

**Mock pattern:** Use established Proxy pattern from ShortcutChips.test.tsx:

```tsx
vi.mock('motion/react', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target: unknown, prop: string) => {
        return ({
          children,
          initial: _i,
          animate: _a,
          exit: _e,
          transition: _t,
          ...props
        }: Record<string, unknown> & { children?: React.ReactNode }) => {
          const Tag = prop as keyof React.JSX.IntrinsicElements;
          return <Tag {...props}>{children}</Tag>;
        };
      },
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
```

**Test cases:**

1. **Renders pill element** — Validates the handle bar element exists with correct styling classes (`w-9 h-1 rounded-full`)
2. **Displays correct aria-label when expanded** — `aria-label="Collapse input extras"` when `collapsed=false`
3. **Displays correct aria-label when collapsed** — `aria-label="Expand input extras"` when `collapsed=true`
4. **Calls onToggle on click** — Validates tap-to-toggle fires the callback
5. **Calls onToggle on Enter key** — Validates keyboard accessibility via Enter key
6. **Has button role** — Validates `role="button"` for screen readers

---

### Task 1.4: Write ChatPanel collapse tests

**File:** `apps/client/src/components/chat/__tests__/ChatPanel.test.tsx` (NEW)

**Required mocks:**

- `motion/react` — Proxy pattern (same as DragHandle tests)
- `../../hooks/use-is-mobile` — mock to control mobile/desktop
- `../../hooks/use-chat-session` — return stable defaults
- `../../hooks/use-commands` — return empty commands
- `../../hooks/use-task-state` — return default task state
- `../../hooks/use-session-id` — return mock session ID setter
- `../../hooks/use-session-status` — return default status
- `../../hooks/use-directory-state` — return default directory
- `../../hooks/use-files` — return empty file list
- `../../stores/app-store` — mock `useAppStore` for `showShortcutChips`
- `../ChatInput` — simple stub
- `../MessageList` — simple stub
- `../ShortcutChips` — render identifiable div
- `../status/StatusLine` — render identifiable div (adjust path as needed)

**Test cases:**

1. **Mobile: renders drag handle** — When `useIsMobile` returns true, element with `role="button"` and `aria-label` containing "input extras" appears
2. **Desktop: does not render drag handle** — When `useIsMobile` returns false, no drag handle in DOM
3. **Mobile: chips and status bar visible by default** — On initial render with `showShortcutChips=true`, both ShortcutChips and StatusLine are present
4. **Mobile: tap handle hides chips and status bar** — After clicking the drag handle, ShortcutChips and StatusLine are removed from DOM
5. **Mobile: tap handle again shows chips and status bar** — Toggle back to expanded state

**Acceptance criteria:**

- All 5 tests pass
- Existing tests in ShortcutChips.test.tsx and ChatInput.test.tsx still pass (verify with `npx vitest run`)

---

## Phase 2: First-Use Hint

### Task 2.1: Add first-use hint to ChatPanel

**File:** `apps/client/src/components/chat/ChatPanel.tsx` (MODIFY)
**Depends on:** Task 1.2

Add a first-use hint that teaches mobile users about the swipe gesture. Shown on the first 3 mobile visits, auto-dismisses after 4 seconds.

**State logic:**

```tsx
const [showHint, setShowHint] = useState(() => {
  if (!isMobile) return false;
  const count = parseInt(localStorage.getItem('gateway-gesture-hint-count') || '0', 10);
  return count < 3;
});

useEffect(() => {
  if (!showHint) return;
  const timer = setTimeout(() => {
    setShowHint(false);
    const count = parseInt(localStorage.getItem('gateway-gesture-hint-count') || '0', 10);
    localStorage.setItem('gateway-gesture-hint-count', String(count + 1));
  }, 4000);
  return () => clearTimeout(timer);
}, [showHint]);
```

**Render hint below DragHandle when `showHint` is true:**

```tsx
{
  showHint && (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => {
        setShowHint(false);
        const count = parseInt(localStorage.getItem('gateway-gesture-hint-count') || '0', 10);
        localStorage.setItem('gateway-gesture-hint-count', String(count + 1));
      }}
      className="text-muted-foreground cursor-pointer text-center text-xs"
    >
      Swipe to collapse
    </motion.p>
  );
}
```

**DragHandle bounce animation when hint is showing:**

- The DragHandle (or its container) gets `animate={{ y: [0, 8, 0] }}` with `transition={{ duration: 1.2, repeat: 2 }}` when `showHint` is true

**Acceptance criteria:**

- On mobile, when localStorage `gateway-gesture-hint-count` < 3, hint text "Swipe to collapse" appears below DragHandle
- Hint auto-dismisses after 4 seconds with fade out
- Tapping hint dismisses immediately
- Each dismissal increments the localStorage counter
- Hint does not show on desktop regardless of counter value
- DragHandle pill bounces subtly when hint is visible

---

### Task 2.2: Write first-use hint tests

**File:** `apps/client/src/components/chat/__tests__/ChatPanel.test.tsx` (MODIFY — add to existing test file from Task 1.4)
**Depends on:** Task 1.4, Task 2.1

**Additional test cases for the hint:**

1. **Shows hint when localStorage count < 3 on mobile** — With `useIsMobile` returning true and localStorage `gateway-gesture-hint-count` set to "1", the text "Swipe to collapse" appears
2. **Does not show hint when count >= 3** — With localStorage `gateway-gesture-hint-count` set to "3", no hint text appears
3. **Increments count on dismiss** — After hint auto-dismisses (use `vi.useFakeTimers` and `vi.advanceTimersByTime(4000)`), localStorage value is incremented
4. **Does not show hint on desktop regardless of count** — With `useIsMobile` returning false and localStorage count at "0", no hint text appears

**Acceptance criteria:**

- All 4 hint tests pass
- All previous ChatPanel collapse tests still pass
- Use `vi.useFakeTimers()` for timer-based tests
- Clean up localStorage in `beforeEach`

---

## Dependency Graph

```
Task 1.1 (DragHandle component)
  └── Task 1.3 (DragHandle tests) — blocked by 1.1
  └── Task 1.2 (ChatPanel collapse) — blocked by 1.1
        └── Task 1.4 (ChatPanel collapse tests) — blocked by 1.2
        └── Task 2.1 (First-use hint) — blocked by 1.2
              └── Task 2.2 (Hint tests) — blocked by 1.4, 2.1
```

## Verification

After all tasks are complete:

1. `npx vitest run apps/client/src/components/chat/__tests__/DragHandle.test.tsx` — all pass
2. `npx vitest run apps/client/src/components/chat/__tests__/ChatPanel.test.tsx` — all pass
3. `npx vitest run apps/client/src/components/chat/__tests__/ShortcutChips.test.tsx` — existing tests still pass
4. `npx vitest run apps/client/src/components/chat/__tests__/ChatInput.test.tsx` — existing tests still pass
5. `npx turbo typecheck` — no type errors
