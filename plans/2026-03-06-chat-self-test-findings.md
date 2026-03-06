# Chat Self-Test Findings — 2026-03-06

## Test Config
- URL: `http://localhost:4241/?dir=/Users/doriancollier/Keep/temp/empty`
- Session ID (URL/Agent): `7dd04b5c-cd62-48a1-ab00-ec7c63b3a60e`
- Session ID (SDK/JSONL): `21b09157-6961-4f92-a2c4-dd37863fa510`
- Model: Haiku 4.5 (`claude-haiku-4-5-20251001`)
- Permission mode: Accept Edits
- Relay enabled: yes
- Pulse enabled: yes
- API port: 4242 (`.env` DORKOS_PORT=6942 not loaded by turbo)
- Messages sent: 5

## Summary

The chat UI has a **critical SSE stream freeze bug** affecting 3 of 5 messages when Relay is enabled. Responses complete in ~15s but the SSE stream stays open 60-80+ seconds, leaving the stop button visible indefinitely. A secondary truncation bug causes incomplete response rendering during streaming (full content appears correctly on history reload). Both bugs trace to the same root cause: `session-broadcaster.ts` uses synchronous `res.write()` without backpressure handling — a pattern that was fixed in `stream-adapter.ts` by commit `1352e31` but never applied to the broadcaster.

## Issues Found

### 1. SSE Stream Freeze on Relay Messages — Bug (P0)

**Observed:** After response content finishes streaming (~15s), the SSE stream stays open for 60-80+ seconds. Stop button remains visible. Timer keeps incrementing. Content is unchanged. Occurred on messages 1, 2, 3, and 5. Message 4 (TodoWrite) did NOT freeze — completed in 12s.

**Expected:** SSE stream should close within a few seconds of the last content event. Stop button should disappear. A `done` event should terminate the stream.

**Root cause:** `apps/server/src/services/session/session-broadcaster.ts:186` — The relay subscription writes SSE events via `res.write(eventData)` without handling backpressure. When the socket buffer fills, the `done` event may be delayed or the write stalls without resolving. Commit `1352e31` fixed this pattern in `stream-adapter.ts:20-26` (async drain handling) but `session-broadcaster.ts` still uses the old synchronous pattern.

**Code path:**
1. ClaudeCodeAdapter receives SDK events → publishes to `relay.human.console.{clientId}`
2. SessionBroadcaster subscribes → `res.write(eventData)` at line 186
3. No backpressure handling → write stalls, `done` event delayed
4. Client `useChatSession` waits for `done` event → never arrives → stream hangs

**Also affected:** `session-broadcaster.ts:324` — `broadcastUpdate()` has the same `client.write()` pattern for `sync_update` events.

**ADR context:** None found specifically for SSE backpressure.

**Recommendation:** Apply the same async drain pattern from `stream-adapter.ts:20-26` to `session-broadcaster.ts:186` and `:324`:
```typescript
const ok = res.write(eventData);
if (!ok) {
  await new Promise<void>((resolve) => res.once('drain', resolve));
}
```

---

### 2. Response Text Truncation During Streaming — Bug (P1)

**Observed:** For "What is 2+2?", JSONL contains `'2 + 2 = **4**'` but UI displayed only "2" during live streaming. After page reload from history, the full "2 + 2 = 4" rendered correctly.

**Expected:** Full response text should appear during streaming, not just on reload.

**Root cause:** Same as Bug 1 — `session-broadcaster.ts:186`. Under backpressure, `res.write()` may drop or buffer events inconsistently. Short responses (few tokens) are most vulnerable since the text arrives in a burst that coincides with backpressure from prior events. The `text_delta` events are lost or never delivered to the client's EventSource.

**Evidence:**
- JSONL has complete response (server wrote it correctly)
- UI shows truncated response during streaming (client SSE stream incomplete)
- History reload shows full response (parsed from JSONL, not SSE)

**Recommendation:** Same fix as Bug 1.

---

### 3. URL Session ID Mismatch with Relay — Bug (P2)

**Observed:** When Relay is enabled, clicking "New Session" creates a URL with `?session=7dd04b5c-...` (the Agent-ID from relay context), but the actual SDK session ID is `21b09157-...` (JSONL filename). The sidebar displays the SDK session ID. After page reload/navigation, the URL switches to the correct SDK session ID.

**Expected:** URL `?session=` parameter should always contain the SDK session ID for consistency with JSONL lookups, API calls, and sidebar display.

**Root cause:** Not fully traced. The session creation flow in Relay mode likely returns the agent-ID as the session identifier instead of the SDK session ID.

**Recommendation:** Investigate where `?session=` is set during new session creation in Relay mode. Ensure it uses the SDK session ID from the JSONL filename, not the agent ID.

---

### 4. API `/messages` Returns Empty for Relay Sessions — Bug (P2)

**Observed:** `GET /api/sessions/21b09157-.../messages` returns `{ messages: [] }` even though the JSONL has 37 lines with 5 complete exchanges.

**Expected:** API should return parsed messages from the JSONL file.

**Root cause:** Not fully traced. The `TranscriptReader` may be failing to find or parse the JSONL file, or the session lookup by ID may not match the Relay-mode session.

**Recommendation:** Investigate `transcript-reader.ts` session lookup logic when Relay is enabled. The session ID should resolve to the correct JSONL file path.

---

### 5. Session Title Never Updates — UX Issue (P3)

**Observed:** Session displays as "Session 21b09157" throughout the test. No meaningful title was ever generated despite 5 exchanges.

**Expected:** Session title should update to something descriptive (e.g., "Bubble Sort Function") after the first message.

**Root cause:** Title extraction in `transcript-reader.ts` uses the first user message text. When Relay is enabled, the user message is wrapped in `<relay_context>` XML, which may cause the title extractor to fail or return the raw XML instead of the user's actual message.

**Recommendation:** Strip `<relay_context>` wrapper when extracting session titles.

---

### 6. Model Display Shows Full Model ID in History — UX Issue (P3)

**Observed:** During live streaming, status bar shows friendly "Haiku 4.5". After page reload, it shows the full model ID `claude-haiku-4-5-20251001`.

**Expected:** Consistent display using the friendly name ("Haiku 4.5") regardless of whether viewing live or from history.

**Root cause:** Live streaming likely uses the user-selected model name from local state, while history reload reads the raw model ID from the JSONL init message and doesn't map it to the friendly display name.

**Recommendation:** Apply the same model ID → display name mapping used in the model selector to the history-loaded model value.

## Observations (No Issues)

- **Code block rendering** — JavaScript, TypeScript, HTML all render correctly with syntax highlighting and line numbers in both live and history views.
- **Tool call cards** — TodoWrite card renders properly with checkmark, expand/collapse chevron, and task list.
- **Session sidebar** — Updates correctly when new sessions are created, shows relative timestamps.
- **Permission mode and model selectors** — Work correctly, changes reflected in status bar.
- **Cost tracking** — "$0.03" and "0%" context usage appeared during live session.
- **Multi-turn context** — Haiku correctly referenced prior messages (TypeScript types applied to previous bubble sort).
- **Timestamps** — Correct timestamps shown on user messages (05:44 AM, 05:45 AM).
- **Markdown rendering** — Bold text, bullet lists, inline code all render correctly.
