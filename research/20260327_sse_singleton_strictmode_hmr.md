---
title: 'Maintaining a Single SSE Connection in React 19 — StrictMode, Vite HMR, and Singleton Patterns'
date: 2026-03-27
type: external-best-practices
status: active
tags:
  [
    sse,
    eventsource,
    react-strictmode,
    vite-hmr,
    module-singleton,
    useSyncExternalStore,
    import-meta-hot,
    connection-lifecycle,
    react-19,
  ]
feature_slug: sse-connection-optimization-01-consolidate
searches_performed: 0
sources_count: 0
---

# Maintaining a Single SSE Connection in React 19 — StrictMode, Vite HMR, and Singleton Patterns

## Research Summary

Four `/api/events` connections appearing after a fresh page load is a diagnostic fingerprint of two
overlapping problems: React StrictMode's intentional double-mount (which fires effects twice) and
the way `Root` creates `createAppRouter(queryClient)` inside the render function, causing TanStack
Router to re-initialize on every StrictMode re-render. The module-level singleton pattern already
used in `event-stream-context.tsx` is the correct architecture. The 4-connection count reveals a
subtle gap: `connect()` is called at module scope unconditionally, but the
`onStateChange` callback wiring in `useEffect` introduces a window during StrictMode's
unmount-remount cycle where a second `connect()` can fire from the reconnection backoff timer if
the server returns an error response quickly. Vite HMR does NOT re-execute module-level code for
modules that are parents of the changed module — only descendants are re-evaluated. The singleton
survives HMR in most cases but requires `import.meta.hot.data` to guarantee persistence when the
singleton's own module is edited. `useSyncExternalStore` is the correct React primitive for
wiring external state into React but does not solve the connection-creation problem; it only
affects how React reads state. SharedWorker is the ultimate solution for tab-level deduplication
but introduces significant complexity.

---

## Key Findings

1. **StrictMode mounts, unmounts, then remounts every component and effect — exactly once in
   development mode**: This is intentional and permanent in React 18+. The React team published
   RFC 0022 (Strict Effects) documenting why: to help developers find effects that are not
   "resilient to being run twice." The invariant is: if your effect creates a resource that is not
   cleaned up in the cleanup function, React will expose the double-allocation in development. The
   fix is never "disable StrictMode" but always "make the effect idempotent or use a singleton."

2. **Module-level singletons are the canonical fix for global resources in React**: TanStack
   Query's `QueryClient`, Zustand stores, and React Router's `Router` are all created at module
   scope (outside any component), for exactly this reason. A module-level singleton is initialized
   exactly once per JavaScript module evaluation — StrictMode effects cannot affect it. The
   existing `singletonConnection` in `event-stream-context.tsx` is architecturally correct.

3. **Vite HMR re-executes module code selectively**: When a file is edited, Vite re-evaluates
   that module and its dependents up the import graph, but only to the first "hot boundary"
   (typically the React component tree entry point). A module-level singleton in
   `event-stream-context.tsx` WILL be re-created if that file itself is edited, creating a second
   `EventSource` connection. The `import.meta.hot.data` API preserves arbitrary values across HMR
   boundaries, preventing this.

4. **`useSyncExternalStore` is correct for reading external state but does not prevent extra
   connections**: It solves the "tearing" problem (React reading stale state during concurrent
   renders) and avoids the `useEffect` + `useState` pattern's extra render cycle. It does not
   affect how many times `connect()` is called because connection creation happens in module scope,
   not in the subscribe function. For DorkOS's use case — propagating `connectionState` changes
   from the singleton into React — it is a clean upgrade to the current `useEffect`/`setState`
   pattern.

5. **The `onStateChange` mutable variable pattern has a StrictMode race condition**: The current
   code uses `let onStateChange = null` which is set/nulled by the provider's `useEffect`. During
   StrictMode's unmount phase, `onStateChange` is set to `null`. If the singleton fires a state
   change between the unmount and the remount (e.g., fast reconnection), that change is silently
   dropped. `useSyncExternalStore` eliminates this by making the subscription permanent and
   React-managed.

6. **The actual 4-connection root cause is almost certainly `createAppRouter` inside `Root`**:
   `main.tsx` calls `createAppRouter(queryClient)` inside the `Root` render function body. TanStack
   Router creates a router instance with internal effects (including SSE-like polling in some
   versions). More importantly, calling `createAppRouter` in render means StrictMode calls it
   twice, which can trigger internal TanStack Router cleanup/restart cycles. Each restart walks
   the provider tree and may trigger provider remounts below it. This should be moved to module
   scope (outside `Root`).

7. **SharedWorker for cross-tab deduplication is an advanced pattern worth knowing but not
   necessary here**: A SharedWorker runs a single script instance shared across all same-origin
   tabs. An SSE connection inside a SharedWorker means one connection per origin rather than one
   per tab. The complexity cost is significant: message port communication, worker lifecycle, error
   handling across worker boundaries. Appropriate only if connection count at the browser level (not
   just within React) is a concern.

---

## Detailed Analysis

### 1. React StrictMode Double-Mount: Mechanism and Intent

#### What Actually Happens

In development mode only, React 18+ StrictMode deliberately runs a mount → unmount → remount
cycle for every component and every `useEffect`. The sequence is:

```
1. Component renders (first time)
2. Effects run (useEffect callbacks fire)
3. Component "unmounts" — effect cleanup functions run
4. Component "remounts" — effect callbacks fire again
```

This happens synchronously in the same JavaScript microtask queue. It does NOT trigger real DOM
removal/insertion visible to users; it only exercises the cleanup path of `useEffect`.

The stated React team rationale (from Dan Abramov's posts and the Strict Effects RFC): React's
upcoming concurrent features (Offscreen API, which is still in development) will mount/unmount
components without the user seeing any visual change. If an effect creates a permanent side effect
with no cleanup, it will fire twice in concurrent mode — creating doubled connections, timers, or
subscriptions. StrictMode's double-mount is a development-time detector for exactly this bug.

#### Why Effects Cannot Own Long-Lived External Connections

The React model requires that anything created in an effect is cleaned up in its cleanup function.
For long-lived connections (EventSource, WebSocket, long-polling), this creates a conflict: the
cleanup tears down the connection, but the connection should outlive the component for application
correctness.

The resolution is: **do not create long-lived connections in effects at all**. Effects are for
connecting React state to existing external systems — not for creating those systems. The external
system (the SSE connection) should exist independently of the React tree.

```typescript
// Wrong: effect creates AND manages the connection
useEffect(() => {
  const es = new EventSource('/api/events'); // Created here
  return () => es.close(); // StrictMode tears this down and recreates it
}, []);

// Right: module-level singleton, effect only subscribes
const globalConnection = new SSEConnection('/api/events', options);
globalConnection.connect(); // Happens once at module load

function MyProvider() {
  useEffect(() => {
    // Only subscribes to an already-existing connection
    const unsub = globalConnection.onStateChange(setState);
    return () => unsub(); // Cleanup removes the listener, not the connection
  }, []);
}
```

This is the exact pattern DorkOS uses in `event-stream-context.tsx`. It is correct.

#### The `onStateChange` Mutable Variable Problem

The current implementation uses a module-level mutable variable:

```typescript
let onStateChange: ((state: ConnectionState, attempts: number) => void) | null = null;

const singletonConnection = new SSEConnection('/api/events', {
  onStateChange: (state, attempts) => {
    onStateChange?.(state, attempts); // Delegates to whatever is currently assigned
  },
});
```

The provider's `useEffect` sets and clears this:

```typescript
useEffect(() => {
  onStateChange = (state, attempts) => {
    setConnectionState(state);
    setFailedAttempts(attempts);
  };
  return () => {
    onStateChange = null; // Cleared on unmount
  };
}, []);
```

The StrictMode unmount-remount sequence is:

```
1. Effect runs → onStateChange = setSomething
2. StrictMode cleanup → onStateChange = null       ← window opens
3. SSE event fires → onStateChange?.() is a no-op  ← state change dropped
4. StrictMode remount → onStateChange = setSomething
```

For the initial connection status ('connecting' → 'connected'), the connection happens at module
scope before React mounts. If the connection resolves in the window between steps 2 and 4, the
'connected' state is lost and the UI stays stuck on 'connecting' until the next state change.

In practice this window is extremely short (microseconds), but it is a logical bug.

#### Recommended Fix: `useSyncExternalStore`

React 18 introduced `useSyncExternalStore` specifically for subscribing to external stores that
live outside React. It takes a `subscribe` function and a `getSnapshot` function:

```typescript
import { useSyncExternalStore } from 'react';

// The subscribe function receives a callback to notify React of external changes.
// It must return an unsubscribe function.
// React guarantees this is called only once per mounting (not double-called by StrictMode).
const connectionState = useSyncExternalStore(
  // subscribe
  (onStoreChange) => {
    const prevOnStateChange = onStateChange;
    onStateChange = (_state, _attempts) => {
      prevOnStateChange?.(_state, _attempts);
      onStoreChange(); // Notify React to re-read the snapshot
    };
    return () => {
      onStateChange = prevOnStateChange ?? null;
    };
  },
  // getSnapshot (called synchronously by React whenever it re-renders)
  () => singletonConnection.getState(),
  // getServerSnapshot (for SSR — can be same as getSnapshot for SPAs)
  () => singletonConnection.getState()
);
```

However, there is a simpler path: replace the mutable `onStateChange` variable with a `Set` of
callbacks (eliminating the single-listener limitation) and wire it via `useSyncExternalStore` or
a simple subscriber list pattern that the effect adds/removes from. The mutable variable pattern
works but is fragile; a subscriber Set pattern is more robust.

---

### 2. Module-Level Singletons: The Right Pattern

#### Why Module Scope Works

JavaScript modules are evaluated exactly once per JavaScript realm (tab). `import` statements are
idempotent — importing the same module a hundred times returns the same cached module object.
Module-level code runs once, period. This is guaranteed by the ECMAScript module specification.

```typescript
// sse-connection-singleton.ts
// This block runs ONCE when the module is first imported, regardless of:
// - How many components import it
// - How many times React remounts providers
// - StrictMode double-mounting
// - Multiple hook instances

const singletonConnection = new SSEConnection('/api/events', options);
singletonConnection.connect();

export { singletonConnection };
```

TanStack Query's `QueryClient`, Zustand's `create()` stores, and React Router's router creation are
all idiomatic examples of this pattern in widely-used React libraries.

#### Comparison with Other Libraries

**TanStack Query (`QueryClient`)**:

```typescript
// From TanStack Query docs and source
const queryClient = new QueryClient(); // Module scope
// Passed as a prop to QueryClientProvider — never created inside React
```

**Zustand**:

```typescript
// Zustand store creation IS at module scope
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
// The store (external subscription target) exists outside React
```

**socket.io-client** (from their React StrictMode guidance and GitHub issues):

```typescript
// socket.io-client's recommended StrictMode pattern
// From: https://socket.io/how-to/use-with-react-strict-mode
let socket; // module scope, or closure scope above Provider
function SocketProvider({ children }) {
  useEffect(() => {
    socket = io(SERVER_URL);
    return () => {
      socket.disconnect(); // Only called once in production; twice in StrictMode dev
    };
  }, []);
}
```

Note: socket.io's recommended approach actually accepts the double-connect in development, because
the library is designed to handle reconnection gracefully. But for SSE where server-side resources
are allocated per connection, this is unacceptable — hence the module-scope approach.

---

### 3. Vite HMR and Module-Level Singletons

#### When HMR Re-Executes Module Code

Vite's HMR works by walking up the import dependency graph from the changed file, looking for a
"hot boundary" — a module that can accept HMR updates (usually a React component wrapped with
`@vitejs/plugin-react`'s transform). When it finds one:

1. The changed module and all modules in between are re-evaluated
2. The hot boundary module's update function runs
3. React components in the hot boundary are refreshed via React Refresh

For `event-stream-context.tsx`:

- If a **downstream file** (a component that imports from `event-stream-context.tsx`) is edited,
  the HMR boundary is usually that component. `event-stream-context.tsx` itself is NOT
  re-evaluated. The singleton survives.
- If `event-stream-context.tsx` **itself** is edited, Vite re-evaluates it. The singleton is
  re-created. A new `EventSource` is opened while the old one remains open briefly. This is the
  HMR case that causes an extra connection during development.

#### `import.meta.hot.data` — The HMR Persistence API

Vite exposes `import.meta.hot.data` as a key-value store that persists across HMR updates for a
given module. It is the correct mechanism for preserving module-level state across edits:

```typescript
// At the top of event-stream-context.tsx (or sse-connection-singleton.ts)

// Retrieve or create the singleton — HMR-safe
function getOrCreateConnection(): SSEConnection {
  if (import.meta.hot) {
    // In HMR mode: reuse the connection from the previous module evaluation
    if (import.meta.hot.data.singletonConnection) {
      return import.meta.hot.data.singletonConnection as SSEConnection;
    }
  }

  const connection = new SSEConnection('/api/events', {
    eventHandlers: buildEventHandlers(),
    onStateChange: (state, attempts) => {
      onStateChange?.(state, attempts);
    },
  });
  connection.connect();
  connection.enableVisibilityOptimization();

  if (import.meta.hot) {
    import.meta.hot.data.singletonConnection = connection;

    // When this module is about to be replaced, clean up listeners registered
    // in the old module (eventHandlers reference old function closures)
    import.meta.hot.dispose(() => {
      // Do NOT destroy the connection — we want to reuse it
      // Just clear the old event handlers so they don't leak
      // (The new module evaluation will re-register handlers via buildEventHandlers)
    });
  }

  return connection;
}

const singletonConnection = getOrCreateConnection();
```

The critical subtlety: `import.meta.hot.data` is not available in production builds — `import.meta.hot`
is `undefined` when HMR is disabled. The `if (import.meta.hot)` guard is required. Vite's tree-
shaker removes the dead branch in production builds.

#### `import.meta.hot.accept()` Pattern

For modules that should accept their own updates (rather than bubbling up), `accept()` is used:

```typescript
if (import.meta.hot) {
  import.meta.hot.accept(); // Accept updates to this module without full page reload
}
```

For the SSE singleton module, calling `accept()` with no callback means: "when this module changes,
re-evaluate it and use the new exports, but do not trigger a full page reload." Combined with
`import.meta.hot.data`, this preserves the connection instance across edits.

However, accepting updates for a context/provider module can cause subtle React issues if the
new module re-exports different component references (React Refresh detects this and does a full
reload when component identities change). The simpler approach for DorkOS is to split the
singleton creation into its own small file (`sse-singleton.ts`) that is unlikely to be frequently
edited, while the context/hooks logic lives in `event-stream-context.tsx`.

---

### 4. The Actual 4-Connection Root Cause in DorkOS

Based on reading `main.tsx` and the provider structure, the most likely cause of 4 connections is
**`createAppRouter(queryClient)` being called inside the `Root` render function body**.

```typescript
// main.tsx — current code
function Root() {
  // ...
  const router = createAppRouter(queryClient); // Called on every render!
  return (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>
        <EventStreamProvider>          // ← This provider mounts, unmounts, remounts
          ...
        </EventStreamProvider>
      </TransportProvider>
    </QueryClientProvider>
  );
}
```

TanStack Router's `createRouter` (which `createAppRouter` likely wraps) creates a Router instance
that includes:

- Internal `useEffect` calls for navigation listening
- Internal context providers
- Possibly internal SSE/polling for devtools

More critically: when `createAppRouter` is called inside render, every StrictMode re-render creates
a new router instance. This can cause the `RouterProvider` (and everything below it, including
`EventStreamProvider`) to unmount and remount more than the expected 2 times.

StrictMode double-mount with a router that remounts on every render could produce:

- Mount 1: EventStreamProvider mounts → `useEffect` wires `onStateChange`
- Unmount: `onStateChange = null`, but the singleton fires a state change → ignored
- Mount 2: provider remounts → `useEffect` wires `onStateChange` again
- Router re-renders (new instance) → EventStreamProvider remounts again (2×)
- Total: 4 effect executions

**Fix**: Move `createAppRouter` to module scope, like `queryClient` and `transport`:

```typescript
// main.tsx — after fix
const queryClient = new QueryClient({ ... });
const transport = new HttpTransport(getApiBaseUrl());
const router = createAppRouter(queryClient); // Module scope — created once

function Root() {
  // ...
  return (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>
        <EventStreamProvider>
          <ExtensionProvider deps={extensionDeps}>
            <PasscodeGateWrapper>
              <RouterProvider router={router} />  // Stable router reference
            </PasscodeGateWrapper>
          </ExtensionProvider>
        </EventStreamProvider>
      </TransportProvider>
    </QueryClientProvider>
  );
}
```

After this fix, StrictMode should produce exactly 2 provider mounts (mount → unmount → remount)
with 1 `EventSource` connection throughout (since the singleton is at module scope).

---

### 5. `useSyncExternalStore` Implementation

`useSyncExternalStore` is the correct React 18+ primitive for reading external store state.
Key differences from `useEffect` + `useState`:

| Aspect                       | `useEffect` + `useState`       | `useSyncExternalStore`               |
| ---------------------------- | ------------------------------ | ------------------------------------ |
| Extra render on subscription | Yes — effect fires after paint | No — synchronous read                |
| Tearing in concurrent mode   | Possible                       | Prevented by design                  |
| StrictMode behavior          | Runs subscribe twice           | Runs subscribe once per mount        |
| Cleanup on unmount           | Manual, via return fn          | Automatic, via return fn             |
| Stale state during render    | Possible                       | Impossible (snapshot is synchronous) |

**Concrete implementation for DorkOS**:

```typescript
import { useSyncExternalStore } from 'react';

// In event-stream-context.tsx — replace the useEffect/useState pattern

// Replace the mutable `onStateChange` variable with a subscriber set:
type StateListener = (state: ConnectionState, attempts: number) => void;
const stateListeners = new Set<StateListener>();

const singletonConnection = new SSEConnection('/api/events', {
  eventHandlers: buildEventHandlers(),
  onStateChange: (state, attempts) => {
    for (const listener of stateListeners) {
      listener(state, attempts);
    }
  },
});

singletonConnection.connect();
singletonConnection.enableVisibilityOptimization();

// Snapshot shape
interface ConnectionSnapshot {
  connectionState: ConnectionState;
  failedAttempts: number;
}

// In the provider:
export function EventStreamProvider({ children }: { children: React.ReactNode }) {
  const { connectionState, failedAttempts } = useSyncExternalStore(
    // subscribe — called once on mount, returns unsubscribe
    (onStoreChange) => {
      const listener: StateListener = (_state, _attempts) => {
        onStoreChange(); // Signal React to re-read the snapshot
      };
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    // getSnapshot — called synchronously during render
    (): ConnectionSnapshot => ({
      connectionState: singletonConnection.getState(),
      failedAttempts: singletonConnection.getFailedAttempts(),
    }),
    // getServerSnapshot — same as getSnapshot for SPAs
    (): ConnectionSnapshot => ({
      connectionState: singletonConnection.getState(),
      failedAttempts: singletonConnection.getFailedAttempts(),
    })
  );

  // ... rest of provider
}
```

One subtlety: `useSyncExternalStore`'s `getSnapshot` must return a **stable reference** if the
value has not changed (or the same primitive). The current implementation returns a new object on
every call, which will cause infinite re-renders. Options:

**Option A**: Return primitives directly (two separate `useSyncExternalStore` calls):

```typescript
const connectionState = useSyncExternalStore(
  subscribe,
  () => singletonConnection.getState(),
  () => singletonConnection.getState()
);
const failedAttempts = useSyncExternalStore(
  subscribe,
  () => singletonConnection.getFailedAttempts(),
  () => singletonConnection.getFailedAttempts()
);
```

**Option B**: Cache the last snapshot and return the same object reference if unchanged:

```typescript
let lastSnapshot: ConnectionSnapshot = {
  connectionState: singletonConnection.getState(),
  failedAttempts: singletonConnection.getFailedAttempts(),
};

function getSnapshot(): ConnectionSnapshot {
  const current = singletonConnection.getState();
  const currentAttempts = singletonConnection.getFailedAttempts();
  if (current === lastSnapshot.connectionState && currentAttempts === lastSnapshot.failedAttempts) {
    return lastSnapshot; // Same reference — React skips re-render
  }
  lastSnapshot = { connectionState: current, failedAttempts: currentAttempts };
  return lastSnapshot;
}
```

Option A is simpler and cleaner for two primitive values.

---

### 6. Edge Cases and Gotchas

#### Race Condition: Module Connects Before React Mounts

`singletonConnection.connect()` runs at module evaluation time — before React mounts the provider
tree. This means:

1. Module loads → `connect()` called → `EventSource` opens
2. Server sends 'connected' event immediately
3. `onStateChange` callback fires → no listeners registered yet (provider not mounted)
4. React mounts → provider registers listener → sees initial state via `getState()`

The current code handles this via `setConnectionState(singletonConnection.getState())` in the
`useEffect`, reading the current state synchronously after the subscription is registered. With
`useSyncExternalStore`, this is handled automatically — `getSnapshot()` reads the current state
synchronously during render, so no initial sync is needed.

This is a feature, not a bug: the connection being established before React mounts means the
first render that reads the connection state gets the real current state, not a stale 'connecting'
state.

#### Browser Tab Visibility and Connection Lifecycle

The existing `enableVisibilityOptimization()` implementation is correct. One subtlety:
`document.visibilitychange` fires even when the user switches to DevTools — the tab is technically
"hidden" while DevTools is open in a separate window. The grace period (30s default) handles
this, but it's worth knowing if debugging connection lifecycle with DevTools appears to show
unexpected disconnects.

#### Multiple Browser Tabs

Each browser tab is an independent JavaScript realm. Module-level singletons are tab-scoped.
If a user has 3 tabs open to the DorkOS app, there will be 3 `/api/events` connections to the
server — one per tab. This is correct and expected. The server's fan-out mechanism handles
broadcast to all connections.

If the concern is server-side connection count at scale, SharedWorker is the solution. For a
self-hosted developer tool with at most a few tabs open, this is not a concern.

#### EventSource Native Reconnection vs. Managed Reconnection

The browser's native `EventSource` auto-reconnects on network errors (not HTTP errors) using the
`retry:` field from the server. The `SSEConnection` class wraps `EventSource` and implements its
own backoff. These two reconnection mechanisms can interact:

1. Network drop → native `EventSource` tries to reconnect
2. Server responds with a 503 → `EventSource` fires `onerror` without auto-reconnect
3. `SSEConnection.handleConnectionError()` catches this and schedules a backoff reconnect

The `SSEConnection.connect()` method calls `this.closeEventSource()` first, which prevents the
native `EventSource`'s reconnect from firing (since `close()` stops reconnection). This is
intentional and correct — managed reconnection takes over.

#### Listener Accumulation Memory Leak

The module-level `listeners` Map accumulates handler references. If a component subscribes via
`useEventSubscription` but forgets to call the returned unsubscribe function (or fails due to
a thrown error in the component), the handler remains in the set forever.

The current `useEventSubscription` implementation uses `useEffect` to register/unregister, which
is correct — React guarantees effect cleanup runs even if the component throws after mounting.
The ref-stabilized handler pattern ensures that stale closures are not kept alive.

However, if the `EventStreamProvider` is unmounted (which should not happen in practice since
it's at the root), the module-level `listeners` Map retains all registered handlers — they are
never cleaned up because the unsubscribe functions (returned by `subscribe()`) are only called
by component unmounts, and if the provider itself unmounts first, those components may not fire
their cleanup.

The fix is `listeners.clear()` in a provider `useEffect` cleanup — but since the provider should
never unmount in production (it's at the root), this is a theoretical concern.

---

### 7. Alternative Approaches

#### SharedWorker

A `SharedWorker` runs one instance of a script per origin, shared across all tabs and windows.
An `EventSource` inside a SharedWorker means one connection shared across all tabs, with results
broadcast via `MessagePort` to each tab's main thread.

**Implementation sketch**:

```typescript
// sse-worker.ts (SharedWorker)
const clients = new Set<MessagePort>();
const es = new EventSource('/api/events');

es.addEventListener('tunnel_status', (e) => {
  for (const port of clients) {
    port.postMessage({ type: 'tunnel_status', data: JSON.parse(e.data) });
  }
});

self.addEventListener('connect', (e: MessageEvent) => {
  const port = e.ports[0];
  clients.add(port);
  port.addEventListener('message', () => {}); // Keep port alive
  port.start();
  port.addEventListener('close', () => clients.delete(port));
});
```

**Tradeoffs**:

- Pro: One connection regardless of how many tabs are open
- Pro: Events delivered to all tabs simultaneously
- Con: Significant complexity increase — worker lifecycle, error propagation across boundary,
  TypeScript type assertions, no `import.meta` or Vite aliases in workers
- Con: SharedWorker has poor support in some browsers (Firefox has issues, Safari 16+)
- Con: DevTools debugging of workers is a separate flow
- Verdict: Not recommended for DorkOS at this stage. The per-tab model is correct.

#### Zustand Middleware for External Subscriptions

Some teams put the SSE connection inside a Zustand store using middleware. The pattern:

```typescript
const useConnectionStore = create<ConnectionState>()(
  subscribeWithSelector((set) => ({
    connectionState: 'connecting' as ConnectionState,
    failedAttempts: 0,
  }))
);

// Wire the singleton to the store at module scope
singletonConnection.onStateChange((state, attempts) => {
  useConnectionStore.setState({ connectionState: state, failedAttempts: attempts });
});
```

This is functionally equivalent to the current approach but routes through Zustand's change
detection instead of React context. It avoids the provider/context overhead entirely. Components
use `useConnectionStore` directly. For DorkOS, the current context-based approach is fine — but
this is a valid simplification if the EventStreamProvider is causing provider tree complexity.

#### `@microsoft/fetch-event-source`

As documented in `research/20260324_sse_resilience_production_patterns.md`, this library wraps
`fetch()` instead of `EventSource`, enabling POST support, custom headers, and visibility-aware
reconnection. The module-level singleton pattern applies equally well. The library's `AbortController`-
based lifecycle maps cleanly to the singleton pattern: create the `AbortController` at module
scope, call `fetchEventSource()` at module scope, and the abort signal handles cleanup on
`destroy()`.

---

## Conclusion: Concrete Recommendations for DorkOS

The module-level singleton architecture in `event-stream-context.tsx` is correct and should be
preserved. The 4-connection count has two likely causes that should each be fixed:

### Fix 1 (High Priority): Move `createAppRouter` to Module Scope

In `main.tsx`, `createAppRouter(queryClient)` is called inside the `Root` function body. This
creates a new router instance on every render, which causes TanStack Router to remount its
provider tree more than the expected 2 times during StrictMode's double-mount cycle. Move it
to module scope alongside `queryClient` and `transport`:

```typescript
// main.tsx
const queryClient = new QueryClient({ ... });
const transport = new HttpTransport(getApiBaseUrl());
const router = createAppRouter(queryClient); // ← Move here

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>
        <EventStreamProvider>
          ...
          <RouterProvider router={router} />
        </EventStreamProvider>
      </TransportProvider>
    </QueryClientProvider>
  );
}
```

This is documented in the TanStack Router docs: the Router instance must be stable across renders.

### Fix 2 (Medium Priority): Add `import.meta.hot.data` Guard

Edit `event-stream-context.tsx` to preserve the singleton across HMR when the file itself is
edited. Split singleton creation into a factory function that checks `import.meta.hot.data`:

```typescript
function getOrCreateSingleton(): SSEConnection {
  if (import.meta.hot?.data.singletonConnection) {
    return import.meta.hot.data.singletonConnection as SSEConnection;
  }
  const conn = new SSEConnection('/api/events', {
    eventHandlers: buildEventHandlers(),
    onStateChange: (state, attempts) => {
      for (const listener of stateListeners) listener(state, attempts);
    },
  });
  conn.connect();
  conn.enableVisibilityOptimization();
  if (import.meta.hot) {
    import.meta.hot.data.singletonConnection = conn;
  }
  return conn;
}

const singletonConnection = getOrCreateSingleton();
```

### Fix 3 (Low Priority): Replace Mutable `onStateChange` with `stateListeners` Set

The mutable `let onStateChange` variable is a single-listener pattern that has a StrictMode
unmount window where state changes are silently dropped. Replace with a `Set<StateListener>` and
optionally migrate to `useSyncExternalStore`:

```typescript
// Replace:
let onStateChange: ((state: ConnectionState, attempts: number) => void) | null = null;

// With:
type StateListener = (state: ConnectionState, attempts: number) => void;
const stateListeners = new Set<StateListener>();
```

The provider registers/deregisters itself via `useEffect`. The singleton's `onStateChange` option
iterates the set. This survives StrictMode's unmount-remount because if `onStateChange` fires
between unmount and remount, there are simply zero listeners — state is not dropped, it just does
not trigger a React re-render. On remount, `getState()` is read synchronously to sync the provider.

### What Does NOT Need Changing

- The `SSEConnection` class itself is correctly implemented
- `singletonConnection.connect()` at module scope is correct
- `useEventSubscription`'s ref-stabilized handler pattern is correct
- The `listeners` Map fan-out is correct
- Provider-not-destroying-the-singleton is correct

---

## Research Gaps

- Web search was not available during this research session. Specific GitHub issues from TanStack
  Router, socket.io, or Zustand about StrictMode were referenced from training knowledge rather
  than live sources.
- The exact behavior of `import.meta.hot.data` across Vite 6.x minor versions should be confirmed
  against the current Vite changelog.
- The TanStack Router version in use was not checked — behavior of `createRouter` inside render
  may differ across versions.

---

## Search Methodology

- No web searches were performed (tool unavailable in this environment)
- Analysis based on: reading `event-stream-context.tsx`, `sse-connection.ts`, `main.tsx`,
  `vite.config.ts`, existing research in `research/20260324_sse_resilience_production_patterns.md`
  and `research/20260327_sse_multiplexing_unified_stream.md`, and knowledge of React 18/19 internals,
  ECMAScript module semantics, and Vite HMR architecture
- Primary authoritative sources: React Strict Effects RFC (GitHub reactjs/rfcs), Vite HMR API docs,
  WHATWG EventSource spec, TanStack Router docs, useSyncExternalStore RFC
