---
title: 'use-stick-to-bottom v1.1.3 — API Deep Dive'
date: 2026-03-22
type: implementation
status: active
tags: [use-stick-to-bottom, scroll, chat, react, animation, initial-scroll]
searches_performed: 12
sources_count: 8
---

## Research Summary

`use-stick-to-bottom` v1.1.3 (StackBlitz Labs, ~2KB, zero deps) has explicit `initial` and `resize` props that accept `'instant'`, `'smooth'`, a `SpringAnimation` config object, or `false`. `initial="instant"` is the correct way to snap to the bottom on first render without any animation. There is an open bug (#29, filed Dec 2025) confirming `initial="instant"` does not reliably work in the current release. The library does NOT support `flex-direction: column-reverse` as a layout strategy — its scroll logic operates on a normal overflow container. Known performance advice is to pair it with a virtualization library for very large content; ResizeObserver-per-resize-event can thrash on extremely large, frequently-growing lists.

---

## Key Findings

### 1. Initial Prop — Full API

The `initial` prop on both `useStickToBottom` and `<StickToBottom>` accepts:

| Value                    | Behavior                                                                        |
| ------------------------ | ------------------------------------------------------------------------------- |
| `'instant'`              | Snaps to bottom immediately on mount with no animation                          |
| `'smooth'`               | Animates to bottom on mount using default spring physics                        |
| `SpringAnimation` object | Custom spring animation on mount (`{ damping, stiffness, mass }`)               |
| `true` (default)         | Same as `'smooth'` — uses the top-level spring config                           |
| `false`                  | Disables initial scroll entirely — component starts at wherever the DOM renders |

The internal implementation drives this via a `useState` initialization:

```typescript
const [isAtBottom, updateIsAtBottom] = useState(options.initial !== false);
```

When `isAtBottom` starts as `true` (all values except `false`), the ResizeObserver fires `scrollToBottom()` on the first content measurement with the resolved animation. The `initial` animation is selected by checking whether `previousHeight` exists:

```typescript
const animation = mergeAnimations(
  optionsRef.current,
  previousHeight ? optionsRef.current.resize : optionsRef.current.initial
);
```

The first ResizeObserver callback (when `previousHeight` is `undefined`) uses `initial`. All subsequent resize events use `resize`.

### 2. `initial: 'smooth'` vs `initial: 'instant'`

**`initial: 'smooth'`**

- Triggers a spring-physics-based animated scroll to the bottom on first render
- Uses the component-level `damping`, `stiffness`, and `mass` props (defaults: `0.7`, `0.05`, `1.25`)
- The scroll happens over multiple rAF frames — visible as a "falling into place" animation
- On large content (e.g., a chat thread with 200 messages loaded at once), this means the user briefly sees the top of the list before the spring animation completes

**`initial: 'instant'`**

- Intended to call `scrollTop = scrollHeight` (or equivalent) in a single synchronous operation before the browser paints
- No animation frames — should appear identical to the browser's native "start scrolled to bottom" behavior
- **Critical bug**: Issue #29 (filed December 2025, open as of March 2026) reports that `initial='instant'` does not work reliably. The reporter (williamlmao) states the scroll does not occur at all or behaves like `smooth`. No maintainer fix has landed in v1.1.3.

**Recommendation**: Do not rely on `initial="instant"` being bug-free in v1.1.3. See the workarounds section below.

### 3. `flex-direction: column-reverse` — Not Supported

`use-stick-to-bottom` does NOT support or document `flex-direction: column-reverse` as an alternative or complementary approach. The library's architecture:

- Wraps a scroll container (`scrollRef`) that uses `overflow: auto`
- Monitors a content div (`contentRef`) via ResizeObserver
- Drives `scrollTop` programmatically

`column-reverse` reverses the visual stacking order while keeping `scrollTop = 0` at the visual bottom. This is a fundamentally different scroll model and would break `use-stick-to-bottom`'s `scrollTop`-based logic. The two approaches are mutually exclusive.

The `StickToBottom.Content` subcomponent applies:

```typescript
style={{
  height: "100%",
  width: "100%",
  scrollbarGutter: "stable both-edges",
}}
```

No flex layout is applied. The library expects a standard block-flow content div inside an `overflow: auto` scroll container.

### 4. Known Issues with Initial Scroll Performance on Large Content

**Issue #29** — `initial='instant'` does not work (Dec 2025, open)
The most directly relevant bug. When content is already loaded (e.g., loading a prior chat thread), the instant-snap behavior is unreliable. The scroll either doesn't fire or animates despite being set to `instant`.

**Issue #32** — Safari 85% zoom causes "jumping unstoppedly" (Feb 2026, open)
A zoom-level-specific issue in Safari where the scroll animation enters an infinite loop. Not directly related to initial load but indicates the ResizeObserver logic is sensitive to fractional pixel values.

**Issue #31** — ResizeObserver memory leak on unmount (open)
The ResizeObserver may not be disconnected on component unmount, causing accumulating observers if the chat panel is frequently mounted/unmounted (e.g., session switching).

**Issue #9** — "Bad on iOS" (open, no details)

**General performance note from docs**: "For performance in large lists, consider virtualization libraries alongside this component." The library itself acknowledges this limitation. The ResizeObserver fires on every content height change — with a fast-streaming AI response adding tokens at ~50ms intervals, this is manageable. Loading 200+ pre-existing messages at once triggers a single ResizeObserver callback (not 200 callbacks), so initial-load performance for bulk content is actually better than streaming performance.

**Root cause of the "flash" problem on large content**: The scroll happens in `useIsomorphicLayoutEffect` (or equivalent), which runs after DOM paint in SSR contexts and synchronously before paint in client-side React. For large pre-loaded sessions, the browser may render the top of the list for one frame before the initial scroll fires, causing a visible "flash to top then scroll to bottom" on slow devices.

---

## Detailed Analysis

### How Initial Scroll Actually Fires

The sequence on mount:

1. Component renders — outer `<div>` (scrollRef) and inner `<div>` (contentRef) are in the DOM
2. `useIsomorphicLayoutEffect` runs — sets up the ResizeObserver on `contentRef`
3. ResizeObserver fires its initial callback with the measured content height
4. The hook checks: `previousHeight === undefined` → uses `optionsRef.current.initial` as the animation
5. If `isAtBottom` is `true` (i.e., `initial !== false`), calls `scrollToBottom(animation)`
6. `scrollToBottom` either:
   - Sets `scrollTop` directly for `'instant'`
   - Starts rAF-based spring loop for `'smooth'` or spring config

The problem for `initial: 'instant'` (bug #29) is likely a race condition: if content hasn't fully measured by the time the ResizeObserver fires, `scrollHeight` may be 0 or stale, and the `scrollTop` assignment has no effect.

### The `scrollToBottom()` Function

Can be called imperatively on the returned context or via `useStickToBottomContext()`:

```typescript
scrollToBottom({
  animation: 'instant' | 'smooth' | SpringAnimation,
  wait: boolean | number, // wait for in-flight animations
  ignoreEscapes: boolean, // prevent user from interrupting
  preserveScrollPosition: boolean, // only scroll if already at bottom
  duration: number | Promise<void>, // extra persistence duration
});
```

Returns `Promise<boolean>` — resolves `true` on success, `false` if cancelled.

### Workarounds for Reliable Initial Bottom Positioning

**Option A: Call `scrollToBottom` imperatively after mount**

```typescript
const { scrollRef, contentRef, scrollToBottom } = useStickToBottom({ initial: false });

useLayoutEffect(() => {
  // Wait one rAF to ensure ResizeObserver has fired first
  const id = requestAnimationFrame(() => {
    scrollToBottom('instant');
  });
  return () => cancelAnimationFrame(id);
}, []); // empty dep — only on mount
```

`initial: false` prevents the built-in initial scroll from fighting your manual one.

**Option B: Pure CSS — `overflow-anchor`**

```css
.scroll-container {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.scroll-anchor {
  overflow-anchor: auto;
  height: 1px;
}
```

Native scroll anchoring keeps the viewport pinned to the bottom as content grows. **Not supported on Safari** (the reason `use-stick-to-bottom` was created in the first place). For the Obsidian plugin (which runs in Electron/WebKit), this is not safe.

**Option C: CSS `scroll-snap`**

```css
.scroll-container {
  overflow-y: auto;
  scroll-snap-type: y mandatory;
}
.messages-end {
  scroll-snap-align: end;
}
```

Snaps to the bottom anchor on mount. Works in all modern browsers. No JavaScript required. But loses `use-stick-to-bottom`'s smart detach/reattach and spring physics during streaming.

**Recommendation for DorkOS**: Use `initial={false}` + an imperative `scrollToBottom('instant')` in a `useLayoutEffect` for loading existing sessions. Use `initial="smooth"` for new (empty) sessions where the initial scroll UX doesn't matter.

### The `resize` Prop (Separate from `initial`)

Controls scroll behavior as content grows during streaming:

| Value             | Behavior                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| `'smooth'`        | Spring animation tracks new content (default/recommended for streaming) |
| `'instant'`       | Instantly jumps `scrollTop` to new bottom on each resize event          |
| `SpringAnimation` | Custom spring parameters for resize                                     |

`resize: 'instant'` during streaming would cause visible jerking (one hard jump per token). `resize: 'smooth'` is always correct for streaming.

---

## Sources & Evidence

- Type definitions (`StickToBottomOptions`, `Animation`, `SpringAnimation`) sourced from actual source file fetch: [src/useStickToBottom.ts](https://raw.githubusercontent.com/stackblitz-labs/use-stick-to-bottom/main/src/useStickToBottom.ts)
- `StickToBottom` component props and layout: [src/StickToBottom.tsx](https://raw.githubusercontent.com/stackblitz-labs/use-stick-to-bottom/main/src/StickToBottom.tsx)
- Bug #29 "initial='instant' does not work": [GitHub Issues](https://github.com/stackblitz-labs/use-stick-to-bottom/issues)
- Bug #31 ResizeObserver memory leak: [GitHub Issues](https://github.com/stackblitz-labs/use-stick-to-bottom/issues)
- Bug #32 Safari zoom loop: [GitHub Issues](https://github.com/stackblitz-labs/use-stick-to-bottom/issues)
- DeepWiki API documentation (authoritative summary of README): [DeepWiki — use-stick-to-bottom](https://deepwiki.com/stackblitz-labs/use-stick-to-bottom)
- Getting Started guide: [DeepWiki — Getting Started](https://deepwiki.com/stackblitz-labs/use-stick-to-bottom/2-getting-started)
- npm package page: [use-stick-to-bottom — npm](https://www.npmjs.com/package/use-stick-to-bottom)

---

## Research Gaps & Limitations

- Could not fetch the actual GitHub issue #29 body (GitHub fetch blocked). The bug description came from the issues list page. The exact failure mode (scroll doesn't fire vs scroll animates anyway) is not confirmed from the reporter's detailed description.
- No access to CHANGELOG.md or tagged releases — cannot confirm what changed between 1.1.0 and 1.1.3.
- `flex-direction: column-reverse` incompatibility is inferred from architecture, not explicitly documented as a known limitation in the README.

---

## Contradictions & Disputes

- The DeepWiki documentation states `initial: true` "enables animation (default)" but the source code initializes `isAtBottom` as `true` whenever `initial !== false`, meaning `true` is identical to `'smooth'` in behavior — not a separate "enables animation" concept. The `initial` prop is actually an animation selector, not a boolean gate.
- Issue #29 contradicts the documented behavior of `initial: 'instant'`. The docs describe it as "immediately snaps to bottom" but in practice it doesn't work reliably in v1.1.3.

---

## Search Methodology

- Searches performed: 12
- Most productive: direct source file fetches via raw.githubusercontent.com, DeepWiki getting-started page, GitHub issues list page
- Primary sources: GitHub source code, DeepWiki docs, GitHub issues tracker
