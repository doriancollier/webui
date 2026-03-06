# fix-relay-sse-backpressure — Task Breakdown

**Spec:** `specs/fix-relay-sse-backpressure/02-specification.md`
**Generated:** 2026-03-06
**Mode:** Full

---

## Phase 1 — Core Fix

### Task 1.1: Add async write queue to subscribeToRelay and drain handling to broadcastUpdate

**File:** `apps/server/src/services/session/session-broadcaster.ts`

Two changes:

1. **`subscribeToRelay()`** — Replace synchronous `res.write()` with an async write queue. The relay subscribe callback is synchronous, so writes are pushed to a `queue: string[]` and flushed asynchronously with drain handling. A `writing` flag prevents concurrent flushes.

2. **`broadcastUpdate()`** — Add drain handling to the `client.write(eventData)` loop. Check `res.write()` return value and `await` the `drain` event when it returns `false`.

**Dependencies:** None

---

### Task 1.2: Add unit tests for backpressure handling in session broadcaster

**File:** `apps/server/src/services/session/__tests__/session-broadcaster.test.ts`

Three test cases:

1. Relay subscription waits for drain when `write()` returns `false`
2. Event ordering preserved under backpressure (3 rapid messages, backpressure on 2nd)
3. `broadcastUpdate` awaits drain on `sync_update` writes

Requires mock `RelayCore`, `TranscriptReader`, `chokidar`, and `Response` objects.

**Dependencies:** 1.1
