---
title: 'Unified Status Strip — Merging InferenceIndicator and SystemStatusZone'
date: 2026-03-20
type: external-best-practices
status: active
tags:
  [
    chat-ui,
    status-strip,
    inference-indicator,
    system-status,
    animation,
    state-machine,
    compound-components,
    calm-tech,
    motion-dev,
    react,
  ]
feature_slug: unified-status-strip
searches_performed: 10
sources_count: 28
---

# Unified Status Strip — Merging InferenceIndicator and SystemStatusZone

## Research Summary

This report synthesizes industry best practices, DorkOS codebase analysis, and animation pattern research to produce an architectural recommendation for consolidating `InferenceIndicator` and `SystemStatusZone` into a single `ChatStatusStrip` component. The codebase already contains highly relevant prior art: `StatusLine.tsx` (a battle-tested compound component with AnimatePresence), `20260316_system_status_compact_boundary_ui_patterns.md` (the Slack/iMessage/VS Code industry survey), and `20260310_statusline_compound_component_patterns.md` (the compound component architecture playbook). This report builds on those foundations rather than repeating them.

The recommendation is **Approach 3: State Machine with Prioritized Content Slots** — an explicit, declarative state machine using a discriminated union rather than a library, housed in a single `motion.div` container that uses `AnimatePresence mode="wait"` to crossfade between content states. This provides predictable priority logic, clean separation of concerns, and minimal surface area for bugs without any additional dependencies.

---

## Key Findings

### 1. How Best-in-Class Products Handle AI Status

**Claude.ai**: A pulsing dot or spinner appears in the input area during inference. No elapsed time, no token count. Phrase: "Claude is thinking" or just the pulse — the product trusts the quality of its own output to communicate competence, not the duration of its work. Status disappears immediately on completion with no summary.

**ChatGPT**: A horizontally-scrolling shimmer/ellipsis pulse animation below the last message. No elapsed time visible to end users in standard mode. The O-series models show a collapsible "Thinking..." section in the message thread itself, not in a status zone. Summary: **inference states are never shown in a persistent zone between message list and input** — they're either inline in the thread or suppressed entirely.

**Cursor / Windsurf**: A thin spinner in the input chrome (bottom-right of the chat input area). Elapsed time is not shown in the main UI. Tool calls are surfaced as inline cards in the message list. The status zone is minimal — its purpose is "something is happening", not "here is exactly what and for how long."

**VS Code Status Bar (authoritative reference)**: Dual-zone (left = global workspace, right = contextual), minimal iconography, text labels concise, items earn their space. For background operations: a discreet spinner icon is the convention. Reserve background color changes only for blocking errors. The lesson: **items must earn their pixel budget against the bar's shared space budget.**

**Slack**: The ephemeral typing indicator ("Kai is typing...") lives in a fixed zone below the message list, above the input. It never pollutes the message thread. It disappears when no longer relevant. This is the canonical source of the `SystemStatusZone` pattern DorkOS already implements.

**Linear**: No persistent status strip in their chat/comment UI. Status is surfaced via breadcrumb state transitions or toasts — never a persistent sub-input zone.

**Apple iMessage / iOS Dynamic Island**: The key Apple contribution is the Dynamic Island principle — a single morphing container that reshapes itself to communicate different contexts. The container doesn't vanish and reappear; it _transitions_. For status communication, this means: one element, different content, smooth morphing. This is the design principle behind the state machine approach.

### 2. The Two Components That Need to Merge

**`InferenceIndicator`** (rich, multi-state):

- State: `idle + !showComplete` → renders nothing
- State: `idle + showComplete` → compact summary (elapsed + tokens, `opacity: 0.6`, persists briefly)
- State: `streaming + isWaitingForUser` → waiting indicator (amber, Shield or MessageSquare icon)
- State: `streaming + isRateLimited` → rate-limit countdown (amber, hourglass, countdown)
- State: `streaming` (default) → rotating verb, elapsed time, token count, shimmer icon

**`SystemStatusZone`** (minimal):

- State: `message !== null` → `Info` icon + message text, fades in/out
- State: `message === null` → renders nothing, height collapses

**Current layout in `ChatPanel.tsx`** (line 353):

```tsx
<SystemStatusZone message={systemStatus} />
```

The `InferenceIndicator` lives _inside_ `MessageList` (passed via props through `ChatPanel → MessageList → InferenceIndicator`). This means the two status elements currently occupy _different vertical positions_ — `InferenceIndicator` is anchored inside the scroll container; `SystemStatusZone` is outside it, between the scroll container and input.

**The consolidation goal**: Move everything to a single strip _outside the scroll container_, between the message list and the chat input — the same position where `SystemStatusZone` currently lives.

### 3. Priority Logic (Who Wins When Multiple States Are Active)

When both inference is streaming AND a system status message arrives, the system message is semantically more important (it describes an event that changes the agent's operating context). The priority stack from highest to lowest:

```
1. isRateLimited           → user needs to know they're waiting, not being served
2. isWaitingForUser        → user action is required to continue
3. systemStatus (message)  → SDK operational event (context compaction, etc.)
4. isStreaming              → normal inference in progress
5. showComplete            → post-stream summary (lowest priority, brief)
```

This ordering is defensible: rate limits and waiting states demand attention; system events are informational but more important than the ambient inference indicator; the inference indicator itself is ambient; the post-stream summary is purely informational and the lowest-stakes state.

### 4. Animation Patterns for Status Strip Transitions

The core challenge is avoiding layout shift when content swaps. The strip must have a stable height — or animate its height change so smoothly that it feels intentional rather than jarring.

**Pattern A — Fixed-height strip, content crossfades**:
A `div` with a fixed height (e.g., `h-8 = 32px`). Content swaps via `AnimatePresence mode="wait"` with a fast crossfade (`duration: 0.15`). The strip never changes height. Simple, predictable, no layout shift.

- Cons: Some content states may need different heights (the complete summary is shorter than the rate-limit message).

**Pattern B — Fluid height with `height: auto` animation via Motion**:
The container uses `motion.div` with `initial={{ height: 0 }}` / `animate={{ height: 'auto' }}` to collapse when there's nothing to show and expand when there is. Content inside uses `AnimatePresence mode="wait"` for the crossfade. The height transition is handled by Motion's layout system.

- Cons: `height: 'auto'` animation requires Motion's layout measurement, which adds one animation frame of delay before the animation begins (layout calculation). This is acceptable for a status strip.

**Pattern C — `layoutId` shared container (Dynamic Island approach)**:
A single `motion.div` with a `layoutId`. When the content changes, it morphs between its previous and new layout measurements using FLIP animation. This is how the Dynamic Island concept works. However, it requires both states to be mounted simultaneously in different positions, which doesn't apply here since the strip is a single fixed location.

- This pattern is most useful for moving an element between two screen positions (e.g., a pill expanding into a modal). For a fixed-position strip that only changes content, it's architectural overkill.

**Recommendation**: **Pattern B** — fluid height with `mode="wait"` crossfade inside. The strip collapses to `height: 0` when nothing is active, expands to `height: auto` when any state is active, and swaps content with a 150ms crossfade. This is the exact same pattern used in `StatusLine.tsx`'s outer `AnimatePresence` wrapper (line 83–107), giving us a proven DorkOS precedent.

### 5. The "Delight" Dimension

**Rotating verbs** (`InferenceIndicator` already does this): This is the right pattern. Cursor's "Working...", ChatGPT's ellipsis pulse — they're all variations on "communicating activity without quantifying it." The DorkOS rotating verb approach (e.g., "Analyzing...", "Reasoning...") adds semantic richness that makes the AI feel engaged rather than just spinning.

**Elapsed time — the anxiety question**: VS Code's token indicator caused "anxiety-inducing" user responses (GitHub Issue #293578). Cursor removed their token indicator entirely. The lesson: **show elapsed time by default but make it visually recessive**. DorkOS currently uses `text-muted-foreground/70 tabular-nums` — this is correct. The time should be readable at a glance but should not pull the eye. The current implementation gets this right.

**Token count — sophistication signal**: The `~2.4k tokens` display is informative for developers (Kai uses 10-20 sessions/week — he wants this data). Keeping it present but small (`text-muted-foreground/60`) is the right call. The `~` prefix subtly signals "estimate" without a tooltip, which is clean.

**Completion summary**: The brief `0:32 · ~12.3k tokens` that persists at 60% opacity after streaming ends is a premium touch. It respects the user's desire to know what happened without lingering. The existing `showComplete` + `motion.div opacity: 0.6` pattern is correct but could benefit from a brief auto-dismiss timer (e.g., fade out after 8 seconds) rather than persisting indefinitely.

**Icon shimmer**: The `theme.iconAnimation` for the streaming state (CSS animation on the icon character) is a subtle ambient signal. At 2s ease-in-out infinite, it breathes — it doesn't demand attention. This is correct Calm Tech implementation.

**System status icon**: The current `Info` icon from lucide-react is appropriate for `system/status` messages. For specific message categories (`context compaction`, `permission mode change`), consider contextual icons: `RefreshCw` for compaction, `Shield` for permission changes. This is a delight upgrade that aligns icon semantics with message semantics.

---

## Detailed Analysis

### Current Architecture Diagram

```
ChatPanel
  ├── MessageList (scroll container)
  │   └── InferenceIndicator (inside scroll = inside the thread)
  ├── SystemStatusZone (outside scroll = between thread and input)
  ├── PromptSuggestionChips
  └── ChatInputContainer
```

The problem: `InferenceIndicator` inside the scroll container means it scrolls with the content, is hidden when the user has scrolled up, and creates a confusing spatial model where inference status appears _before_ (above) the input rather than _between_ the thread and input.

### Target Architecture Diagram

```
ChatPanel
  ├── MessageList (scroll container — inference indicator removed)
  ├── ChatStatusStrip (new unified component)
  │   └── Renders exactly ONE of: [nothing | streaming | waiting | rate-limited | system-message | complete]
  ├── PromptSuggestionChips
  └── ChatInputContainer
```

The strip always renders in the same spatial position. Users build a mental model: "that zone tells me what the agent is doing."

### Approach Comparison

#### Approach 1: Simple Switcher (Conditional Rendering)

**Description**: A single functional component that receives all possible state props and uses `if`/`else if` logic to render the appropriate content. All state props are passed from `ChatPanel` props-down. No abstraction.

```tsx
export function ChatStatusStrip({ status, systemStatus, isWaitingForUser, ... }) {
  const content = systemStatus ? <SystemContent message={systemStatus} />
    : isRateLimited ? <RateLimitContent ... />
    : isWaitingForUser ? <WaitingContent ... />
    : status === 'streaming' ? <StreamingContent ... />
    : showComplete ? <CompleteContent ... />
    : null;

  return (
    <AnimatePresence>
      {content && (
        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
          <AnimatePresence mode="wait">
            {content}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Pros**:

- Simplest possible implementation
- No new abstractions
- Trivial to read and understand
- No dependencies added

**Cons**:

- Priority logic is implicit in `if/else` ordering — easy to accidentally reorder and break priority
- Content changes don't get crossfade animations because `AnimatePresence mode="wait"` requires stable `key` props to detect changes, but if the `content` JSX changes type (e.g., from `<RateLimitContent>` to `<StreamingContent>`), the keys differ and the animation fires. This is actually correct behavior if keys are assigned consistently.
- Single function has high cyclomatic complexity — the `if/else if` chain across 5 states hits the project's limit of 15 (but barely, since each branch is simple).

**Complexity**: Low
**Maintenance**: Low-Medium (priority bugs creep in via `if/else` reordering)
**Recommendation**: Acceptable for a first pass. Does not model priority explicitly.

---

#### Approach 2: Priority Queue

**Description**: A message queue that holds all pending status entries, each with a priority level. The strip always shows the highest-priority active message. When a message is enqueued, it displaces lower-priority messages. Messages dequeue themselves when their source state becomes false.

```typescript
type StripEntry = {
  id: string;
  priority: number; // 1 = highest
  content: React.ReactNode;
  ttl?: number; // auto-dismiss milliseconds
};
```

**Pros**:

- Priority is explicit and testable
- Multiple simultaneous status sources are cleanly handled
- TTL-based auto-dismiss is natural in this model (the `showComplete` case)
- Extensible — new status sources just enqueue with a priority

**Cons**:

- Significantly more complex than the problem requires
- Requires a queue state manager (Zustand or local state + effects)
- The strip only ever shows ONE entry — the queue complexity serves a problem that is mostly academic (the actual simultaneous status combinations are few and well-defined)
- Over-engineered for the current scope. If DorkOS adds 10 more status sources, this becomes useful. For 5 sources, it's excessive.

**Complexity**: High
**Maintenance**: Medium (well-structured if implemented correctly)
**Recommendation**: Future-proof architecture that premature-optimizes for extensibility that isn't needed yet.

---

#### Approach 3: State Machine with Prioritized Content Slots (Recommended)

**Description**: An explicit discriminated union type defines all valid strip states. A `deriveStripState()` pure function maps the raw input props to a single `StripState`. The component renders the correct content based on that state, with `AnimatePresence mode="wait"` crossfading between state changes.

```typescript
// Explicit enumeration of all valid states
type StripState =
  | { type: 'idle' }
  | { type: 'complete'; elapsed: string; tokens: string }
  | { type: 'system-message'; message: string }
  | { type: 'streaming'; verb: string; verbKey: string; elapsed: string; tokens: string; icon: string; iconAnimation?: string; isBypassVerb: boolean }
  | { type: 'waiting-for-user'; waitingType: 'approval' | 'question'; elapsed: string }
  | { type: 'rate-limited'; countdown: number | null; elapsed: string };

// Pure function — easily testable, no side effects
function deriveStripState(props: ChatStatusStripProps): StripState {
  if (props.isRateLimited) {
    return { type: 'rate-limited', countdown: props.countdown, elapsed: props.elapsed };
  }
  if (props.isWaitingForUser) {
    return { type: 'waiting-for-user', waitingType: props.waitingType ?? 'question', elapsed: props.elapsed };
  }
  if (props.systemStatus) {
    return { type: 'system-message', message: props.systemStatus };
  }
  if (props.status === 'streaming') {
    return { type: 'streaming', ... };
  }
  if (props.showComplete) {
    return { type: 'complete', elapsed: props.lastElapsed, tokens: props.lastTokens };
  }
  return { type: 'idle' };
}
```

**Pros**:

- Priority is explicit and documented in the `if` chain of `deriveStripState`
- The component itself is pure rendering — no priority logic in JSX
- `deriveStripState` is a testable pure function (no React, no mocks needed)
- Adding a new state means adding a union member + one `if` case — not searching through JSX
- The discriminated union makes TypeScript exhaustiveness checking possible via a `switch`/`satisfies` pattern
- `AnimatePresence mode="wait"` uses `state.type` as the key — guarantees crossfade on every state change including same-priority switches (e.g., rate-limit → waiting-for-user both being amber states)
- Matches the pattern from `20260310_statusline_compound_component_patterns.md` — same architectural thinking already in the codebase

**Cons**:

- More upfront code than Approach 1
- `deriveStripState` must be kept in sync with the union type (compiler enforces this)
- The `showComplete` boolean and `lastElapsed`/`lastTokens` snapshot refs from the current `InferenceIndicator` need to be maintained — they can't be eliminated, just moved into a hook

**Complexity**: Low-Medium
**Maintenance**: Very Low (TypeScript enforces exhaustiveness; the state machine is explicit)
**Recommendation**: This is the correct approach. The state machine pattern is already idiomatic in DorkOS (see `useChatStatusSync`, `useChatSession` status field).

---

#### Approach 4: Compound Component with Pluggable Slots

**Description**: The strip is a compound component (`StatusStrip.Root`, `StatusStrip.Slot`) where each slot declares its priority and content. The root renders the highest-priority visible slot.

```tsx
<ChatStatusStrip>
  <ChatStatusStrip.Slot priority={1} visible={isRateLimited}>
    <RateLimitContent ... />
  </ChatStatusStrip.Slot>
  <ChatStatusStrip.Slot priority={2} visible={isWaitingForUser}>
    <WaitingContent ... />
  </ChatStatusStrip.Slot>
  ...
</ChatStatusStrip>
```

**Pros**:

- Declarative — the priority hierarchy is visible in JSX
- Plugin-friendly — new status sources just add a `Slot`
- Matches the `StatusLine.tsx` compound component pattern already in the codebase

**Cons**:

- All slots are rendered (even the non-visible ones), which means their hooks run regardless. This is a non-trivial cost — `useElapsedTime` and `useRotatingVerb` run for all slots, not just the visible one.
- Determining "highest priority visible slot" requires the `React.Children` introspection that `20260310_statusline_compound_component_patterns.md` explicitly identified as problematic. The registration context workaround adds significant complexity.
- The `StatusLine` compound component works because all items are simultaneously visible (one per slot, side-by-side). The status strip only ever shows ONE item — the compound pattern adds complexity without benefit for a single-winner scenario.
- Plugin extensibility is premature optimization for a component with 5 well-defined states.

**Complexity**: High
**Maintenance**: Medium-High
**Recommendation**: The wrong abstraction for a single-winner scenario. Compound components shine when multiple items coexist; priority-winner patterns should use a state machine.

---

### Animation Design Specification

#### Container Animation (Outer)

```typescript
// Wraps entire strip — collapses/expands when strip enters/exits
<AnimatePresence initial={false}>
  {state.type !== 'idle' && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden"
    >
      {/* content */}
    </motion.div>
  )}
</AnimatePresence>
```

#### Content Swap Animation (Inner)

```typescript
// Each state renders a motion.div keyed by state.type
// AnimatePresence mode="wait" ensures old state exits before new enters
<AnimatePresence mode="wait" initial={false}>
  <motion.div
    key={state.type}
    initial={{ opacity: 0, y: 2 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -2 }}
    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
  >
    {/* render correct content for state.type */}
  </motion.div>
</AnimatePresence>
```

The `y: 2 / y: -2` offset gives direction to the swap — new content slides in from below, old content slides out above. This reinforces a mental model of "newer information replaces older information from below," matching the chat's bottom-to-top reading direction.

#### Rotating Verb Sub-Animation

The current `AnimatePresence mode="wait"` on the verb span inside `InferenceIndicator` is correct and should be preserved exactly:

```typescript
<AnimatePresence mode="wait">
  <motion.span
    key={verbKey}
    initial={{ opacity: 0, y: 2 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -2 }}
    transition={{ duration: 0.3 }}
  >
    {verb}
  </motion.span>
</AnimatePresence>
```

#### Complete State Auto-Dismiss

The `showComplete` state should auto-dismiss. The current implementation persists indefinitely. Add a `useEffect` that sets a 8-second timer:

```typescript
useEffect(() => {
  if (showComplete) {
    const timer = setTimeout(() => setShowComplete(false), 8000);
    return () => clearTimeout(timer);
  }
}, [showComplete]);
```

This is non-intrusive (8 seconds is long enough to read the summary, short enough that it doesn't permanently occupy the strip zone).

---

### Visual Design Specification

```
┌─────────────────────────────────────────────────────────┐
│  [message list — scroll container]                      │
│                                                         │
├─────────────────────────────────────────────────────────┤  ← ChatStatusStrip
│                                                         │
│  STREAMING:                                             │
│  ◎ Analyzing...             0:12  ~4.2k tokens          │
│                                                         │
│  WAITING-FOR-USER:                                      │
│  🛡 Waiting for your approval           0:23            │
│                                                         │
│  RATE-LIMITED:                                          │
│  ⏳ Rate limited — retrying in 12s      0:45            │
│                                                         │
│  SYSTEM-MESSAGE:                                        │
│  ℹ Compacting context...                               │
│                                                         │
│  COMPLETE:                                              │
│  0:32 · ~12.3k tokens   (60% opacity, auto-dismiss 8s) │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [chat input]                                           │
└─────────────────────────────────────────────────────────┘
```

#### Height Budget

- Streaming, waiting, rate-limited, system-message: `py-2` = 8px top + 8px bottom + content (~16px) = 32px total
- Complete: `py-2` same
- Container is `overflow-hidden` to prevent content from overflowing during height collapse animation

#### Typography

- All states: `text-2xs` or `text-xs` — matches existing `InferenceIndicator` values
- Elapsed time: `tabular-nums` for stable width (prevents layout jitter during countdown)
- Token count: no change from current

#### Color Palette

- Default states (streaming, complete): `text-muted-foreground` + `text-muted-foreground/70` + `text-muted-foreground/60`
- Alert states (waiting, rate-limited): `text-amber-600 dark:text-amber-400` — matches current
- System message: `text-muted-foreground/60` — matches current `SystemStatusZone`

#### Icon Contextual Upgrade (Optional Delight)

For `system/status` messages, pattern the icon on the message content:

- Contains "compact" or "compacting" → `RefreshCw` (12px, `text-muted-foreground/60`)
- Contains "permission" → `Shield` (12px, `text-muted-foreground/60`)
- Default → `Info` (current)

This is a small implementation detail but aligns icon semantics with message content — a hallmark of thoughtful UI.

---

### Hook Extraction Recommendation

The `InferenceIndicator` currently contains 4 distinct concerns mixed together:

1. **Snapshot logic** (`lastElapsedRef`, `lastTokensRef`, `showComplete`) — tracks post-stream values
2. **Rate-limit countdown** (`countdown` state, `setInterval`) — ticking timer
3. **Display derivation** (which state to show) — pure logic
4. **Rendering** — JSX

For the unified strip, extract:

- `useStripState(props)` → returns the current `StripState` discriminated union. Contains items 1–3.
- `ChatStatusStrip` renders only based on `StripState`. Contains item 4.

This aligns with `code-quality.md` function length limits (50 lines) and gives us a testable pure function (`deriveStripState`) plus a hook that encapsulates all the timers.

---

## Security Considerations

- System status message content (`systemStatus`) originates from the Claude Code SDK running locally — not from network inputs. No XSS risk when rendered via React text nodes.
- No user-controlled content enters the strip UI. Token counts and elapsed times are numbers.
- No security considerations specific to this feature.

---

## Performance Considerations

### Re-render Budget

The strip re-renders on every `elapsed` tick (from `useElapsedTime`) while streaming — approximately once per second. This is correct and low-cost: the component renders a small amount of text. The parent `ChatPanel` should NOT re-render on elapsed ticks — the `useElapsedTime` hook should be called inside the strip component (or its hook), not in `ChatPanel`.

Currently, `InferenceIndicator` is inside `MessageList`, and `ChatPanel` passes `streamStartTime` down. After consolidation, `useElapsedTime` will be called inside `ChatStatusStrip` directly — no prop-drilling of the formatted string required.

### Animation Frame Cost

- `height: auto` animation via Motion layout measurement: one extra paint frame at animation start. Acceptable — this only fires on strip enter/exit, not every tick.
- `AnimatePresence mode="wait"`: the old content renders for its exit duration (150ms) while the new content is waiting. Both are lightweight text nodes. No cost concern.
- The rotating verb re-render (every `verbInterval`, typically 3s): trivial.

### Eliminated Work

Moving `InferenceIndicator` out of `MessageList` removes it from the virtual list's render scope. MessageList currently passes 7 props (`streamStartTime`, `estimatedTokens`, `permissionMode`, `isWaitingForUser`, `waitingType`, `isRateLimited`, `rateLimitRetryAfter`) directly for the indicator. Removing these reduces `MessageList`'s prop interface and eliminates a source of spurious MessageList re-renders caused by the rate-limit countdown tick.

---

## Architectural Decision: Moving InferenceIndicator Out of MessageList

The current placement of `InferenceIndicator` inside `MessageList` (passed via `MessageList.tsx` props) was a pragmatic initial choice: the indicator needed to appear at the bottom of the thread, after the last message. Moving it outside the scroll container changes its spatial relationship — it will now appear _below_ the thread rather than _inside_ it.

**Implication for the user**: The inference indicator no longer scrolls with the message list. If the user scrolls up during inference, the strip remains visible at the fixed position below the thread. This is actually an _improvement_ — the status is always visible regardless of scroll position.

**Implementation consideration**: `MessageList` currently receives the indicator props and passes them to `AssistantMessageContent` or renders them at the bottom of the list. After consolidation, these props can be removed from `MessageList`'s interface entirely, which is a clean API reduction.

---

## Sources & Evidence

- "The Dynamic Island principle — a single morphing container that reshapes itself to communicate different contexts" — [Design dynamic Live Activities — WWDC23](https://developer.apple.com/videos/play/wwdc2023/10194/) (Apple, 2023)
- "Calm technology requires that user attention reside mainly in the periphery" — [Calm Technology — Wikipedia](https://en.wikipedia.org/wiki/Calm_technology)
- "Separate system status from generated content visually... use subtle motion to show progress without distracting from reading" — [Token Counter Pattern | UX Patterns for Developers](https://uxpatterns.dev/patterns/ai-intelligence/token-counter)
- "Model the request lifecycle explicitly: idle, validating, sending, streaming, complete, interrupted, and failed" — [UX Patterns for Developers](https://uxpatterns.dev/patterns/ai-intelligence/token-counter)
- "Limit the number of status bar items added... each item should earn its space through direct relevance to current context" — [VS Code Status Bar API Guidelines](https://code.visualstudio.com/api/ux-guidelines/status-bar)
- "The mode='wait' mode has the old element exit completely before the new one enters" — [AnimatePresence Modes — Motion Tutorial](https://motion.dev/tutorials/react-animate-presence-modes)
- VS Code context indicator causes "anxiety-inducing" stress — [VS Code GitHub Issue #293578](https://github.com/microsoft/vscode/issues/293578)
- `layoutId` allows shared element transitions where a container morphs between states — [Layout Animation — React FLIP & Shared Element | Motion](https://motion.dev/docs/react-layout-animations)
- Prior DorkOS research: compound component architecture — [StatusLine Compound Component Patterns](research/20260310_statusline_compound_component_patterns.md) (2026-03-10)
- Prior DorkOS research: system status & compact boundary — [System Status Messages & Compact Boundary UI Patterns](research/20260316_system_status_compact_boundary_ui_patterns.md) (2026-03-16)
- Prior DorkOS research: chat microinteraction animation — [Chat Microinteractions Polish](research/20260309_chat_microinteractions_polish.md) (2026-03-09)

---

## Research Gaps & Limitations

- No direct visual inspection of Cursor or Windsurf's inference status UI (rendered client-side, not accessible via fetch). Descriptions based on user reports and product documentation.
- The exact `MessageList` internal rendering path for `InferenceIndicator` was not fully traced — the implementation section should verify whether it renders at the bottom of the virtual list or is rendered as a static element after the virtualizer.
- The `useElapsedTime` hook's update frequency was not profiled — assumed ~1s based on the function name. If it updates faster (e.g., 100ms), the re-render cost above needs to be reconsidered.

---

## Contradictions & Disputes

- **Elapsed time display**: Claude.ai does not show elapsed time; DorkOS does. This is a deliberate product choice — DorkOS serves Kai (senior dev, wants data) while Claude.ai serves a broader audience. The DorkOS choice is correct for its persona.
- **Token count display**: Cursor removed their token indicator, then users requested it back. DorkOS's approach (small, muted, tabular-nums) threads the needle between "informative" and "anxiety-inducing" — it's present but not prominent.
- **System messages in thread vs. outside**: VS Code surfaced compaction as a chat message (got complaints). DorkOS's `SystemStatusZone` puts it outside the thread (correct per prior research `20260316_system_status_compact_boundary_ui_patterns.md`). This decision is confirmed correct by the prior research.

---

## Ultimate Recommendation

**Implement `ChatStatusStrip` using Approach 3 (State Machine with Prioritized Content Slots).**

### Implementation Summary

1. **New file**: `apps/client/src/layers/features/chat/ui/ChatStatusStrip.tsx`
   - Contains `ChatStatusStrip` component
   - Contains `deriveStripState()` pure function (export for testing)
   - Contains `StripState` discriminated union type

2. **New file (optional)**: `apps/client/src/layers/features/chat/model/use-strip-state.ts`
   - Contains `useStripState()` hook
   - Owns: `showComplete` state + auto-dismiss timer, `countdown` state + interval, `lastElapsedRef`, `lastTokensRef`
   - Returns `StripState`

3. **`ChatPanel.tsx` changes**:
   - Remove `<SystemStatusZone message={systemStatus} />` (line 353)
   - Add `<ChatStatusStrip>` in its place with the full set of inference + system props
   - Remove `SystemStatusZone` import

4. **`MessageList.tsx` changes**:
   - Remove `InferenceIndicator` rendering and all inference props from its interface
   - Props removed: `streamStartTime`, `estimatedTokens`, `permissionMode`, `isWaitingForUser`, `waitingType`, `isRateLimited`, `rateLimitRetryAfter`

5. **`SystemStatusZone.tsx`**: Delete once `ChatStatusStrip` is in place.
6. **`InferenceIndicator.tsx`**: Delete once `ChatStatusStrip` is in place.

### Priority Order (encoded in `deriveStripState`)

```
rate-limited → waiting-for-user → system-message → streaming → complete → idle
```

### Animation Stack

```
outer AnimatePresence (height collapse/expand, 200ms)
  └── inner AnimatePresence mode="wait" (crossfade, 150ms, key=state.type)
        └── streaming sub-animation: AnimatePresence mode="wait" on verb span (300ms)
```

### Why This Is Right

- **Simplest that could work**: No new libraries, no queues, no registries
- **Explicit priority**: `deriveStripState` is a pure function with a documented priority stack
- **Testable**: `deriveStripState` can be unit-tested with zero React mocking overhead
- **TypeScript-safe**: Discriminated union ensures exhaustive handling at compile time
- **Consistent with codebase**: Matches the two-boundary AnimatePresence pattern in `StatusLine.tsx`
- **Calm Tech compliant**: The strip communicates without interrupting — ambient, muted, glanceable
- **Apple quality test**: A single, coherent element that morphs between states rather than multiple competing elements blinking in and out

---

## Search Methodology

- Searches performed: 10
- Most productive terms: `calm technology ambient indicator design principles`, `VS Code status bar UX guidelines`, `AnimatePresence mode wait content swap`, `token counter UX patterns AI chat anxiety`
- Primary sources: Existing DorkOS research (3 highly relevant prior reports), motion.dev docs, VS Code API guidelines, Apple WWDC documentation, UX Patterns for Developers, Wikipedia (Calm Technology)
