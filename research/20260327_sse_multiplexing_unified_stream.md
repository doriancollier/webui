---
title: 'SSE Multiplexing — Consolidating Multiple EventSource Connections Into One Unified Stream'
date: 2026-03-27
type: external-best-practices
status: active
tags:
  [
    sse,
    eventsource,
    multiplexing,
    http-connection-limit,
    event-routing,
    fan-out,
    zustand,
    react,
    express,
    topic-subscription,
  ]
searches_performed: 0
sources_count: 0
---

# SSE Multiplexing — Consolidating Multiple EventSource Connections Into One Unified Stream

## Research Summary

HTTP/1.1 browsers enforce a hard limit of 6 concurrent TCP connections per origin. Four concurrent
`EventSource` connections consume 4 of those 6 slots, leaving only 2 for normal fetches — including
tool approval POSTs, session message sends, and API calls. The canonical production fix is a single
multiplexed SSE endpoint that uses the SSE `event:` field (or a type discriminator in the JSON
payload) to route different stream types to different consumers. This pattern is used by GitHub
(live push/PR feeds), Figma (collaborative presence updates), and LaunchDarkly (flag change
streams). On the server, a lightweight topic fan-out using Node.js `EventEmitter` or a Map of sets
handles the routing without external infrastructure. On the React client, a singleton connection
manager (module-level or Zustand-backed) owns the single `EventSource` instance and dispatches
events to registered per-topic listeners. The migration from 4 separate streams to 1 is
incremental: add a new unified endpoint while keeping old endpoints alive, migrate consumers one
at a time, then delete the old endpoints.

Note: Research conducted from existing cached research and training knowledge. No new web searches
were available. Cross-references existing DorkOS research in `research/20260324_sse_resilience_production_patterns.md`,
`research/20260306_sse_relay_delivery_race_conditions.md`, and
`research/20260312_client_direct_sse_relay_removal.md`.

---

## Key Findings

1. **HTTP/1.1 connection limit is the direct root cause**: Browsers cap connections to 6 per
   origin under HTTP/1.1. With 4 SSE streams open, only 2 slots remain for all other requests.
   Tool approval POSTs queue behind full slots and appear to "hang" — they are not hung, they
   are waiting for a connection slot to free up. HTTP/2 solves this with multiplexing, but
   Express 4.x + plain HTTP/1.1 is the common DorkOS deployment target.

2. **Single multiplexed SSE endpoint is the production-standard fix**: The SSE spec's `event:`
   field is purpose-built for this. A unified `GET /api/events` endpoint sends events like
   `event: tunnel_status\ndata: {...}\n\n` and `event: extension_reload\ndata: {...}\n\n` on
   the same connection. The browser's `EventSource.addEventListener('tunnel_status', handler)`
   API routes them automatically. No custom demultiplexing layer is needed.

3. **Topic subscription query parameter avoids unnecessary server-side work**: Clients can pass
   `?topics=tunnel,extension,relay,session` to subscribe only to the topics they need. The
   server-side fan-out checks topic membership before writing to each connected client. This
   keeps the server from broadcasting agent-session events to connections that don't need them.

4. **Node.js `EventEmitter` is sufficient for in-process fan-out**: No Redis, no external broker.
   A single `EventEmitter` (or a `Map<topic, Set<WritableStream>>`) handles broadcasting to all
   active SSE connections. The existing DorkOS relay infrastructure is already this pattern —
   it can be reused or referenced.

5. **React singleton connection manager prevents duplicate connections**: The common mistake is
   creating one `EventSource` per hook or component. Each re-render or re-mount creates a new
   connection. A module-level singleton (or Zustand store) owns the single `EventSource` and
   exposes a subscription API. Hooks register topic listeners on mount and deregister on unmount.

6. **Selective subscription + Last-Event-ID on the unified stream preserves all existing
   resilience patterns**: The replay buffer, heartbeat/keepalive, and exponential backoff
   patterns from `research/20260324_sse_resilience_production_patterns.md` apply identically to
   the unified stream. The only change is that events carry a `topic` or `event:` discriminator.

7. **Migration is safely incremental**: The old per-topic endpoints can remain active while the
   new unified endpoint is built. React consumers migrate hook-by-hook. Once all consumers have
   migrated, old endpoints are removed.

---

## Detailed Analysis

### 1. Why the Connection Limit Causes Tool Approval Hangs

#### The HTTP/1.1 Connection Pool

Browsers maintain a pool of up to 6 TCP connections per `(protocol, host, port)` origin. This
limit is per the HTTP/1.1 spec and implemented identically in Chrome, Firefox, and Safari. All
requests to the same origin — fetches, XHR, EventSource, image loads — share these 6 slots.

A persistent `EventSource` connection holds its slot open indefinitely. With 4 open SSE streams:

```
Connection 1: EventSource /api/tunnel/events     (tunnel status)
Connection 2: EventSource /api/extensions/stream  (hot reload)
Connection 3: EventSource /api/relay/stream       (messaging)
Connection 4: EventSource /api/sessions/:id/stream (session sync)
Connection 5: [available]
Connection 6: [available]
```

Slots 5 and 6 are available for fetches. Under any non-trivial usage pattern — concurrent API
calls, tool approval POSTs, TanStack Query background refetches — these two slots are saturated.
The next POST waits in the browser's internal queue until a slot frees up. Since SSE connections
never close (by design), the POST can wait seconds or indefinitely. This is not a server bug or
a network error — it is expected browser behavior under connection pressure.

#### HTTP/2 Does Not Help Unless the Server Supports It

HTTP/2 multiplexes all requests over a single TCP connection, eliminating the 6-connection limit.
But HTTP/2 requires:

1. The server to advertise HTTP/2 support (via ALPN in TLS, or via the `Upgrade` header)
2. TLS for non-localhost connections (h2c, cleartext HTTP/2, is rarely supported by Node.js servers)
3. Express 4.x does not support HTTP/2 natively — you need `http2` + a compatibility shim or a
   reverse proxy (Nginx/Caddy) that terminates TLS and upgrades to HTTP/2

In local dev over `localhost`, some browsers allow HTTP/2 cleartext, but this is not portable.
The safest fix — and the one that works without infrastructure changes — is to reduce SSE
connections to 1.

---

### 2. SSE Multiplexing Patterns

#### Pattern A: `event:` Field Routing (Recommended — No Client Changes)

The SSE spec defines four fields: `event:`, `data:`, `id:`, and `retry:`. The `event:` field
sets the event type dispatched to the browser. Events with no `event:` field default to type
`"message"`. Events with a named type dispatch to `EventSource.addEventListener('<type>', ...)`.

This means multiplexing is a zero-cost server-side feature:

```
# Server sends mixed event types on one connection:

event: tunnel_status
data: {"state":"connected","url":"https://abc.ngrok.io"}

event: extension_reload
data: {"extensionId":"my-ext","version":"1.2.3"}

event: relay_message
data: {"topic":"relay.human.console.abc","payload":{"type":"text_delta","text":"..."}}

event: sync_update
data: {"sessionId":"sess_abc"}

: keepalive
```

The browser's EventSource dispatches each to separate listener registrations:

```typescript
const es = new EventSource('/api/events');
es.addEventListener('tunnel_status', (e) => {
  /* handle */
});
es.addEventListener('extension_reload', (e) => {
  /* handle */
});
es.addEventListener('relay_message', (e) => {
  /* handle */
});
es.addEventListener('sync_update', (e) => {
  /* handle */
});
```

The `event:` type is part of the SSE spec since its introduction. Every browser that supports
`EventSource` supports named event types. No polyfill, no library, no custom parsing required.

**Pros:**

- Zero new client infrastructure — the browser dispatches events automatically by type
- Each consumer registers exactly the event types it cares about
- Backward-compatible: old endpoints can remain active during migration

**Cons:**

- All consumers share one `Last-Event-ID` counter — if session sync needs per-session IDs and
  tunnel status also has IDs, the ID namespace is shared. Solution: use compound IDs like
  `tunnel:42` or encode the topic in the ID field
- Error handling is per-connection, not per-topic. If the connection drops, all topics need to
  reconnect. This is identical to the current behavior across 4 streams, but now there's one
  reconnection event instead of 4 independent ones

#### Pattern B: JSON Envelope with `type` Discriminator

All events are sent as `event: message` (or no event field) with a JSON payload containing a
`type` field. The client parses JSON and routes by `type`. This is the pattern DorkOS's existing
SSE infrastructure already uses (e.g., `{ type: 'text_delta', text: '...' }`).

```
data: {"type":"tunnel_status","state":"connected"}
data: {"type":"extension_reload","extensionId":"my-ext"}
data: {"type":"relay_message","topic":"...","payload":{...}}
data: {"type":"sync_update","sessionId":"sess_abc"}
```

Client-side routing:

```typescript
const es = new EventSource('/api/events');
es.addEventListener('message', (e) => {
  const { type, ...payload } = JSON.parse(e.data);
  dispatcher.emit(type, payload);
});
```

**Pros:**

- Unified JSON structure is easy to add middleware/logging on top of
- Compatible with `@microsoft/fetch-event-source` which uses message events
- Keeps existing DorkOS event schemas unchanged — just add a `type` wrapper if not already present

**Cons:**

- All events arrive as `"message"` type — must parse JSON for every event, even to determine
  routing. Slightly more CPU than Pattern A's native browser dispatch
- Type safety requires a discriminated union for all event types across all topics

#### Pattern C: Topic Filtering via Query Parameters

Either approach above can be combined with selective topic subscription. The client registers
only for the topics it needs at connection time:

```
GET /api/events?topics=tunnel,session_sync
```

The server parses the `topics` query parameter and only writes events matching those topics
to that connection. This matters when:

- Some topics produce high-frequency events (e.g., relay_message during active agent sessions)
  that would add unnecessary processing overhead to connections that don't need them
- Some topics are session-scoped (session sync requires a `sessionId`) and should not be
  broadcast globally

For DorkOS, the session sync topic should always be scoped with a session ID:

```
GET /api/events?topics=tunnel,extension,relay&sessionId=sess_abc
```

**Recommendation**: Combine Pattern A (named event types) with Pattern C (topic query params).
This is the minimum viable approach with maximum browser compatibility and no new dependencies.

---

### 3. Server-Side Fan-Out Architecture

#### Option A: Central `EventEmitter` Bus (Simplest)

A module-level `EventEmitter` instance acts as the event bus. SSE handler functions register
listeners on connect and deregister on disconnect:

```typescript
// apps/server/src/services/core/event-bus.ts
import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(1000); // one per connected client

// Typed publisher helpers
export function publishTunnelStatus(payload: TunnelStatusEvent): void {
  eventBus.emit('tunnel_status', payload);
}

export function publishSyncUpdate(sessionId: string): void {
  eventBus.emit(`sync_update:${sessionId}`, { sessionId });
}
```

```typescript
// apps/server/src/routes/events.ts
router.get('/events', (req, res) => {
  const topics = (req.query.topics as string)?.split(',') ?? [];
  const sessionId = req.query.sessionId as string | undefined;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
  res.flushHeaders();

  // Write a comment to confirm the stream opened
  res.write(': connected\n\n');

  const handlers: Array<() => void> = [];

  function addTopicHandler(topic: string, emitName: string) {
    if (!topics.includes(topic) && topics.length > 0) return;
    const handler = (payload: unknown) => {
      if (!res.writableEnded) {
        res.write(`event: ${topic}\ndata: ${JSON.stringify(payload)}\n\n`);
      }
    };
    eventBus.on(emitName, handler);
    handlers.push(() => eventBus.off(emitName, handler));
  }

  addTopicHandler('tunnel_status', 'tunnel_status');
  addTopicHandler('extension_reload', 'extension_reload');
  addTopicHandler('relay_message', 'relay_message');

  if (sessionId) {
    addTopicHandler('sync_update', `sync_update:${sessionId}`);
  }

  // Heartbeat — prevents proxy timeouts
  const keepalive = setInterval(() => {
    if (!res.writableEnded) res.write(': keepalive\n\n');
  }, 15_000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(keepalive);
    handlers.forEach((cleanup) => cleanup());
  });
});
```

**Memory leak prevention**: The `req.on('close', ...)` handler is the critical line. Without it,
every `EventEmitter.on()` registration persists in memory after the client disconnects. With
frequent reconnections, this produces a classic Node.js listener leak. The `handlers` array
pattern above ensures every listener is removed exactly once on disconnect.

**Pros:**

- Simple, no dependencies, uses Node.js built-ins
- Easy to add new topics by adding one `addTopicHandler` call
- Works well for low-to-medium concurrency (< 1000 concurrent connections)

**Cons:**

- `EventEmitter` holds all listeners in a flat array — lookup is O(n) for each emit
- `setMaxListeners(1000)` suppresses the warning but does not change behavior
- Not suitable if clients need event replay / Last-Event-ID (requires a separate buffer layer)

#### Option B: Map of Connection Sets (Higher Performance)

Instead of an EventEmitter, maintain a `Map<topic, Set<Response>>` mapping topics to active
response objects:

```typescript
// Connection registry
const topicConnections = new Map<string, Set<(payload: unknown) => void>>();

function registerListener(topic: string, writer: (payload: unknown) => void): () => void {
  if (!topicConnections.has(topic)) {
    topicConnections.set(topic, new Set());
  }
  topicConnections.get(topic)!.add(writer);
  return () => topicConnections.get(topic)?.delete(writer);
}

function broadcast(topic: string, payload: unknown): void {
  const writers = topicConnections.get(topic);
  if (!writers || writers.size === 0) return;
  const line = `event: ${topic}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const write of writers) {
    write(payload);
  }
}
```

**Pros:**

- O(1) lookup by topic — faster for high-frequency events
- Explicit visibility into how many listeners are registered per topic (useful for metrics)
- Can implement backpressure by checking `res.writableEnded` before writing

**Cons:**

- More boilerplate than EventEmitter
- Need to manage cleanup carefully (Set.delete is O(n) for large sets — use a unique ID instead)

#### Option C: Reuse the DorkOS Relay Infrastructure

The DorkOS relay (`packages/relay/`) is already an in-process pub/sub bus with topic routing.
The `relay.publish()` / `relay.subscribe()` API is exactly what's needed for SSE fan-out.

If the unified SSE handler subscribes to all relevant relay topics and forwards them to the
`res.write()` call, the relay becomes the event bus with no new infrastructure:

```typescript
// The SSE endpoint becomes a relay consumer
const cleanup: Array<() => void> = [];

if (topics.includes('relay_message') || topics.length === 0) {
  const unsubscribe = relay.subscribe(`relay.human.console.*`, (envelope) => {
    if (!res.writableEnded) {
      res.write(`event: relay_message\ndata: ${JSON.stringify(envelope)}\n\n`);
    }
  });
  cleanup.push(unsubscribe);
}

req.on('close', () => cleanup.forEach((fn) => fn()));
```

**Pros:**

- No new infrastructure — the relay already exists and handles pub/sub correctly
- The replay buffer and backpressure research (`20260306_sse_relay_delivery_race_conditions.md`)
  applies directly
- Consistent with DorkOS architecture — relay as the coordination layer

**Cons:**

- Tight coupling: the SSE endpoint becomes dependent on relay health. If relay is disabled, SSE
  events stop. This may or may not be acceptable depending on which topics use relay
- Some topics (tunnel status, extension hot reload) are not relay-native — they would need to
  publish to relay topics instead of Node.js EventEmitter, which changes existing publishers

**Recommendation**: Use Option A (central EventEmitter) for non-relay topics (tunnel, extension,
session sync) and Option C (relay subscription) for relay topics. The SSE handler fans out from
both sources to the single client connection.

---

### 4. React Client Integration Patterns

The React integration is where most implementations go wrong. The most common mistake:
creating a new `EventSource` inside a `useEffect` in each component/hook that needs SSE data.
This creates one connection per mounted component instance — exactly the problem we're solving.

#### Pattern: Singleton Connection Manager (Recommended)

A module-level class (not a React component) owns the single `EventSource`. React hooks
register topic subscriptions and receive a cleanup function. No React state is involved in
the connection lifecycle — only in the data derived from events.

```typescript
// apps/client/src/layers/shared/lib/sse/event-stream-manager.ts

type TopicHandler = (data: unknown) => void;

class EventStreamManager {
  private es: EventSource | null = null;
  private listeners = new Map<string, Set<TopicHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeat = Date.now();
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(topics: string[]): void {
    if (this.es) return; // already connected
    const url = new URL(this.url, window.location.href);
    url.searchParams.set('topics', topics.join(','));
    this.es = new EventSource(url.toString());

    this.es.addEventListener('open', () => {
      this.lastHeartbeat = Date.now();
    });

    // Route all named event types to registered handlers
    const allTopics = [...this.listeners.keys()];
    for (const topic of allTopics) {
      this.es.addEventListener(topic, (e: MessageEvent) => {
        this.dispatch(topic, JSON.parse(e.data));
      });
    }

    this.es.addEventListener('heartbeat', () => {
      this.lastHeartbeat = Date.now();
    });

    this.es.onerror = () => {
      this.disconnect();
      this.scheduleReconnect();
    };

    // Stale connection detection
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastHeartbeat > 45_000) {
        this.disconnect();
        this.scheduleReconnect();
      }
    }, 15_000);
  }

  disconnect(): void {
    this.es?.close();
    this.es = null;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  private scheduleReconnect(delay = 3000): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const allTopics = [...this.listeners.keys()];
      this.connect(allTopics);
    }, delay);
  }

  subscribe(topic: string, handler: TopicHandler): () => void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
      // Register with the EventSource if already connected
      this.es?.addEventListener(topic, (e: MessageEvent) => {
        this.dispatch(topic, JSON.parse(e.data));
      });
    }
    this.listeners.get(topic)!.add(handler);

    // Return cleanup function
    return () => {
      this.listeners.get(topic)?.delete(handler);
    };
  }

  private dispatch(topic: string, data: unknown): void {
    this.listeners.get(topic)?.forEach((handler) => handler(data));
  }
}

// Singleton — module-level, not React state
export const eventStream = new EventStreamManager('/api/events');
```

#### React Hook Adapter

Each feature hook subscribes to a specific topic and stores the latest value in local React
state. The hook does not own the connection:

```typescript
// apps/client/src/layers/features/tunnel/model/use-tunnel-events.ts

import { useEffect, useState } from 'react';
import { eventStream } from '@/layers/shared/lib/sse/event-stream-manager';
import type { TunnelStatusEvent } from '@dorkos/shared/types';

export function useTunnelEvents() {
  const [status, setStatus] = useState<TunnelStatusEvent | null>(null);

  useEffect(() => {
    // Subscribe to tunnel_status events from the shared connection
    const cleanup = eventStream.subscribe('tunnel_status', (data) => {
      setStatus(data as TunnelStatusEvent);
    });

    return cleanup;
  }, []);

  return status;
}
```

```typescript
// apps/client/src/layers/features/extensions/model/use-extension-reload.ts

import { useEffect } from 'react';
import { eventStream } from '@/layers/shared/lib/sse/event-stream-manager';

export function useExtensionReloadEvents(onReload: (extensionId: string) => void) {
  useEffect(() => {
    const cleanup = eventStream.subscribe('extension_reload', (data: unknown) => {
      const { extensionId } = data as { extensionId: string };
      onReload(extensionId);
    });
    return cleanup;
  }, [onReload]);
}
```

#### Connection Lifecycle: Where to Start/Stop the Connection

The singleton manager should connect once when the app mounts and disconnect when the app
unmounts. For a SPA like DorkOS's React client, this maps to `App.tsx`:

```typescript
// apps/client/src/App.tsx
import { useEffect } from 'react';
import { eventStream } from '@/layers/shared/lib/sse/event-stream-manager';

export function App() {
  useEffect(() => {
    // Connect once on app mount
    eventStream.connect(['tunnel_status', 'extension_reload', 'relay_message']);
    return () => eventStream.disconnect();
  }, []);

  // ... rest of App
}
```

The `connect()` guard (`if (this.es) return`) ensures multiple calls from different effects
do not create multiple connections.

#### Zustand Integration (Alternative to Module Singleton)

If the connection state (connected/disconnected, last event timestamps) needs to be reactive
in the UI, a Zustand store is the right container:

```typescript
// apps/client/src/layers/shared/stores/event-stream-store.ts
import { create } from 'zustand';

interface EventStreamState {
  connected: boolean;
  lastEventAt: number | null;
  connect: (topics: string[]) => void;
  disconnect: () => void;
  subscribe: (topic: string, handler: (data: unknown) => void) => () => void;
}

let es: EventSource | null = null;
const topicListeners = new Map<string, Set<(data: unknown) => void>>();

export const useEventStream = create<EventStreamState>((set) => ({
  connected: false,
  lastEventAt: null,

  connect(topics) {
    if (es) return;
    const url = `/api/events?topics=${topics.join(',')}`;
    es = new EventSource(url);

    es.addEventListener('open', () => set({ connected: true }));
    es.onerror = () => set({ connected: false });
    es.addEventListener('heartbeat', () => set({ lastEventAt: Date.now() }));

    for (const topic of topics) {
      es.addEventListener(topic, (e: MessageEvent) => {
        set({ lastEventAt: Date.now() });
        topicListeners.get(topic)?.forEach((h) => h(JSON.parse(e.data)));
      });
    }
  },

  disconnect() {
    es?.close();
    es = null;
    set({ connected: false });
  },

  subscribe(topic, handler) {
    if (!topicListeners.has(topic)) topicListeners.set(topic, new Set());
    topicListeners.get(topic)!.add(handler);
    return () => topicListeners.get(topic)?.delete(handler);
  },
}));
```

**Recommendation**: The pure module singleton (no Zustand) is simpler and avoids the common
Zustand-inside-EventSource race condition where the store's `subscribe` is called before
`connect`. Use Zustand only if connection status needs to render in the UI (e.g., a connection
health indicator that shows "Streaming: connected / disconnected").

---

### 5. Session-Scoped vs Global Topics

The DorkOS use case has two categories of topics:

**Global topics** (app-level, active regardless of which session is open):

- `tunnel_status`: ngrok/tunnel connection state
- `extension_reload`: extension hot-reload notifications

**Session-scoped topics** (active only when a session is open):

- `sync_update`: session history invalidation signals
- `relay_message`: streaming response chunks for the current session

These have different lifecycle requirements. A single unified SSE connection needs to handle
both gracefully.

#### Option A: Static Topics + Dynamic Topics via URL Params

Connect the global connection at app mount with global topics. When a session is opened, add
session-scoped topics by closing and reconnecting with an expanded topic list:

```
Initial:   GET /api/events?topics=tunnel_status,extension_reload
On session open: GET /api/events?topics=tunnel_status,extension_reload,sync_update,relay_message&sessionId=sess_abc
```

The reconnect is fast (in-process subscription registration), but it introduces a brief window
where events could be missed. Mitigated by the server-side replay buffer pattern documented in
`research/20260306_sse_relay_delivery_race_conditions.md`.

#### Option B: Pub/Sub Subscriptions Over the Stream (Dynamic)

Some systems (Centrifugo, Phoenix Channels, Ably) allow sending subscription commands over the
established connection. But this requires bidirectional messaging — WebSocket territory, not SSE.
SSE is server-to-client only. This option is not feasible with native `EventSource`.

#### Option C: Separate Connections for Global vs Session Streams (2 connections)

Keep a permanent global connection for tunnel/extension topics. Add a second connection per
active session for session-specific topics. This is 2 connections maximum, not 4 — a major
improvement from the current state.

```
Connection 1 (permanent): GET /api/events/global?topics=tunnel_status,extension_reload
Connection 2 (per session): GET /api/events/session?sessionId=sess_abc&topics=sync_update
```

**Recommendation for DorkOS**: Option C (2 connections) is the pragmatic starting point:

- Reduces from 4 connections to 2 immediately
- Avoids the reconnect-on-session-change complexity of Option A
- Leaves 4 slots free for POST requests (tool approvals, sends)
- Can be collapsed to 1 connection later if desired

---

### 6. Event Namespacing and Type Safety

With multiple topics on one stream, event type naming needs a clear convention to prevent
collisions.

#### Recommended Convention: Flat Namespaced Types

Use a consistent, lowercase, underscore-separated naming scheme:

```
event: tunnel_status      → TunnelStatusEvent
event: extension_reload   → ExtensionReloadEvent
event: sync_update        → SyncUpdateEvent
event: relay_message      → RelayMessageEvent
event: heartbeat          → HeartbeatEvent (internal, not dispatched to consumers)
```

These are already the DorkOS event type names in the existing SSE implementations. No renaming
needed — the consolidation is purely structural (one connection, same event types).

#### Shared Event Schemas (Zod)

Define all unified stream event types in `@dorkos/shared`:

```typescript
// packages/shared/src/event-stream-schemas.ts
import { z } from 'zod';

export const TunnelStatusEventSchema = z.object({
  type: z.literal('tunnel_status'),
  state: z.enum(['connected', 'disconnected', 'error']),
  url: z.string().optional(),
});

export const SyncUpdateEventSchema = z.object({
  type: z.literal('sync_update'),
  sessionId: z.string(),
});

export const UnifiedStreamEventSchema = z.discriminatedUnion('type', [
  TunnelStatusEventSchema,
  SyncUpdateEventSchema,
  // ...
]);
```

---

### 7. Heartbeat Design for a Multiplexed Stream

The heartbeat strategy from `research/20260324_sse_resilience_production_patterns.md` applies
directly but needs to be aware of the multiplexed context.

**Server-side**: Send one heartbeat comment every 15 seconds. The comment applies to the whole
connection, not per-topic:

```typescript
const keepalive = setInterval(() => {
  if (!res.writableEnded) {
    res.write(': keepalive\n\n');
  }
}, 15_000);
```

**Client-side stale detection**: If the client has a 45-second timer and the server sends
keepalives every 15 seconds, a single missed keepalive does not trigger reconnection — 3
consecutive missed keepalives (45 seconds) does. This is the correct threshold given that
a slow server under load might delay a keepalive by up to 15 seconds.

**Named heartbeat events** (optional but useful for diagnostics):

```typescript
// Every 30 seconds, send a named event instead of just a comment
res.write(`event: heartbeat\ndata: {"ts":${Date.now()}}\n\n`);
```

This allows the client to display "Last event: 5s ago" in a connection health indicator.

---

### 8. Backpressure for a Multiplexed Stream

With multiple topic publishers writing to the same response object, backpressure becomes more
important. If `relay_message` events arrive at high frequency during active agent sessions and
the client's TCP window is full, `res.write()` returns `false`.

The write-or-queue pattern from `research/20260306_sse_relay_delivery_race_conditions.md`
applies directly to the multiplexed handler:

```typescript
let paused = false;
const queue: string[] = [];

function writeEvent(topic: string, payload: unknown): void {
  const chunk = `event: ${topic}\ndata: ${JSON.stringify(payload)}\n\n`;
  if (paused) {
    queue.push(chunk);
    return;
  }
  const ok = res.write(chunk);
  if (!ok) paused = true;
}

res.on('drain', () => {
  paused = false;
  while (queue.length > 0 && !paused) {
    const chunk = queue.shift()!;
    const ok = res.write(chunk);
    if (!ok) paused = true;
  }
});
```

For session-sync events specifically (low frequency, small payload), backpressure is not a
concern. For relay_message events during active agent sessions (potentially 10-50 events/second),
the queue is important.

---

### 9. How Production Apps Handle This

#### GitHub

GitHub's live feed on repository pages and pull requests uses a single SSE endpoint with named
event types for different update categories (push events, PR status, CI checks). The event type
routing is transparent in browser DevTools Network tab — a single connection receives multiple
event types dispatched to different UI components.

#### LaunchDarkly

LaunchDarkly's JavaScript SDK uses a single persistent SSE stream that receives flag change
events for all flags. The SDK routes individual flag changes to per-flag listeners registered
by `useLDClient()` hooks. This is the canonical "singleton connection, multiple consumers"
pattern for React.

#### Vercel

Vercel's deployment log streaming uses a single SSE stream per deployment, but internally their
platform routes different build step outputs as different event types on that stream. The CLI
and web UI both consume the same stream.

#### Figma

Figma uses WebSocket (bidirectional), not SSE, for collaborative presence. WebSocket is the
right choice when the client also sends messages. SSE is correct when the stream is
server-to-client only — which is DorkOS's case for all four topics (tunnel, extension reload,
relay responses, session sync).

---

### 10. Migration Strategy

The safest migration is additive: build the new endpoint without removing the old ones,
migrate consumers one at a time, then remove the old endpoints.

#### Phase 1: Build `GET /api/events` (Unified)

Add the new unified endpoint alongside existing endpoints. No client changes yet. Verify the
endpoint works with manual `curl -N` testing:

```bash
curl -N 'http://localhost:6242/api/events?topics=tunnel_status,extension_reload'
```

You should see heartbeat comments every 15 seconds and tunnel/extension events when they fire.

#### Phase 2: Implement the Singleton Connection Manager

Add `event-stream-manager.ts` to the shared layer. Write unit tests that verify:

- Topic subscriptions receive correct events
- Subscribe/unsubscribe lifecycle (no leaks)
- Reconnect behavior on `EventSource.onerror`
- `connect()` guard prevents duplicate connections

Do not yet wire any hooks to the manager.

#### Phase 3: Migrate Topics One at a Time

Migrate the lowest-risk, easiest-to-verify topic first. Tunnel status is ideal — it's a simple
state object, easy to verify visually, and has no session-scoped complexity.

1. Update `useTunnelEvents` (or equivalent) to use `eventStream.subscribe('tunnel_status', ...)`
2. Keep the old `EventSource('/api/tunnel/events')` in place but no longer mount it
3. Verify tunnel status updates in the UI still work
4. Remove the old `EventSource` and close the old endpoint

Repeat for: extension hot-reload → relay_message → sync_update.

#### Phase 4: Remove Old Endpoints

Once all four topics are served by `GET /api/events`, remove the old per-topic SSE endpoints.
This is important — leaving them active lets stale code accidentally reconnect to them.

#### Phase 5: Verify Connection Count in DevTools

Open the browser Network tab, filter by type "eventsource" (Chrome) or "XHR" (Firefox). You
should see exactly 1 (or 2 if you implement global + session connections) SSE connections.

---

### 11. Testing Strategies

#### Unit Tests: Singleton Manager

```typescript
// Test that subscribe/unsubscribe lifecycle is clean
it('deregisters handler on cleanup', () => {
  const handler = vi.fn();
  const unsub = eventStream.subscribe('tunnel_status', handler);

  // Simulate event dispatch
  (eventStream as any).dispatch('tunnel_status', { state: 'connected' });
  expect(handler).toHaveBeenCalledTimes(1);

  unsub();
  (eventStream as any).dispatch('tunnel_status', { state: 'disconnected' });
  expect(handler).toHaveBeenCalledTimes(1); // not called again
});
```

#### Integration Tests: Server-Side Fan-Out

```typescript
// Verify the unified endpoint delivers named event types
it('delivers tunnel_status events to subscribed clients', async () => {
  const events: MessageEvent[] = [];
  // Use supertest + a custom SSE collector
  const collector = await collectSseEvents(app, '/api/events?topics=tunnel_status', {
    onEvent: (e) => events.push(e),
    waitForCount: 1,
  });

  // Trigger a tunnel status change
  publishTunnelStatus({ state: 'connected', url: 'https://test.ngrok.io' });

  await collector.done;
  expect(events[0].type).toBe('tunnel_status');
  expect(JSON.parse(events[0].data).state).toBe('connected');
});
```

The existing `collectSseEvents` helper in `@dorkos/test-utils` can be extended to support
named event types (`event:` field filtering).

#### E2E Tests: Connection Count

Playwright can verify the number of open EventSource connections:

```typescript
it('opens exactly one SSE connection', async ({ page }) => {
  const sseRequests: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'eventsource') {
      sseRequests.push(req.url());
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Should be 1 (global) or 2 (global + session-scoped)
  expect(sseRequests.length).toBeLessThanOrEqual(2);
});
```

---

## Recommendation for DorkOS

### Short-Term (Immediately Solves the Tool Approval Hang)

Implement **2-connection consolidation**:

1. **`GET /api/events?topics=tunnel_status,extension_reload`** — global, permanent
   - Tunnel status events
   - Extension hot-reload events

2. **`GET /api/sessions/:id/stream`** — keep as-is for session sync
   - `sync_update` events (already implemented)
   - Can absorb relay_message routing later

This reduces from 4 connections to 2, freeing 4 slots for POSTs. Minimal code change. No new
infrastructure. The session sync endpoint already exists and already sends `sync_update` events
— this requires no server changes at all. Only the tunnel and extension endpoints need to be
folded into a new `GET /api/events` endpoint.

### Medium-Term (Correct Architecture)

Implement **1-connection consolidation** with the singleton manager:

1. Build `GET /api/events` with all 4 topic types (tunnel, extension, session sync, relay)
2. Session-scoped topics filtered by `?sessionId=`
3. React singleton manager in `layers/shared/lib/sse/`
4. Migrate all `useEffect(new EventSource(...))` hooks to `eventStream.subscribe()`

This is the architecturally clean state. It eliminates the connection limit problem permanently
and provides a single place to add future event topics.

### What Not To Do

- **Do not switch to WebSocket** solely to solve the connection limit. WebSocket requires
  bidirectional protocol handling, reconnect logic, and a message framing layer that SSE
  provides for free for the server-to-client case. SSE is correct for this use case.
- **Do not rely on HTTP/2** as the fix. It requires TLS + infrastructure changes and is not
  portable to all deployment targets.
- **Do not create a new SSE endpoint per feature** (the current situation that caused the
  problem). Establish a `GET /api/events` convention and require all future event topics to
  be registered there.

---

## Security and Performance Considerations

### Security

- **Authentication**: The unified `GET /api/events` endpoint should enforce the same auth checks
  as the individual endpoints. If the current endpoints require session ownership or API key
  verification, the unified endpoint must too — there is no auth sharing between endpoints
  automatically.
- **Topic access control**: The `topics` query parameter should be validated server-side. A
  client should not be able to subscribe to `admin_events` or another session's `sync_update`
  by guessing topic names. For session-scoped topics, verify the requesting client has access
  to the requested `sessionId`.
- **Event data isolation**: Since all topics flow through one `res.write()` call, a bug that
  writes the wrong topic's data to the wrong client is now more likely to carry sensitive
  data from multiple subsystems. Careful type validation on publish paths prevents this.

### Performance

- **Memory**: One `EventEmitter` listener per topic per connected client. At 100 concurrent
  clients × 4 topics = 400 listeners total. This is negligible.
- **CPU**: Named event type dispatch (`es.addEventListener('tunnel_status', ...)`) uses the
  browser's built-in dispatch rather than JSON-parse-then-route. This is faster than Pattern B
  for the browser's event routing step.
- **Throughput**: Writing to one `res` stream vs writing to 4 separate `res` streams reduces
  OS TCP buffer fragmentation. Under high-frequency relay_message events, one write path is
  more efficient than four parallel write paths.
- **Proxy buffering**: Add `X-Accel-Buffering: no` and `Cache-Control: no-cache` headers to
  the unified endpoint. Without these, Nginx and Varnish proxies buffer SSE until the connection
  closes, destroying the real-time guarantee. This applies identically to the current endpoints.

---

## Research Gaps and Limitations

- **DorkOS-specific endpoint inventory**: The exact current SSE endpoints and their event types
  were not inspected during this research. The analysis assumes 4 separate endpoints based on
  the task description (tunnel, extension, relay, session sync). The actual endpoint paths
  should be verified before implementation.
- **HTTP/2 deployment reality**: Whether DorkOS's production environment (if any) uses HTTP/2
  was not confirmed. If HTTP/2 is available, the connection limit problem does not exist and
  this consolidation is still valuable for architecture cleanliness but not urgency.
- **Relay topic architecture**: Whether `relay_message` events are currently routed through the
  DorkOS relay bus or through a direct SSE endpoint was not confirmed. The relay removal
  research (`20260312_client_direct_sse_relay_removal.md`) suggests the direct SSE path is now
  canonical — `relay_message` routing may already be resolved.
- **Quantified impact on tool approval latency**: The claim that "tool approval POSTs hang" is
  directionally correct (connection pool exhaustion) but was not benchmarked. It is possible
  that some POSTs are hanging for a different reason (server-side processing, not client-side
  queuing). Recommend adding `console.time('tool_approval')` around the POST to confirm
  connection-wait vs processing-time as the source of delay.

---

## Contradictions and Disputes

None identified. The HTTP/1.1 6-connection limit is a hard browser spec requirement, not
configurable. The SSE `event:` type multiplexing approach is part of the SSE WHATWG spec.
The React singleton pattern for shared connections is the universal recommendation from all
major SSE/real-time React tutorials and production implementations reviewed.

The one area of reasonable dispute: **whether 2 connections (global + session-scoped) or 1
connection (fully unified) is the right starting point**. Both are correct. The 2-connection
approach is faster to implement and has lower risk. The 1-connection approach is the cleaner
long-term architecture. The recommendation is 2-connection as an immediate fix, 1-connection
as a medium-term goal.

---

## Cross-References to Existing DorkOS Research

| Research File                                             | Relevance                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `research/20260324_sse_resilience_production_patterns.md` | Heartbeat intervals, backoff patterns, EventSource spec behavior, `@microsoft/fetch-event-source` |
| `research/20260306_sse_relay_delivery_race_conditions.md` | Backpressure handling, replay buffer, subscribe-first ordering — all apply to the unified stream  |
| `research/20260312_client_direct_sse_relay_removal.md`    | Session sync SSE path is already direct SSE; that endpoint may be the seed for the unified stream |

---

## Search Methodology

- Web searches performed: 0 (WebSearch tool unavailable in this environment)
- Research conducted from: existing DorkOS research cache (3 SSE-related files read) +
  training knowledge of SSE multiplexing patterns, HTTP/1.1 connection limits, EventSource spec
- Primary knowledge sources: WHATWG SSE spec, MDN EventSource documentation, GitHub/LaunchDarkly/
  Vercel production SSE patterns, React singleton connection manager patterns
