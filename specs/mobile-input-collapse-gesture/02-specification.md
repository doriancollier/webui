---
slug: mobile-input-collapse-gesture
---

# Mobile Input Area Collapse Gesture

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-13

---

## Overview

Add a mobile-only swipe gesture that collapses and expands the shortcut chips and status bar below the chat textarea. A Material Design drag handle provides discoverability. The textarea always remains visible. Desktop behavior is unchanged.

## Background / Problem Statement

The bottom input area on mobile consists of three stacked elements: textarea, shortcut chips, and status bar. Together they consume significant vertical space on small screens, reducing the visible chat message area. Users need a way to reclaim that space without losing access to the tools.

## Goals

- Reclaim vertical space on mobile by allowing users to collapse chips + status bar
- Provide a universally recognized visual affordance (drag handle) for discoverability
- Support multiple interaction modes: swipe gesture and tap toggle
- Teach the gesture to new users via a first-use hint
- Maintain full desktop experience unchanged

## Non-Goals

- Collapsing or hiding the textarea itself
- Desktop gesture support
- Auto-collapse based on typing, streaming, or inactivity
- Persisting collapsed state across page reloads
- Swipe-to-dismiss the entire input area

## Technical Dependencies

- **motion** `^12.33.0` — Already installed. Provides `drag="y"`, `dragConstraints`, `dragElastic`, `onDragEnd` with velocity/offset data, `AnimatePresence`, and spring animations.
- **zustand** `^5.0.0` — Already installed. Not needed for collapsed state (local `useState`), but used for `showShortcutChips` preference check.
- **useIsMobile()** hook — Already exists at `apps/client/src/hooks/use-is-mobile.ts`, breakpoint at 768px.

No new dependencies required.

## Detailed Design

### Architecture

The feature is entirely client-side, contained within `ChatPanel.tsx` and a new `DragHandle` component. No server changes needed.

```
chat-input-container (existing div, p-4, border-t)
├── CommandPalette / FilePalette (above input, unchanged)
├── ChatInput (textarea + buttons, unchanged)
├── CollapsibleInputExtras (NEW wrapper, mobile only)
│   ├── DragHandle (NEW component, button role)
│   │   └── horizontal pill bar (36×4px, centered)
│   ├── ShortcutChips (existing, conditionally rendered)
│   └── StatusLine (existing, conditionally rendered)
└── [on desktop: ShortcutChips + StatusLine render directly, no wrapper]
```

### New Component: `DragHandle`

**File:** `apps/client/src/components/chat/DragHandle.tsx`

A small, accessible button rendered as a horizontal pill bar. Mobile only.

```tsx
interface DragHandleProps {
  collapsed: boolean;
  onToggle: () => void;
}
```

**Visual spec:**
- Container: `h-6` (24px) flex center, full width — provides 48px effective touch target with surrounding padding
- Pill: `w-9 h-1 rounded-full bg-muted-foreground/30` (36×4px, subtle gray)
- Hover/active: `bg-muted-foreground/50`
- Collapsed state: pill rotates or shows a subtle chevron-up indicator via opacity
- `role="button"`, `aria-label` toggles between "Collapse input extras" / "Expand input extras"
- `tabIndex={0}`, keyboard Enter/Space triggers toggle

### Gesture Detection

Use motion.dev's `drag="y"` on the collapsible wrapper:

```tsx
<motion.div
  drag={isMobile ? "y" : false}
  dragConstraints={{ top: 0, bottom: 0 }}
  dragElastic={0.2}
  onDragEnd={handleDragEnd}
  style={{ touchAction: 'pan-y' }}
>
```

**`handleDragEnd` logic:**
```tsx
const SWIPE_THRESHOLD = 80; // pixels
const VELOCITY_THRESHOLD = 500; // px/s

const handleDragEnd = (_: unknown, info: PanInfo) => {
  const { offset, velocity } = info;
  if (offset.y > SWIPE_THRESHOLD || velocity.y > VELOCITY_THRESHOLD) {
    setCollapsed(true);
  } else if (offset.y < -SWIPE_THRESHOLD || velocity.y < -VELOCITY_THRESHOLD) {
    setCollapsed(false);
  }
};
```

The gesture target is the drag handle + chips + status bar area (below the textarea). The textarea itself is NOT part of the drag target to avoid conflicts with text selection and scrolling.

### Collapse/Expand Animation

Use `AnimatePresence` with spring transition for the chips + status bar:

```tsx
<AnimatePresence initial={false}>
  {!collapsed && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
      className="overflow-hidden"
    >
      {showShortcutChips && <ShortcutChips onChipClick={handleChipClick} />}
      <StatusLine ... />
    </motion.div>
  )}
</AnimatePresence>
```

**Design system alignment:** The spring config (`stiffness: 300, damping: 30`) matches the "interactive elements" spec from the design system. For reduced motion preference, `MotionConfig reducedMotion="user"` (already wrapping the app) will automatically simplify to instant transitions.

### State Management

**Collapsed state:** Local `useState(false)` in `ChatPanel`. Resets on unmount/reload. No localStorage persistence.

**First-use hint count:** `localStorage.getItem('gateway-gesture-hint-count')` — integer tracking how many times the hint has been shown. Incremented on each mobile visit. Hint displays when count < 3.

**Interaction with existing settings:** The `showShortcutChips` app store preference is respected independently. If a user disables chips in settings, they remain hidden regardless of collapse state. The collapse gesture only affects *visibility when both are enabled*.

### First-Use Hint

**File:** Inline in `ChatPanel.tsx` (or extracted to a small component if it grows).

**Trigger:** On mobile, when `localStorage 'gateway-gesture-hint-count'` is < 3, show the hint on mount.

**Visual:**
- A small text label "Swipe to collapse" appears below the drag handle
- The drag handle animates with a subtle downward bounce: `y: [0, 8, 0]` over 1.2s, repeating 2x
- Auto-dismisses after 3-4 seconds with fade out
- Tapping anywhere on the hint dismisses it immediately
- After dismissal, increment the count in localStorage

**Implementation:**
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

### Desktop Behavior

When `useIsMobile()` returns `false`:
- No `DragHandle` rendered
- No drag gesture wrapper
- ShortcutChips and StatusLine render in their current positions exactly as today
- Zero behavioral or visual change

### CSS Considerations

**Already handled by existing styles:**
- `body { overscroll-behavior: contain; }` — prevents pull-to-refresh (index.css line 323)
- `.chat-scroll-area { touch-action: pan-y; }` — prevents horizontal swipes (index.css line 334)
- `.chat-input-container` safe area insets — preserved (index.css line 340)

**New CSS needed:**
- `touch-action: pan-y` on the drag wrapper element (via inline style, already shown in the motion.div)
- The drag handle pill uses Tailwind utility classes only, no custom CSS needed

### File Changes Summary

| File | Change |
|------|--------|
| `apps/client/src/components/chat/ChatPanel.tsx` | Add collapsed state, DragHandle, collapsible wrapper with drag gesture, first-use hint logic. Guard with `useIsMobile()`. |
| `apps/client/src/components/chat/DragHandle.tsx` | **NEW** — Drag handle pill component with tap toggle and a11y. |
| `apps/client/src/components/chat/__tests__/DragHandle.test.tsx` | **NEW** — Tests for handle rendering, tap toggle, a11y attributes. |
| `apps/client/src/components/chat/__tests__/ChatPanel.test.tsx` | **NEW** — Tests for collapse gesture, hint display, desktop no-op. |

## User Experience

### Mobile Flow

1. User opens app on mobile → sees textarea, drag handle pill, chips, status bar
2. First 3 visits: sees brief "Swipe to collapse" hint with bouncing handle animation (auto-dismisses after 4s)
3. User swipes down on handle/chips/status area → chips and status bar collapse with spring animation, handle remains visible
4. User swipes up or taps handle → chips and status bar expand
5. User navigates away or reloads → starts expanded again

### Desktop Flow

No change. No drag handle. No gesture. Chips and status bar always visible (subject to settings toggles).

### Accessibility

- Drag handle has `role="button"` with descriptive `aria-label`
- Keyboard: Enter/Space on focused handle toggles state
- Screen readers: announce "Collapse input extras" / "Expand input extras"
- `MotionConfig reducedMotion="user"` respects system preference — animations simplified automatically
- Gesture is never the only way to interact — tap toggle always available

## Testing Strategy

### Motion Mock Pattern

All tests mock `motion/react` using the established Proxy pattern from `ShortcutChips.test.tsx`:

```tsx
vi.mock('motion/react', () => ({
  motion: new Proxy({}, {
    get: (_target: unknown, prop: string) => {
      return ({ children, initial: _i, animate: _a, exit: _e, transition: _t, drag: _d, dragConstraints: _dc, dragElastic: _de, onDragEnd: _ode, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
        const Tag = prop as keyof React.JSX.IntrinsicElements;
        return <Tag {...props}>{children}</Tag>;
      };
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
```

### DragHandle Tests (`DragHandle.test.tsx`)

1. **Renders pill element** — Validates the handle bar element exists with correct styling classes
2. **Displays correct aria-label when expanded** — `aria-label="Collapse input extras"` when `collapsed=false`
3. **Displays correct aria-label when collapsed** — `aria-label="Expand input extras"` when `collapsed=true`
4. **Calls onToggle on click** — Validates tap-to-toggle fires the callback
5. **Calls onToggle on Enter key** — Validates keyboard accessibility
6. **Has button role** — Validates `role="button"` for screen readers

### ChatPanel Collapse Tests (`ChatPanel.test.tsx`)

These tests require mocking `useIsMobile` to control mobile/desktop behavior:

1. **Mobile: renders drag handle** — When `useIsMobile` returns true, DragHandle appears in the DOM
2. **Desktop: does not render drag handle** — When `useIsMobile` returns false, no DragHandle in DOM
3. **Mobile: chips and status bar visible by default** — On initial render, both are present
4. **Mobile: tap handle hides chips and status bar** — After clicking handle, chips/status bar removed from DOM
5. **Mobile: tap handle again shows chips and status bar** — Toggle back to expanded
6. **First-use hint: shows when localStorage count < 3** — Hint text appears on mobile
7. **First-use hint: does not show when count >= 3** — Hint hidden after 3 visits
8. **First-use hint: increments count on dismiss** — localStorage updated after hint auto-dismisses

### Existing Test Preservation

- Run `npx vitest run apps/client/src/components/chat/__tests__/ShortcutChips.test.tsx` — must pass unchanged
- Run `npx vitest run apps/client/src/components/chat/__tests__/ChatInput.test.tsx` — must pass unchanged

## Performance Considerations

- **Spring animations** use compositor-friendly properties when possible. The `height: 'auto'` animation triggers layout, but motion.dev's FLIP technique minimizes reflow cost. The collapse area is small (chips + status bar ≈ 60-80px) so layout cost is negligible.
- **Drag gesture** uses motion.dev's internal pointer event system which is optimized for 60fps on mobile.
- **No additional bundle size** — motion.dev's drag module is already tree-shaken into the bundle since the library is a dependency.
- **localStorage access** for hint count happens once on mount, not on every render.

## Security Considerations

No security implications. This is a purely visual/interactive UI feature with no data flow, network requests, or state persistence beyond a simple localStorage counter.

## Documentation

No documentation updates needed. This is an incremental UX enhancement that doesn't affect APIs, configuration, or architecture.

## Implementation Phases

### Phase 1: Core Collapse/Expand

1. Create `DragHandle.tsx` component with pill visual and tap toggle
2. Add collapsed `useState` to `ChatPanel.tsx`
3. Wrap chips + status bar in collapsible motion.div with `AnimatePresence`
4. Guard with `useIsMobile()` — desktop renders unchanged
5. Add drag gesture with threshold detection
6. Write tests for DragHandle and ChatPanel collapse behavior
7. Verify existing tests pass

### Phase 2: First-Use Hint

1. Add hint state with localStorage counter
2. Render hint text + bouncing handle animation below the drag handle
3. Auto-dismiss after 4s, increment counter
4. Add tests for hint display and dismissal logic

## References

- [Motion.dev Drag Guide](https://motion.dev/docs/react-drag) — `drag="y"`, constraints, elastic, `onDragEnd`
- [Motion.dev Spring Docs](https://motion.dev/docs/spring) — `stiffness`, `damping` configuration
- [Material Design Bottom Sheet Specs](https://m3.material.io/components/bottom-sheets/specs) — Drag handle pattern (horizontal pill)
- [NN/G Bottom Sheets Guidelines](https://www.nngroup.com/articles/bottom-sheet/) — Multi-modal dismissal patterns
- [How to Communicate Hidden Gestures | UX Planet](https://uxplanet.org/how-to-communicate-hidden-gestures-in-mobile-app-e55397f4006b) — First-use hint patterns
- Ideation document: `specs/mobile-input-collapse-gesture/01-ideation.md`
- Research report: `/tmp/research_20260213_mobile_input_collapse_gesture.md`
