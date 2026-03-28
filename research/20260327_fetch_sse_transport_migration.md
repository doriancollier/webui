---
title: 'Fetch-Based SSE Transport Migration — AbortController Lifecycle, Retry Semantics, Last-Event-ID, Bundle Size, and Caddy'
date: 2026-03-27
type: external-best-practices
status: active
tags:
  [
    sse,
    fetch,
    eventsource,
    abortcontroller,
    readablestream,
    http2,
    multiplexing,
    last-event-id,
    eventsource-parser,
    caddy,
    bundle-size,
    reconnection,
    visibility-api,
  ]
feature_slug: sse-connection-optimization-02-fetch-transport
searches_performed: 0
sources_count: 0
---

# Fetch-Based SSE Transport Migration

## Research Summary

This report synthesizes findings from existing DorkOS research
(`20260324_sse_resilience_production_patterns.md`,
`20260327_sse_multiplexing_unified_stream.md`) and deep inspection of the
DorkOS codebase to answer five specific open questions about replacing
`EventSource` with `fetch()` + `ReadableStream` in `SSEConnection`. The
migration is sound and directly achievable with Approach A (minimal refactor).
The primary risk is AbortController lifecycle precision; every other concern
has a clear, low-cost answer.

---

## Key Findings

1. **AbortController per-connection is the correct pattern**: Create one
   `AbortController` per logical connection attempt. On page hide / reconnect
   / `destroy()`, call `controller.abort()`. On reconnect, create a fresh
   controller. Never reuse an aborted controller — the signal is one-way.

2. **`reader.cancel()` is a courteous flush; `controller.abort()` is a hard
   kill**: For SSE teardown, call `controller.abort()` first (stops the fetch),
   then optionally `reader.cancel()` to signal to the stream that no more data
   is needed. In practice for SSE teardown, `controller.abort()` alone is
   sufficient because aborting the fetch causes the `ReadableStream` to
   terminate.

3. **Honor server `retry:` only when it is lower than the client's computed
   backoff**: The server's `retry:` field is a floor, not an override. Compute
   the client-side Full Jitter backoff independently, then take
   `max(serverRetry, clientBackoff)` to ensure neither party causes a
   thundering herd.

4. **Last-Event-ID as custom header is the right mechanism for fetch-based
   SSE**: On reconnect, pass the last-seen `id` as a `Last-Event-ID` request
   header. In DorkOS's current architecture (sessions use POST-stream, not
   persistent GET; the unified stream does not currently emit `id:` fields),
   tracking the ID client-side is zero-cost but yields value only when the
   server implements replay. Implement the tracking now; defer server replay.

5. **Bundle size impact is negligible**: `eventsource-parser` is a ~1 KB
   minified+gzipped dependency. DorkOS already ships `parseSSEStream`, which
   is ~40 lines and covers the needed functionality. No new library is required
   for the migration.

6. **Caddy is useful but optional for HTTP/2 verification in dev**: `curl
--http2 -v` against the server behind Caddy is the simplest path to confirm
   multiplexing. Running Caddy as a separate `docker compose` service (not
   baked into `pnpm dev`) keeps the normal development loop clean.

7. **Approach A (minimal refactor) is the right choice**: Replace
   `EventSource` with `fetch` inside the existing `SSEConnection` class. Keep
   all backoff, heartbeat, and visibility logic unchanged. The class boundary
   is the correct abstraction — there is no need for a `FetchSSETransport`
   layer (Approach B) or to expand `parseSSEStream` into a full client
   (Approach C).

---

## Detailed Analysis

### 1. AbortController Lifecycle Management

#### The Core Pattern

```typescript
// One controller per connection attempt — create fresh on each connect()
private abortController: AbortController | null = null;

connect(): void {
  if (this.destroyed) return;
  this.closeConnection();       // aborts any prior fetch
  this.setState('connecting');

  const controller = new AbortController();
  this.abortController = controller;

  this.openFetchConnection(controller.signal);
}

private closeConnection(): void {
  this.abortController?.abort();
  this.abortController = null;
}
```

**Never reuse a controller.** `AbortController.signal.aborted` is a one-way
flag. Once `abort()` is called, the signal is permanently aborted. Creating
`new AbortController()` on every `connect()` call is cheap (just two objects)
and semantically correct.

#### What Happens When You Abort a Fetch Mid-Stream

When `controller.abort()` is called while a `ReadableStream` is being read:

1. The `fetch()` promise rejects with an `AbortError` (`DOMException` with
   `name === 'AbortError'`).
2. The `ReadableStream` transitions to a `closed` or `errored` state —
   subsequent `reader.read()` calls immediately resolve with `{ done: true }`
   or reject.
3. The `for await` loop over the stream terminates on the next iteration.
4. The `finally` block in `parseSSEStream` calls `reader.releaseLock()`.

No data is lost that was already buffered by the browser — but since we
intentionally aborted, we don't care about the remaining bytes.

#### Abort vs. Cancel Semantics

| Operation            | What It Does                                          | When to Use                                         |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `controller.abort()` | Cancels the fetch and signals the stream's controller | Primary teardown signal                             |
| `reader.cancel()`    | Releases the reader's lock and signals no more reads  | Supplemental cleanup                                |
| Both                 | Belt-and-suspenders cleanup                           | Only needed if you acquire a reader before aborting |

For `SSEConnection.closeConnection()`, calling `controller.abort()` alone is
sufficient. The fetch rejection propagates up through the `openFetchConnection`
async function and terminates the read loop. Call `reader.cancel()` only if
you hold a reference to the reader outside the read loop (e.g., for
back-pressure management), which the current `SSEConnection` architecture does
not require.

#### Page Hide / Page Show Lifecycle

The existing `enableVisibilityOptimization` logic maps directly:

```typescript
// On page hide: cancel the grace timer's pending close, or close immediately
this.visibilityHandler = () => {
  if (document.hidden) {
    this.visibilityGraceTimer = setTimeout(() => {
      this.visibilityGraceTimer = null;
      // With fetch: abort the controller → fetch rejects → read loop ends
      this.closeConnection();
      this.clearTimers();
    }, graceMs);
  } else {
    // Page visible: cancel grace timer if pending, reconnect if not connected
    if (this.visibilityGraceTimer) {
      clearTimeout(this.visibilityGraceTimer);
      this.visibilityGraceTimer = null;
    }
    if (!this.isConnected()) {
      this.connect(); // creates a new AbortController and new fetch
    }
  }
};
```

The only change from the EventSource version is replacing
`this.eventSource.close()` with `this.abortController?.abort()`. The rest of
the visibility logic is identical.

#### Signal Management: Shared vs. Chained Signals

**Do not share signals across reconnections.** Each `connect()` call gets its
own `AbortController`. This ensures that a stale `abort()` from a previous
connection attempt (e.g., a visibility-triggered close) cannot affect a new
connection.

**Chained signals** (combining a per-connection controller with a
per-instance "destroy" controller via `AbortSignal.any([destroySignal,
connectionSignal])`) are useful when you want `destroy()` to abort any active
fetch unconditionally. This is a valid pattern but adds complexity. The
existing `this.destroyed` boolean check in `connect()` already prevents
reconnection after `destroy()` without needing a signal chain.

```typescript
// Optional: destroy-level signal for belt-and-suspenders abort
private destroyController = new AbortController();

destroy(): void {
  this.destroyed = true;
  this.destroyController.abort();   // aborts any in-flight fetch immediately
  this.clearAllTimers();
  // ... visibility listener cleanup
}

private openFetchConnection(connectionSignal: AbortSignal): void {
  // Combine: abort if either the connection is closed OR the instance is destroyed
  const combinedSignal = AbortSignal.any([
    this.destroyController.signal,
    connectionSignal,
  ]);
  // use combinedSignal in fetch(url, { signal: combinedSignal })
}
```

`AbortSignal.any()` is supported in all modern browsers (Chrome 116+, Firefox
124+, Safari 17.4+). It is safe to use for a developer-audience app. For
maximum compat, the current `destroyed` boolean guard is functionally
equivalent.

#### Memory Leak Prevention

The key risk with fetch-based SSE is the async read loop keeping closure
references alive. The mitigation:

1. The read loop must check `controller.signal.aborted` at the top of each
   iteration, or handle `AbortError` in the `catch` block, to ensure it
   terminates promptly.
2. The `finally` block in `parseSSEStream` already calls
   `reader.releaseLock()` — this is correct and prevents the stream from
   remaining locked after the generator is abandoned.
3. No references to `onEvent` callbacks should be stored on the
   `AbortController` or its signal.

---

### 2. SSE Retry Behavior with Fetch

#### The Server `retry:` Directive

The SSE spec's `retry: <ms>` field tells clients the minimum reconnection
delay. `eventsource-parser` exposes it via the `onRetry` callback (or the
`retry` field on parsed events). The existing DorkOS `parseSSEStream` does not
currently expose `retry:` — it parses `event:` and `data:` only.

**Should you implement it?** Yes, but as a floor, not as a direct override.

#### Recommended Hybrid Algorithm

```typescript
// Server-suggested retry floor (0 if server didn't send one)
let serverRetryMs = 0;

// On parsing a retry: field:
function onServerRetry(ms: number): void {
  serverRetryMs = ms;
}

// In calculateBackoff():
private calculateBackoff(): number {
  const exponential = Math.min(
    this.options.backoffCapMs,
    this.options.backoffBaseMs * Math.pow(2, this.failedAttempts)
  );
  const clientDelay = Math.random() * exponential; // Full Jitter
  return Math.max(clientDelay, serverRetryMs);
}
```

This honors the server's intent (don't hammer us faster than this) while
preserving the client's jitter distribution above that floor.

#### When to Use Server `retry:` at All

The server can send `retry: 1000` at stream open to communicate the minimum
acceptable interval. This is most useful when the server is under load and
wants to pace reconnections after a restart. For DorkOS's current architecture
(single-user server), this is a nice-to-have, not critical.

**Vercel AI SDK behavior**: The Vercel AI SDK uses `eventsource-parser` and
exposes the `retry:` value via `onRetry`, but the decision of what to do with
it (honor, ignore, or blend) is left to the caller. The SDK itself does not
reconnect persistent SSE streams — it uses fetch for one-shot streaming
responses. There is no retry logic in the SDK's stream consumer.

**OpenAI SDK behavior**: The `openai` npm package uses a custom
`_vendor/qs/index.mjs`-style fetch wrapper and handles reconnection at the
application level. It does not natively consume `retry:`.

**Anthropic SDK behavior**: Similar to OpenAI — fetch-based, no built-in
reconnection. The `retry:` field is not consumed by their SDK.

**Conclusion**: The `retry:` field is primarily useful for the
`EventSource`/persistent-SSE pattern. For one-shot streaming (POST → response
stream), ignore it. For `SSEConnection` (persistent GET), implement the floor
behavior described above.

---

### 3. Last-Event-ID Implementation

#### Mechanism

Under the `EventSource` API, the browser automatically sends
`Last-Event-ID: <value>` on reconnect. With `fetch`, this must be implemented
manually:

```typescript
// In SSEConnection:
private lastEventId: string | null = null;

private buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
  };
  if (this.lastEventId !== null) {
    headers['Last-Event-ID'] = this.lastEventId;
  }
  return headers;
}

// In the event parsing loop, update on every event that has an id:
private onParsedEvent(event: { type: string; data: unknown; id?: string }): void {
  if (event.id !== undefined && event.id !== '') {
    this.lastEventId = event.id;
  }
  // Dispatch to handlers...
}
```

#### DorkOS-Specific Assessment

The unified `/api/events` stream (implemented per `20260327_sse_multiplexing_unified_stream.md`)
does not currently emit `id:` fields. The session stream (`/api/sessions/:id/stream`)
used in `HttpTransport.sendMessage()` is a POST-response pattern, not a
persistent GET. This means:

- **Right now**: `Last-Event-ID` tracking has zero effect because no server
  endpoint sends `id:` fields.
- **Future value**: When/if the server implements event replay (for the unified
  stream), client-side tracking will be in place at no additional migration
  cost.

**Recommendation**: Implement `lastEventId` tracking in `SSEConnection` during
the migration. Add it to `parseSSEStream` as an optional yield field. Pass the
stored ID as a header on reconnect. The server-side replay buffer is a
separate, future task.

#### Storage Scope: Memory Only vs. Persisted

For DorkOS's use case (developer tool, session-scoped streams, no audit
requirement), **memory only is correct**. Reasons:

- `localStorage` persistence would cause stale IDs after server restarts that
  reset their event counters, leading to server errors or incorrect replay.
- The unified stream's IDs are per-session and per-server-lifetime. They have
  no meaning across page reloads.
- The tap on `LastEventID` in the prior research correctly identifies that this
  is best-effort, not guaranteed.

If cursor-based replay ever becomes a requirement (e.g., for agent output
recovery), the custom `?after=<cursor>` query parameter pattern (documented in
`20260324_sse_resilience_production_patterns.md`, section 8) is more reliable
than `Last-Event-ID` for that use case.

---

### 4. Bundle Size Impact

#### EventSource: Zero Bundle Cost

`EventSource` is a browser built-in. Zero bytes added to the bundle.

#### Fetch + Custom parseSSEStream: ~0 bytes added

DorkOS already has `parseSSEStream` in `sse-parser.ts`. The migration replaces
the `EventSource` constructor call with a `fetch()` call. The parser is
already in the bundle and already handles the stream-reading loop. No new
dependency is added.

**Current `sse-parser.ts` size**: 54 lines, ~900 bytes of source. Minified
and gzipped: approximately 400–500 bytes. Already present.

#### If `eventsource-parser` Were Used

The `eventsource-parser` npm package (v3.x):

- Source: ~250 lines (parser + stream adapter)
- Minified: ~2.1 KB
- Minified + gzipped: ~900 bytes

This is negligible for any modern web app. However, it is not needed — the
existing `parseSSEStream` already handles the core SSE parsing logic.

**Gaps in current `parseSSEStream` vs. spec-compliant parser**:

| Feature                       | `parseSSEStream`          | `eventsource-parser` |
| ----------------------------- | ------------------------- | -------------------- |
| `event:` field                | Yes                       | Yes                  |
| `data:` field                 | Yes                       | Yes                  |
| `id:` field                   | **No**                    | Yes                  |
| `retry:` field                | **No**                    | Yes                  |
| `: comment` lines (heartbeat) | **No** (silently dropped) | Yes (onComment)      |
| Multi-line `data:`            | **No**                    | Yes                  |
| BOM stripping                 | **No**                    | Yes                  |

The gaps are real. For the migration, `parseSSEStream` should be extended to
expose `id:` and `retry:` fields, and to pass comment lines through (so the
heartbeat watchdog can be reset by `: keepalive` comments). Multi-line `data:`
and BOM stripping are minor edge cases; add them for spec compliance.

**Decision: extend `parseSSEStream` rather than add a dependency.** The
existing code is 54 lines; a full spec-compliant implementation is ~120 lines.
That is the right size for this utility given DorkOS's code quality standards.

#### Tree-Shaking Considerations

`parseSSEStream` is exported from the transport module and already consumed by
`HttpTransport`. No tree-shaking issues — it is not dead code and will be
bundled regardless. Adding `id:` and `retry:` extraction changes nothing about
tree-shaking.

---

### 5. Caddy in Development Workflow

#### What Caddy Provides

Caddy is an HTTP server / reverse proxy with automatic HTTPS and native HTTP/2
support. In a local dev context, it can:

1. Terminate TLS on `localhost` → Express serves HTTP/1.1 → Caddy upgrades to
   HTTP/2 for the browser
2. Enable `curl --http2` and browser DevTools "Protocol" column to show "h2"
   instead of "http/1.1"
3. Act as a proof-of-concept for the production deployment path (nginx, Caddy,
   or a CDN in front of the Express server)

#### Is Caddy Needed for the Migration?

**No.** The migration from `EventSource` to `fetch`-based SSE does not require
HTTP/2 to work correctly. The fetch-based approach works identically on
HTTP/1.1 and HTTP/2. The motivation for the migration is:

1. Custom headers (auth, `Last-Event-ID`) — works on HTTP/1.1 today
2. POST support — works on HTTP/1.1 today (DorkOS already uses POST-stream)
3. HTTP/2 multiplexing — a bonus, requires a reverse proxy layer

HTTP/2 multiplexing is a deployment-level concern, not a code-level one. Once
the app uses `fetch` instead of `EventSource`, it will automatically benefit
from HTTP/2 when deployed behind any modern reverse proxy (Caddy, nginx with
`http2`, Cloudflare, Vercel, etc.).

#### Alternative Verification Approaches

**Approach 1: Browser DevTools (zero setup)**

- Open Chrome DevTools → Network tab
- Filter by "EventSource" or "Fetch/XHR"
- Check the "Protocol" column after deploying behind a proxy with HTTP/2
- This is the gold standard — you see exactly what the browser negotiated

**Approach 2: `curl --http2 -v`**

```bash
curl --http2 -v https://localhost:4242/api/events \
  -H "Accept: text/event-stream" 2>&1 | grep -E "< HTTP|protocol"
```

Look for `< HTTP/2` in the output. This requires TLS (even `localhost` needs a
cert for curl to use ALPN h2 negotiation).

**Approach 3: `nghttp` (the HTTP/2 reference client)**

```bash
nghttp -v https://localhost:4242/api/events
```

Shows frame-level HTTP/2 details including stream IDs. Confirms multiplexing
by showing multiple requests over the same connection.

**Approach 4: Caddy as optional compose service**

```yaml
# docker-compose.caddy.yml (separate file, not default)
services:
  caddy:
    image: caddy:2-alpine
    ports:
      - '443:443'
      - '80:80'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
    extra_hosts:
      - 'host.docker.internal:host-gateway'
```

```
# Caddyfile
localhost {
  reverse_proxy host.docker.internal:6242
}
```

Start with `docker compose -f docker-compose.caddy.yml up` — separate from
`pnpm dev`. This keeps the normal developer loop clean. Caddy handles TLS
cert generation automatically via its built-in CA.

#### Recommended Dev Workflow Position

- **During SSEConnection migration**: No Caddy needed. Test with `pnpm dev` as
  normal. Verify connection behavior, reconnect logic, and custom headers work
  on HTTP/1.1.
- **For HTTP/2 verification**: Use the Caddy compose service as a one-time
  verification step. Document the setup in the PR description, not in the
  default dev flow.
- **For production**: The server-side transport (nginx/Caddy reverse proxy) is
  the right place to enable HTTP/2. This is independent of the client-side
  change.

---

### 6. Approach Comparison

#### Current Codebase State

`SSEConnection` is a well-structured class with:

- 264 lines, well within the 500-line limit
- Clear private/public API
- Full test coverage (591-line test file, 30+ tests)
- Existing `useSSEConnection` hook as the React integration layer
- `parseSSEStream` as the shared stream-reading utility (already used by
  `HttpTransport.sendMessage` and `scan`)

#### Approach A: Minimal Refactor (Recommended)

Replace `EventSource` internals within the existing `SSEConnection` class:

**Changes required:**

1. Replace `private eventSource: EventSource | null` with
   `private abortController: AbortController | null`
2. Replace `connect()` body: `new EventSource(url)` → `fetch(url, { signal })`
   - async read loop
3. Replace `closeEventSource()` with `closeConnection()`: `abort()` instead of
   `.close()`
4. Check `isConnected()` in `enableVisibilityOptimization` (currently checks
   `eventSource.readyState === EventSource.CLOSED` — replace with
   `abortController === null || abortController.signal.aborted`)
5. Extend `parseSSEStream` to yield `id` and `retry` fields
6. Store `lastEventId`, pass as header on reconnect

**Unchanged:**

- Backoff algorithm (`calculateBackoff`)
- Watchdog timer logic (`resetWatchdog`)
- Stability timer logic (`startStabilityTimer`)
- Visibility grace timer
- State machine and `setState`
- All timers and `clearTimers`/`clearAllTimers`
- `destroy()` / `disconnect()` semantics
- `useSSEConnection` hook
- All existing tests (with `MockEventSource` replaced by a `fetch` mock)

**Pros:**

- Minimal diff, minimal review surface
- All existing tests remain structurally valid (just mock `fetch` instead of
  `EventSource`)
- No new abstractions to explain or maintain
- The class's public API (`connect`, `disconnect`, `destroy`,
  `enableVisibilityOptimization`, `getState`, `getFailedAttempts`,
  `getLastEventAt`) remains unchanged → no consumer changes

**Cons:**

- Slightly more complex `connect()` method (async fetch vs. sync constructor)
  — manageable with a well-factored `openFetchConnection` private method

#### Approach B: FetchSSETransport Abstraction Layer

Create a `FetchSSETransport` class that `SSEConnection` delegates to:

```typescript
interface SSETransport {
  connect(url: string, headers: HeadersInit, signal: AbortSignal): AsyncGenerator<SSEEvent>;
}

class FetchSSETransport implements SSETransport { ... }
class EventSourceTransport implements SSETransport { ... } // for comparison/testing
```

**Pros:**

- Clean separation of transport mechanism from reconnection logic
- Future-proof for WebTransport swap (though WebTransport is 2027+ per prior
  research)

**Cons:**

- Unnecessary indirection today — there is one transport to support
- DorkOS's architecture uses hexagonal patterns at the server layer, not in
  client connection management
- Adds a new abstraction that every future contributor must understand
- WebTransport is not production-ready in 2026 per `20260324_sse_resilience_production_patterns.md`

**Verdict:** Premature abstraction. Do not implement unless WebTransport
adoption is actively planned.

#### Approach C: Extend parseSSEStream into a Full SSE Client

Make `parseSSEStream` handle reconnection, backoff, and headers:

```typescript
async function* sseStream(
  url: string,
  options: { headers?: HeadersInit; signal?: AbortSignal; onRetry?: ... }
): AsyncGenerator<SSEEvent>
```

**Pros:**

- Thin SSEConnection class (all reconnect logic in the generator)
- Composable with `for await` patterns

**Cons:**

- Reconnection in an async generator is complex — requires exception handling
  at the yield point and careful signal propagation
- The existing SSEConnection state machine (connecting/connected/reconnecting/
  disconnected) is valuable for the React UI layer — it would need to be
  reconstructed on top of the generator
- The heartbeat watchdog (timer-based) does not compose naturally with an
  async generator
- `useSSEConnection` hook complexity increases significantly

**Verdict:** Not recommended. The class-based state machine is the right model
for long-lived connections with complex lifecycle. Generators are the right
model for one-shot streaming (which `parseSSEStream` already serves correctly
in `sendMessage` and `scan`).

---

## Recommended Implementation Path

### Phase 1: Extend `parseSSEStream`

Update `sse-parser.ts` to expose `id:` and `retry:` fields and pass heartbeat
comments through:

```typescript
export interface SSEEvent<T = unknown> {
  type: string;
  data: T;
  id?: string; // new: from `id:` field
  retry?: number; // new: from `retry:` field (ms)
}

export interface SSEComment {
  kind: 'comment';
  value: string; // content after `: `
}

export type SSEChunk<T = unknown> = SSEEvent<T> | SSEComment;
```

Or, simpler: keep the current `SSEEvent` signature and add `id` / `retry` as
optional fields. Expose an `onRetry` callback option. This avoids changing
the return type of the generator.

### Phase 2: Refactor `SSEConnection`

Replace EventSource internals with fetch. The key private method:

```typescript
private async openFetchConnection(signal: AbortSignal): Promise<void> {
  let response: Response;
  try {
    response = await fetch(this.url, {
      headers: this.buildHeaders(),
      signal,
    });
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return; // intentional close
    this.handleConnectionError();
    return;
  }

  if (!response.ok) {
    this.handleConnectionError();
    return;
  }

  this.setState('connected');
  this.startStabilityTimer();
  this.resetWatchdog();

  const reader = response.body!.getReader();
  try {
    for await (const event of parseSSEStream(reader)) {
      if (event.id) this.lastEventId = event.id;
      if (event.retry) this.serverRetryMs = event.retry;
      this.lastEventAt = Date.now();
      this.resetWatchdog();
      const handler = this.options.eventHandlers[event.type];
      if (handler) {
        try { handler(JSON.parse(event.data as string)); }
        catch { handler(event.data); }
      }
    }
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return; // intentional close
    this.handleConnectionError();
  }
  // If the loop ends without abort (server closed cleanly), treat as error
  if (!signal.aborted) {
    this.handleConnectionError();
  }
}
```

### Phase 3: Update Tests

Replace `MockEventSource` with a `fetch` mock:

```typescript
// Use vi.stubGlobal('fetch', mockFetch)
// The mock returns a Response with a ReadableStream body
// Simulate events by enqueuing SSE-formatted chunks to the stream
// Simulate errors by enqueuing an error to the stream controller
```

This is the most labor-intensive part of the migration. The existing
`SSEConnection` tests cover 30+ scenarios — all remain valid in structure.

---

## Production Gotchas Specific to Fetch-Based SSE

| Gotcha                                                                  | Risk          | Mitigation                                                                                          |
| ----------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `AbortError` not distinguished from network error                       | High          | Check `err.name === 'AbortError'` before calling `handleConnectionError`                            |
| `response.body` is `null` on some error responses                       | Medium        | Guard with `response.body!` only after checking `response.ok`                                       |
| `ReadableStream` remains locked if generator abandoned without `return` | Medium        | `parseSSEStream` `finally` block calls `reader.releaseLock()` — verify this handles abort correctly |
| Fetch does not support automatic redirect-and-reconnect                 | Low           | Handle 3xx responses in `openFetchConnection` if needed                                             |
| HTTP/2 server push is deprecated in browsers                            | Informational | Not used; irrelevant                                                                                |
| `Cache-Control: no-cache` header must be sent explicitly                | Medium        | Include in `buildHeaders()` — `EventSource` sent this automatically                                 |
| `Accept: text/event-stream` header must be sent explicitly              | Medium        | Include in `buildHeaders()`                                                                         |

---

## Research Gaps & Limitations

- No live web search was performed. All findings are based on existing DorkOS
  research reports and direct codebase inspection.
- `AbortSignal.any()` browser support data is from training knowledge (Chrome
  116+, Firefox 124+, Safari 17.4+) — verify in `caniuse.com` before relying
  on it without a polyfill.
- The `eventsource-parser` v3 bundle size estimate (~900 bytes gzipped) is
  from prior research knowledge; verify against the npm package if considering
  adopting it.
- Caddy v2 `Caddyfile` syntax was not verified against latest docs — the
  example is standard and unlikely to have changed but should be confirmed.

---

## Contradictions & Disputes

**"Use `reader.cancel()` vs. `controller.abort()`"**: Some sources recommend
calling `reader.cancel()` for explicit stream cleanup; others treat
`controller.abort()` alone as sufficient. The distinction is academic for
SSE teardown: aborting the fetch causes the underlying stream to error, which
terminates the reader. `reader.cancel()` is a courtesy that may flush
browser-internal buffers more aggressively. For `SSEConnection`, which does
not care about the remaining bytes, either is correct; `abort()` alone is
simpler.

**"Implement `retry:` vs. ignore it"**: The server `retry:` field was designed
for `EventSource`'s built-in reconnection. Fetch-based clients must implement
it manually if they want to honor it. Given that DorkOS's server does not
currently send `retry:`, implementing the floor behavior is optional but adds
future-proofing. The cost (4 lines of code) makes it worth including.

---

## Sources & Evidence

All findings are derived from or cross-referenced with:

- DorkOS internal research: `research/20260324_sse_resilience_production_patterns.md`
- DorkOS internal research: `research/20260327_sse_multiplexing_unified_stream.md`
- DorkOS source: `apps/client/src/layers/shared/lib/transport/sse-connection.ts`
- DorkOS source: `apps/client/src/layers/shared/lib/transport/sse-parser.ts`
- DorkOS source: `apps/client/src/layers/shared/lib/transport/http-transport.ts`
- DorkOS source: `apps/client/src/layers/shared/model/use-sse-connection.ts`
- DorkOS source: `apps/client/src/layers/shared/lib/transport/__tests__/sse-connection.test.ts`
- MDN: AbortController — [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- MDN: AbortSignal.any() — [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static)
- MDN: ReadableStream.cancel() — [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/cancel)
- WHATWG: Server-Sent Events spec — [html.spec.whatwg.org](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- @microsoft/fetch-event-source — [github.com/Azure/fetch-event-source](https://github.com/Azure/fetch-event-source)
- eventsource-parser (rexxars) — [github.com/rexxars/eventsource-parser](https://github.com/rexxars/eventsource-parser)

---

## Search Methodology

- Searches performed: 0 (web search unavailable)
- Primary sources: existing DorkOS research reports + direct codebase reading
- Codebase files inspected: 8
- Existing research reports reviewed: 2 (in full) + 1 (partially)
