---
title: 'Chat "Start at Bottom" Techniques — Initial Load Scroll Positioning'
date: 2026-03-22
type: external-best-practices
status: active
tags:
  [
    chat-ui,
    scroll,
    virtualization,
    tanstack-virtual,
    use-stick-to-bottom,
    flex-column-reverse,
    overflow-anchor,
    useLayoutEffect,
    initial-load,
  ]
searches_performed: 14
sources_count: 22
---

# Chat "Start at Bottom" Techniques — Initial Load Scroll Positioning

## Research Summary

Five approaches solve the "start at bottom" problem — where a chat loaded with history should present the latest messages without any visible top-to-bottom scroll animation. Each technique works at a different layer of the stack and has different compatibility characteristics with TanStack Virtual and `use-stick-to-bottom`. The unambiguous winner for a non-virtualized list is `use-stick-to-bottom` with `initial="instant"`. For a TanStack Virtual list, the only reliable technique is `initialOffset` set to `Infinity` (or a large sentinel value), combined with `use-stick-to-bottom` managing the outer scroll container — because `scrollToIndex` on dynamic-height items cannot guarantee reaching the true bottom before measurement completes.

---

## Key Findings

### 1. The Five Approaches Compared at a Glance

| Technique                                              | Works with TanStack Virtual           | Works without virtualizer                      | Flash of top visible                       | Complexity  | Accessibility        |
| ------------------------------------------------------ | ------------------------------------- | ---------------------------------------------- | ------------------------------------------ | ----------- | -------------------- |
| `flex-direction: column-reverse`                       | No — breaks absolute positioning      | Yes, with major caveats                        | Never                                      | Low CSS     | Problematic (see §2) |
| `overflow-anchor`                                      | No — not the right primitive          | Partial — prevents drift, not initial position | Yes unless combined with another technique | Trivial CSS | Fine                 |
| `useLayoutEffect` + instant `scrollTop = scrollHeight` | Requires care (see §4)                | Yes — the classic correct approach             | Never (fires before paint)                 | Low JS      | Fine                 |
| TanStack Virtual `initialOffset: Infinity`             | Yes — best virtualizer option         | N/A                                            | Never                                      | Medium      | Fine                 |
| Render recent messages only, load older on scroll-up   | Yes — independent of scroll technique | Yes — independent                              | Never                                      | High        | Fine                 |

**Summary verdict for DorkOS (TanStack Virtual + `use-stick-to-bottom`)**:
Use `initialOffset: Infinity` on the virtualizer to set initial scroll position without animation, and let `use-stick-to-bottom` with `initial="instant"` handle the outer scroll container. These two are complementary, not alternatives — the virtualizer controls which items are rendered; `use-stick-to-bottom` controls the scroll position of the outer container.

---

### 2. `flex-direction: column-reverse`

**The idea**: Render the message list container with `flex-direction: column-reverse`. The browser then treats the list's "start" as the bottom, so the latest messages appear at the bottom by default — no JavaScript scroll needed.

**How it works**: The browser's natural layout puts flex children at the top of a `column` container. Reversing this makes the first rendered child appear at the bottom. New items prepended to the DOM naturally grow upward. The scroll position, from the browser's perspective, is already at the "start" (which visually is the bottom).

**Pros**:

- Zero JavaScript for the initial position — no `useLayoutEffect`, no `scrollTo`
- Native browser overflow anchoring keeps the view pinned to the latest message as new content arrives
- No flash of the top of the list

**Critical cons**:

1. **Firefox bug — unfixed for 10+ years**: [Mozilla bug #1042151](https://bugzilla.mozilla.org/show_bug.cgi?id=1042151) documents that content overflowing off the "start" side of a `*-reverse` flex container is not scrollable. In a `column-reverse` container, messages at the top of the history are in the overflow-start direction — and Firefox cannot scroll to them. This is a showstopper for a real chat history. The bug has been open since 2013.

2. **Accessibility — WCAG violation**: The WCAG success criterion 1.3.2 (Meaningful Sequence) requires that when the sequence matters, the correct reading order be determinable from the source code. `column-reverse` creates a disconnect between visual order and DOM order — screen readers encounter messages in reverse order. Assistive technology reads the newest message first, then older ones, which is incorrect for a conversation. The [Checka11y.css project explicitly flags `column-reverse` as an accessibility problem](https://github.com/jackdomleo7/Checka11y.css/issues/55).

3. **Incompatible with TanStack Virtual**: TanStack Virtual positions items using `position: absolute` with `transform: translateY(offset)`. The offsets are calculated assuming a top-origin coordinate system. Placing the virtualizer inside a `column-reverse` flex container breaks the offset calculations entirely — items will render at wrong positions.

4. **Text selection is broken** in many implementations because the DOM order doesn't match visual order — the browser selects text in DOM order, not visual order.

5. **RocketChat found this in production**: [Rocket.Chat issue #24700](https://github.com/RocketChat/Rocket.Chat/issues/24700) describes a production bug with `flex-direction: column-reverse` causing scrollbar position differences across browsers.

**Verdict**: Do not use `column-reverse` in DorkOS. Firefox incompatibility + WCAG violation + TanStack Virtual incompatibility make this a non-starter.

---

### 3. `overflow-anchor` CSS Property

**The idea**: CSS `overflow-anchor` controls browser "scroll anchoring" — the browser feature that adjusts scroll position when content is added/removed to maintain what the user is looking at. Setting `overflow-anchor: auto` (the browser default) anchors to a visible element; setting `overflow-anchor: none` disables anchoring entirely.

**What it does and does not do**: This property is about _maintaining_ position during content insertion, not about _setting_ initial position. It does not help with the "start at bottom" initial load problem directly.

**Where it is relevant**: Two scenarios in a chat UI:

1. **Preventing unwanted jumps during streaming**: When `overflow-anchor: auto` is active and new content is added below the fold, the browser may adjust scroll position to keep the top-visible element stable — which in a chat list means the user's position doesn't drift while the AI is generating content below. This is generally _desired_ behavior.

2. **Preventing fights during explicit scroll management**: When you're using `use-stick-to-bottom` to programmatically scroll the container, `overflow-anchor: auto` can conflict — the browser tries to maintain position while your code tries to change it. `use-stick-to-bottom` exposes an `overflowAnchor` prop specifically to disable this conflict: pass `overflowAnchor="none"` to let the library manage scroll exclusively.

**Browser support**: Chrome 56+, Firefox 66+, Edge 79+. **Safari does not support `overflow-anchor`**. Per [caniuse.com](https://caniuse.com/css-overflow-anchor), this is approximately 85% global coverage — good for Chromium-heavy developer tools, but Safari support is absent.

**Verdict**: Not a solution for initial load positioning. Use it as a _complement_ to your scroll management library — specifically, let `use-stick-to-bottom` set `overflowAnchor="none"` on its scroll container to prevent browser anchoring from fighting the spring scroll animation.

---

### 4. `useLayoutEffect` + Instant `scrollTop = scrollHeight`

**The idea**: Before the browser paints the first frame, synchronously set `scrollTop` to `scrollHeight` on the scroll container. The user never sees the top of the list.

```typescript
// In the chat panel component
const scrollRef = useRef<HTMLDivElement>(null);
const hasScrolledToBottomRef = useRef(false);

useLayoutEffect(() => {
  if (scrollRef.current && !hasScrolledToBottomRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    hasScrolledToBottomRef.current = true;
  }
}, [messages]); // fires when messages first load
```

**Why `useLayoutEffect` and not `useEffect`**: `useLayoutEffect` runs synchronously after DOM mutations and before the browser has a chance to paint. Setting `scrollTop` here means the browser paints the element already scrolled to the bottom. `useEffect` runs after paint — the user will briefly see the top of the list before the scroll fires.

**Why `scrollTop = scrollHeight` and not `scrollIntoView`**: `scrollIntoView({ behavior: 'smooth' })` fires an animation, which is exactly what you're trying to avoid. `scrollIntoView({ behavior: 'instant' })` or `behavior: 'auto'` works but is equivalent to setting `scrollTop` directly. Direct assignment (`scrollTop = scrollHeight`) is explicit and has no timing ambiguity.

**The timing guarantee**: `scrollHeight` is available once the DOM is rendered but before paint — `useLayoutEffect` fires at exactly this moment. The sequence is: React renders → DOM updated → `useLayoutEffect` fires → `scrollTop` set → browser paints the already-scrolled state.

**The limitation — it only works on pre-rendered content**: This technique requires the full message list to be in the DOM when `useLayoutEffect` fires. If messages are loaded asynchronously (e.g., from a TanStack Query fetch), the `useLayoutEffect` fires with an empty DOM, sets `scrollTop = 0 = 0`, then messages load and the list starts at the top again. The fix is to gate on data being ready:

```typescript
useLayoutEffect(() => {
  if (!messages?.length || hasScrolledToBottomRef.current) return;
  const el = scrollRef.current;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
  hasScrolledToBottomRef.current = true;
}, [messages?.length]); // only fire once, after first load
```

**Compatibility with `use-stick-to-bottom`**: When you use `use-stick-to-bottom`, it manages `scrollTop` itself. You do not need this `useLayoutEffect` pattern — `use-stick-to-bottom` with `initial="instant"` performs the equivalent operation internally via its ResizeObserver-triggered scroll. Mixing manual `scrollTop` assignment with `use-stick-to-bottom` could cause a race condition during the first render.

**Compatibility with TanStack Virtual**: A TanStack Virtual list renders only visible rows. Setting `scrollTop = scrollHeight` is correct for the outer scroll container — the virtualizer will then render the rows at that scroll position. However, because rows have dynamic heights that haven't been measured yet, `scrollHeight` is an estimate. The virtualizer may render estimated-height rows, then re-measure them and adjust, which can cause the "undershoot" problem: the final scroll position is slightly above the true bottom. See §5 for the proper TanStack-specific solution.

**Verdict**: Correct pattern for non-virtualized lists. For virtualized lists, use `initialOffset` instead (§5). Do not combine with `use-stick-to-bottom` — let the library handle it with `initial="instant"`.

---

### 5. TanStack Virtual `initialOffset` / `scrollToIndex` on Last Item

**The `initialOffset` option**:

`useVirtualizer` accepts an `initialOffset` number (pixel value) that sets where the virtual list is positioned on initial render — without animation, before the first paint.

```typescript
const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 80, // estimated row height
  overscan: 5,
  initialOffset: Infinity, // or a very large sentinel like 9_999_999
  useFlushSync: false, // React 19 compatibility
});
```

Setting `initialOffset: Infinity` effectively scrolls to the maximum possible position — the true bottom — on first render. The virtualizer clamps this to the actual `scrollHeight` once it computes the total size.

**Why `Infinity` works but calculated values don't**: If you try to compute `(messages.length - 1) * estimatedRowHeight`, you get an approximation that's wrong whenever messages have variable heights. Chat messages always have variable heights. `Infinity` bypasses this: the browser's `scrollTop` cannot exceed `scrollHeight - clientHeight`, so clamping gives you the exact bottom.

**The `scrollToIndex` alternative and its problems**:

```typescript
// In a useLayoutEffect after mount:
virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'auto' });
```

This appears correct but has documented reliability issues with dynamic heights. When `scrollToIndex` is called with `behavior: 'auto'` (instant), TanStack Virtual calculates the offset using `estimateSize` for any items not yet measured. If actual item heights differ significantly from the estimate, the scroll lands short. Multiple GitHub issues document this:

- [Issue #468](https://github.com/TanStack/virtual/issues/468): `scrollToIndex` doesn't work correctly with dynamic heights
- [Issue #1001](https://github.com/TanStack/virtual/issues/1001): v3.13.8 doesn't scroll all the way to the bottom correctly
- [Discussion #911](https://github.com/TanStack/virtual/discussions/911): `useLayoutEffect` + `requestAnimationFrame` wrapper required, still falls short by ~40px

The `requestAnimationFrame` workaround defers the scroll one frame:

```typescript
const isMountedRef = useRef(false);
useLayoutEffect(() => {
  if (!isMountedRef.current && items.length > 0) {
    isMountedRef.current = true;
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(items.length - 1, { align: 'end', behavior: 'auto' });
    });
  }
}, [items]);
```

This is more reliable than plain `useLayoutEffect` but not perfectly reliable — if items are still being measured when the rAF fires, the calculation is still based on estimates.

**`shouldAdjustScrollPositionOnItemSizeChange`**: This virtualizer option fires when a measured item's actual height differs from the estimate and adjusts scroll position to compensate. It helps _maintain_ scroll position stability after initial load but doesn't fix the initial positioning problem.

**The robust solution — `initialOffset` with `use-stick-to-bottom` as the outer container**:

In DorkOS's architecture, `use-stick-to-bottom` wraps the outer scroll container, and TanStack Virtual renders inside the content div. The correct approach is:

```typescript
// The outer scroll container is managed by use-stick-to-bottom
const { scrollRef, contentRef } = useStickToBottom({
  initial: 'instant', // instant jump to bottom on mount
  damping: 0.7,
  stiffness: 0.05,
  mass: 1.25,
});

// TanStack Virtual operates inside contentRef
const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 80,
  overscan: 5,
  // No initialOffset needed — use-stick-to-bottom handles the initial position
  useFlushSync: false,
});
```

`use-stick-to-bottom` uses ResizeObserver on the content div. When the virtualizer renders content (even estimated heights), the content div grows, the ResizeObserver fires, and the library scrolls to the bottom of whatever is currently rendered. Because `initial="instant"`, this first scroll fires without animation. As the virtualizer measures actual row heights and re-renders, `use-stick-to-bottom` detects the content height change and adjusts — also without animation if still within the initial render window.

**What `initial` values `use-stick-to-bottom` accepts**:

From the TypeScript interface (type `Animation | boolean`):

| Value                          | Effect                                             |
| ------------------------------ | -------------------------------------------------- |
| `"instant"`                    | Jumps to bottom before first paint — no animation  |
| `"smooth"`                     | Spring-animates to bottom on mount                 |
| `"auto"`                       | Browser default scroll behavior                    |
| `false`                        | Does NOT scroll to bottom on mount — starts at top |
| `true`                         | Default spring animation                           |
| `{ damping, stiffness, mass }` | Custom spring config for initial scroll            |

For "start at bottom" on initial load: `initial="instant"`.

---

### 6. Render Recent Messages Only, Load Older on Scroll-Up

**The idea**: Instead of loading the full message history and scrolling to the bottom, only load the N most recent messages initially. Since only recent messages are rendered, the list is short and naturally starts at the bottom without any scroll manipulation.

**How production apps do it**:

- **Stream Chat SDK**: Loads the most recent 25 messages by default. Older messages are fetched when the user scrolls to the top, using cursor-based pagination (`id_lt` parameter — fetch messages older than ID X).
- **Discord**: Loads approximately 50 messages initially. When you open a channel, you see the most recent messages immediately. Older messages are loaded with a "Load previous messages" boundary or infinite scroll as you scroll up.
- **Slack**: Similar pattern — loads recent messages, older messages fetched on scroll-up.

**Implementation pattern**:

```typescript
// Initial load: only fetch recent messages
const { data: messages } = useQuery({
  queryKey: ['messages', sessionId, 'recent'],
  queryFn: () => fetchMessages(sessionId, { limit: 50, order: 'desc' }),
});

// On scroll to top: load older messages
const loadOlderMessages = async () => {
  const oldest = messages[0];
  const older = await fetchMessages(sessionId, {
    before: oldest.id,
    limit: 25,
  });
  // prepend to message list, preserve scroll position
};
```

**The scroll position preservation challenge**: When older messages are prepended to the list, the total scroll height increases and the user's position appears to jump up. The correct fix is to capture `scrollHeight` before prepending and restore the delta afterward:

```typescript
const prependMessages = async () => {
  const scrollEl = scrollRef.current;
  const scrollHeightBefore = scrollEl.scrollHeight;
  const scrollTopBefore = scrollEl.scrollTop;

  await addOlderMessages();

  // After state update and render:
  const scrollHeightAfter = scrollEl.scrollHeight;
  scrollEl.scrollTop = scrollTopBefore + (scrollHeightAfter - scrollHeightBefore);
};
```

This is the "scroll restoration delta" pattern used by every production chat app.

**Pros**:

- The initial load position problem is eliminated — a 50-message list renders instantly at the bottom because it's short enough that the bottom is in view
- Faster initial load (fewer messages fetched)
- Works with any scroll technique (virtualized or not)
- Scales to conversations with thousands of messages

**Cons**:

- Requires a backend that supports cursor-based pagination (DorkOS sessions read from JSONL files, which would need tail-reading support)
- Adds complexity: scroll preservation on prepend, loading state, edge cases when the user scrolls up during a fetch
- Prepend scroll restoration can flash if the ResizeObserver fires before the scroll adjustment

**DorkOS applicability**: DorkOS sessions are read from Claude Code's JSONL transcript files. The current `TranscriptReader` reads the entire file. Implementing tail-reading (read only the last N messages) is architecturally feasible but requires changes to the session service. This is the right long-term architecture for sessions with thousands of messages, but is overkill for typical sessions of 50–200 messages.

**Verdict**: The correct _long-term_ approach for large sessions. Not required today, but worth noting as the direction production chat apps take.

---

## How Slack, Discord, and Claude.ai Handle This

**Slack**: Renders recent messages only (tail-loading). The channel view always opens at the most recent message. When navigating to a specific linked message, Slack fetches messages around that ID and scrolls to it. Scroll position is cached per-channel in local state. Older messages load via bidirectional infinite scroll.

**Discord**: Same tail-loading pattern. Discord's client is Electron-based (React + Web). Channels open at the bottom by default. Discord's "NEW MESSAGE" divider marks where you left off. They have well-documented issues with images causing auto-scroll failures because image load events change `scrollHeight` after the initial scroll-to-bottom is set.

**ChatGPT**: Each conversation is a finite list (not a channel). Loads all messages. Scrolls to bottom using an approach equivalent to `scrollTop = scrollHeight` before first paint. The page is server-side rendered (Next.js), so the scroll happens client-side in a `useLayoutEffect`. There is no visible scroll animation on page load.

**Claude.ai**: Same pattern as ChatGPT — finite conversation list, loads all messages, `useLayoutEffect`-based scroll to bottom on mount. The session panel crossfades in after the scroll is set, masking any timing issues.

---

## Detailed Analysis: Which Technique for DorkOS

### Current State

DorkOS's `MessageList` uses TanStack Virtual. The outer scroll is managed by a `div` with `overflow-y: auto`. `use-stick-to-bottom` is already researched as the right library for streaming auto-scroll (per `research/20260320_chat_message_list_animations.md`).

### The Right Configuration

```typescript
// ChatPanel.tsx
import { useStickToBottom } from 'use-stick-to-bottom';
import { useVirtualizer } from '@tanstack/react-virtual';

function ChatPanel({ sessionId }: { sessionId: string }) {
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
    initial: 'instant',   // no animation on first load — start pinned to bottom
    damping: 0.7,
    stiffness: 0.05,
    mass: 1.25,
  });

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 5,
    useFlushSync: false, // React 19 compatibility
    // Do NOT set initialOffset here — use-stick-to-bottom handles it
  });

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto"
      // overflow-anchor: none is handled by use-stick-to-bottom internally
      // when overflowAnchor="none" is passed (default behavior)
    >
      <div ref={contentRef} style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <MessageItem message={messages[virtualRow.index]} />
          </div>
        ))}
      </div>
      {!isAtBottom && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute right-4 bottom-20 ..."
        >
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
```

**Why this works for initial load**:

1. On mount, `use-stick-to-bottom`'s ResizeObserver fires when the content div gets its first height from the virtualizer
2. `initial="instant"` means the first scroll-to-bottom fires without spring animation — the browser jumps to the bottom synchronously (before paint if the timing aligns, imperceptibly fast otherwise)
3. As TanStack Virtual measures actual row heights and updates `getTotalSize()`, the content div resizes again, the ResizeObserver fires again, and `use-stick-to-bottom` adjusts — also without visible animation because the adjustment is small (estimation error)
4. No manual `useLayoutEffect` + `scrollTop` needed — the library handles it

**The edge case**: If messages load asynchronously (e.g., TanStack Query `isLoading` → `isSuccess`), the content div is initially empty (height: 0). The ResizeObserver fires when messages arrive. With `initial="instant"`, this first resize fires an instant scroll. If the query is slow, the user will see an empty state first and then the messages appear at the bottom — which is correct behavior, not a problem.

---

## Decision Matrix

| Your setup                                                        | Recommended approach                                                                                                    |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| No virtualizer, messages all in DOM                               | `use-stick-to-bottom` with `initial="instant"`                                                                          |
| TanStack Virtual, `use-stick-to-bottom` wrapping scroll container | `use-stick-to-bottom` with `initial="instant"` — let ResizeObserver handle it                                           |
| TanStack Virtual, no `use-stick-to-bottom`                        | `initialOffset: Infinity` in `useVirtualizer` config                                                                    |
| TanStack Virtual, no scroll library, DIY                          | `useLayoutEffect` + `scrollTop = scrollHeight` once on mount, gated by `!hasScrolledRef.current && messages.length > 0` |
| Large sessions (1000+ messages)                                   | Tail-load recent messages only; render short list; no scroll manipulation needed                                        |
| Cannot use JS at all                                              | `flex-direction: column-reverse` — but only if you can drop Firefox and are OK with accessibility issues                |

---

## Sources & Evidence

- `flex-direction: column-reverse` Firefox overflow-scroll bug (unfixed since 2013): [Mozilla Bug #1042151](https://bugzilla.mozilla.org/show_bug.cgi?id=1042151)
- RocketChat production `column-reverse` scrollbar bug: [RocketChat Issue #24700](https://github.com/RocketChat/Rocket.Chat/issues/24700)
- Accessibility issue with `*-reverse` flex directions: [Checka11y.css Issue #55](https://github.com/jackdomleo7/Checka11y.css/issues/55)
- `overflow-anchor` browser support (no Safari): [Can I Use — CSS overflow-anchor](https://caniuse.com/css-overflow-anchor)
- TanStack Virtual `scrollToIndex` with dynamic heights not reaching bottom: [Issue #468](https://github.com/TanStack/virtual/issues/468), [Issue #1001](https://github.com/TanStack/virtual/issues/1001)
- TanStack Virtual scroll-to-bottom on init discussion: [Discussion #911](https://github.com/TanStack/virtual/discussions/911)
- TanStack Virtual initial index render without `scrollToIndex`: [Discussion #579](https://github.com/TanStack/virtual/discussions/579)
- TanStack Virtual reversed list with dynamic elements: [Discussion #195](https://github.com/TanStack/virtual/discussions/195)
- TanStack Virtual `initialOffset` and `shouldAdjustScrollPositionOnItemSizeChange` docs: [Virtualizer API — TanStack Virtual](https://tanstack.com/virtual/latest/docs/api/virtualizer)
- `use-stick-to-bottom` library (StackBlitz Labs): [GitHub — stackblitz-labs/use-stick-to-bottom](https://github.com/stackblitz-labs/use-stick-to-bottom)
- `use-stick-to-bottom` `initial` prop type `Animation | boolean`, accepts `"instant" | "smooth" | "auto" | false | SpringConfig`: [Getting Started — DeepWiki](https://deepwiki.com/stackblitz-labs/use-stick-to-bottom/2-getting-started)
- `use-stick-to-bottom` + TanStack Virtual compatibility (scrollRef = outer container, contentRef = inner height): [Chat Message List Animations research — DorkOS](research/20260320_chat_message_list_animations.md)
- `useLayoutEffect` fires after DOM mutation, before browser paint: [Deep Dive into useLayoutEffect — Medium](https://medium.com/@ignatovich.dm/deep-dive-into-uselayouteffect-in-react-with-examples-1e3b14da3d4f)
- Stream Chat SDK tail-loading pattern (most recent 25 messages default): [Channel Pagination — Stream Chat React](https://getstream.io/chat/docs/react/channel_pagination/)
- Stream Chat SDK reverse infinite scroll: [Infinite Scroll — Stream Chat React](https://getstream.io/chat/docs/sdk/react/guides/channel-list-infinite-scroll/)
- Cursor Community feature request confirming ChatGPT/Claude "start at bottom" expectation: [Cursor Forum — Chat Should Auto-Scroll to Latest Messages](https://forum.cursor.com/t/chat-should-auto-scroll-to-latest-messages-when-switching-conversations/134799)
- `overflow-anchor` usage for chat containers (MDN reference): [overflow-anchor — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor/Guide_to_scroll_anchoring)
- Scroll restoration delta pattern (capture scrollHeight before prepend, restore delta): [Streaming chat scroll to bottom with React — Dave Lage](https://davelage.com/posts/chat-scroll-react/)

---

## Research Gaps & Limitations

- Discord and Slack's exact implementation is not publicly documented. The behavior described is inferred from user-observable behavior, community reports, and general React/virtualization patterns.
- The exact TanStack Virtual version where the `initialOffset: Infinity` sentinel was confirmed safe was not pinned. Issue #1001 reports a fix in v3.13.15; confirm your TanStack Virtual version is ≥ 3.13.15.
- `use-stick-to-bottom`'s behavior when `initial="instant"` and the content div takes more than one ResizeObserver cycle to reach final height (due to dynamic rows measuring in multiple passes) was not directly observed. The expectation is that the library handles each resize event; the `instant` mode may only apply to the very first trigger.

---

## Contradictions & Disputes

- **`initialOffset: Infinity` vs `scrollToIndex(last, { align: 'end' })`**: `scrollToIndex` is the more "correct" API — it's designed for navigating to items. However, it fails with dynamic heights that haven't been measured. `initialOffset: Infinity` is a pragmatic hack (clamping behavior) but more reliable in practice. Prefer `initialOffset: Infinity` for initial positioning; prefer `scrollToIndex` for programmatic navigation to a specific message.

- **`useLayoutEffect` timing guarantee**: The standard claim is that `useLayoutEffect` fires before paint, preventing flash. This is true when messages are already in the React tree at render time. If messages come from async data (TanStack Query), they arrive in a subsequent render cycle, and `useLayoutEffect` from the first render has already fired with an empty list. This is a common source of bugs in chat implementations. `use-stick-to-bottom` sidesteps this entirely by using ResizeObserver, which fires any time content height changes — not just on mount.

---

## Search Methodology

- Searches performed: 14
- Most productive search terms: "TanStack Virtual chat scroll to bottom init dynamic heights", "use-stick-to-bottom initial prop instant", "flex column-reverse Firefox bug accessibility", "overflow-anchor Safari support", "TanStack Virtual initialOffset Infinity chat"
- Primary information sources: GitHub (TanStack/virtual, stackblitz-labs/use-stick-to-bottom, RocketChat), TanStack Virtual docs, Mozilla Bugzilla, DeepWiki, Stream Chat SDK docs, MDN
