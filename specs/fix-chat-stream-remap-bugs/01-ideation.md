---
slug: fix-chat-stream-remap-bugs
number: 126
created: 2026-03-12
status: ideation
---

# Fix Chat UI Streaming Bugs — Duplicate Messages & Stale Model Display

**Slug:** fix-chat-stream-remap-bugs
**Author:** Claude Code
**Date:** 2026-03-12
**Branch:** preflight/fix-chat-stream-remap-bugs

---

## 1) Intent & Assumptions

- **Task brief:** Fix two client-only bugs caused by the session ID remap flow: (1) every assistant response appears twice in the DOM during live streaming because the optimistic streaming buffer isn't cleared when the session ID remap triggers a history re-fetch; (2) the model display stays stale after a model change because `streamingStatus?.model` overrides `session?.model` in the priority chain even after streaming has ended.
- **Assumptions:**
  - Both bugs are client-only — no server changes required
  - The session ID remap flow itself (client UUID → SDK UUID) is correct and intentional; we're fixing how the client reacts to it
  - Bug #2 (model selector no-op before first message) is excluded from this scope per task brief
  - UX Issue #1 (first message appears without bubble during remap) is excluded per task brief
  - The fix should not cause a perceptible flash of empty messages between clearing and history arriving
- **Out of scope:**
  - Server-side changes
  - Bug #2 (pre-session model selector no-op)
  - UX Issue #1 (optimistic bubble before session exists)
  - Tool call card rendering (message 4 observation — separate issue)
  - The session ID translation for hard-refresh (server-side)

---

## 2) Pre-reading Log

- `test-results/chat-self-test/20260312-085236.md`: Full self-test results. Bug #1 confirmed on messages 3–5. Bug #3 confirmed after model change. History reload is correct (no duplication). Key: bug is live-streaming-only.
- `apps/client/src/layers/features/chat/model/use-chat-session.ts` (400 lines): Core hook managing streaming messages, history fetching, and state lifecycle. Contains the `historySeededRef` guard and the `statusRef.current !== 'streaming'` check that causes Bug #1.
- `apps/client/src/layers/features/chat/model/stream-event-handler.ts` (319 lines): Processes SSE events. The `done` event handler fires `onSessionIdChangeRef.current?.(newSessionId)` BEFORE `setStatus('idle')`, creating the timing window that causes Bug #1.
- `apps/client/src/layers/entities/session/model/use-session-status.ts` (126 lines): Computes model priority chain. Bug #3 is at line 69: `localModel ?? streamingStatus?.model ?? session?.model ?? DEFAULT_MODEL`. The convergence effect (lines 116–123) only clears `localModel`, never `streamingStatus`.
- `apps/client/src/layers/features/chat/ui/ChatPanel.tsx`: Wires `onSessionIdChange: setSessionId` and calls `useSessionStatus(sessionId, sessionStatus, status === 'streaming')`.
- `apps/client/src/layers/entities/session/model/use-session-id.ts` (30 lines): Dual-mode hook — updates URL param (standalone) or Zustand store (Obsidian) when session ID changes.
- `research/20260312_fix_chat_stream_remap_bugs.md`: Fresh research report created by the research agent; covers adjacent patterns and cross-references three prior research reports on streaming bugs.
- `research/20260310_fix_chat_streaming_model_selector_bugs.md`: Prior research on Bug #3 (model display) — confirms the `isStreaming` gate approach.
- `research/20260311_fix_chat_ui_reliability_bugs.md`: Prior research on related reliability issues.

---

## 3) Codebase Map

**Primary Components/Modules:**

- `apps/client/src/layers/features/chat/model/use-chat-session.ts` — Core session hook; owns `messages`, `status`, `sessionStatus`, `streamStartTime`, `estimatedTokens`, `isTextStreaming`. Contains `historySeededRef` flag and the session-change effect (lines 164–172) with the `statusRef.current !== 'streaming'` guard.
- `apps/client/src/layers/features/chat/model/stream-event-handler.ts` — Creates the SSE event handler. The `done` case (lines 292–311) is the trigger point for Bug #1: fires `onSessionIdChange` before `setStatus('idle')`, leaving `statusRef.current === 'streaming'` during the session ID change effect.
- `apps/client/src/layers/entities/session/model/use-session-status.ts` — Computes derived status (model, permission mode, cost, context %). Bug #3 fix location: line 69.
- `apps/client/src/layers/features/chat/ui/ChatPanel.tsx` — Wires `useChatSession` + `useSessionStatus` together; passes `isStreaming` flag.

**Shared Dependencies:**

- `apps/client/src/layers/shared/model/` — Transport, Zustand `useAppStore`
- `@dorkos/shared/types` — `SessionStatusEvent`, `ChatMessage`, `MessagePart`

**Data Flow — Bug #1 (Duplicate Messages):**

```
1. User sends message → sessionId = "client-uuid" → status = 'streaming'
2. SSE stream active: text_delta events accumulate in currentPartsRef; messages[] grows
   - Streaming assistant message has id = assistantIdRef.current (client-generated UUID)
   - pendingUserContent = user text (UI-only bubble, NOT in messages[])
3. done event arrives:
   a. Remap detected: doneData.sessionId !== sessionId
   b. onSessionIdChangeRef.current?.("sdk-uuid") → updates URL/Zustand
   c. setStatus('idle') → batched React state update (NOT yet applied)
4. Component re-renders with sessionId = "sdk-uuid"
5. useEffect([sessionId, selectedCwd]) fires:
   a. historySeededRef.current = false ✓
   b. statusRef.current === 'streaming' (still true — ref not yet updated) → guard passes
   c. setMessages([]) NOT called ✗
6. historyQuery refetches ['messages', 'sdk-uuid', cwd] → returns {user msg, assistant msg}
7. historySeeded effect fires → builds currentIds Set from existing messages[]
   - currentIds contains: assistantIdRef.current (client UUID)
   - history contains: user_msg{id: sdk-user-uuid} + assistant_msg{id: sdk-assistant-uuid}
   - SDK-assigned assistant UUID ≠ client UUID → dedup misses → BOTH rendered
8. Result: [streamed assistant msg (client UUID)] + [user bubble] + [history assistant msg (sdk UUID)] = DUPLICATE
```

**Note:** The user message is not in `messages[]` — it's in `pendingUserContent` (a UI-only bubble). The duplication is purely the assistant message, rendered once with the client-generated ID from streaming and once with the SDK-assigned ID from history.

**Data Flow — Bug #3 (Stale Model):**

```
1. Streaming: session_status event fires → sessionStatus.model = "claude-sonnet-4-6"
2. User selects Haiku → setLocalModel("claude-haiku-...") → PATCH 200 OK
3. queryClient.setQueryData updates session.model = "claude-haiku-..."
4. Convergence effect: localModel === session.model → setLocalModel(null) ✓
5. Model computed: null ?? streamingStatus?.model("claude-sonnet-4-6") ?? "claude-haiku-..." → "claude-sonnet-4-6"
6. streamingStatus is NEVER cleared after streaming ends → stale value persists
```

**Potential Blast Radius:**

- **Direct:** 2 files (`stream-event-handler.ts`, `use-session-status.ts`)
- **Possibly Direct:** `use-chat-session.ts` depending on chosen approach for Bug #1
- **Tests:** `apps/client/src/layers/features/chat/__tests__/use-chat-session.test.tsx`, `apps/client/src/layers/entities/session/__tests__/use-session-status.test.tsx` (new test cases needed)

---

## 4) Root Cause Analysis

### Bug #1 — Duplicate Messages

**Repro steps:**
1. Open a new chat session
2. Send message 1 (triggers session ID remap: client-uuid → sdk-uuid)
3. Send message 2 → assistant response appears once ✓
4. Send message 3 → assistant response appears twice ✗

**Observed vs Expected:**
- Observed: `[streaming assistant response] [user bubble] [history assistant response]`
- Expected: `[user bubble] [assistant response]`

**Evidence:**
- Self-test confirms duplication starts on message 3 (second message after remap), not message 1
- History reload is correct — pure live-streaming bug
- `stream-event-handler.ts:292–296`: `onSessionIdChangeRef` fires BEFORE `setStatus('idle')`
- `use-chat-session.ts:169`: `if (statusRef.current !== 'streaming') setMessages([])` — guard prevents clearing

**Root-cause hypothesis (high confidence):**
Two factors combine:

1. **`setMessages([])` not called during remap:** The `done` handler fires `onSessionIdChange(newId)` while `status` is still `'streaming'` (batched state update not yet applied). The session-change effect's guard `statusRef.current !== 'streaming'` passes, so `setMessages([])` is skipped.

2. **ID-mismatch deduplication failure:** The streaming assistant message in `messages[]` has `assistantIdRef.current` (a client-generated UUID). When history arrives from the new SDK session ID, the assistant message has the SDK-assigned UUID. The seed effect's `currentIds` Set cannot match them, so both the streaming copy and the history copy are retained in `messages[]`.

The second factor is the precise mechanism of duplication. The first factor is why the messages aren't cleared to give the dedup a clean slate.

**Note on message 1 vs message 2:** The duplication starts on message 3 of the test because message 1 IS the remap trigger — there's no prior streaming content to duplicate. Message 2 onwards shows the duplicate because now there IS a completed streaming buffer that isn't cleared.

### Bug #3 — Stale Model Display

**Repro steps:**
1. Send a message (triggers stream with `session_status` event setting `sessionStatus.model`)
2. After streaming completes, open model selector
3. Select a different model (e.g., Haiku)
4. Observe: status bar still shows Sonnet

**Root-cause hypothesis (high confidence):**
`streamingStatus?.model` is set during streaming via `session_status` events and is NEVER cleared after streaming ends. The `setSessionStatus(null)` call doesn't happen in the `done` handler. The convergence effect only clears `localModel`. So `streamingStatus?.model` persists indefinitely and sits above `session?.model` in the priority chain.

---

## 5) Research

Since both bugs have clearly identified root causes from code inspection, research focuses on comparing fix strategies.

### Bug #1 — Potential Solutions

**1. Clear messages in `done` handler when remap detected (stream-event-handler.ts)**
- Description: When `done` detects a remap, call `setMessages([])`, reset `currentPartsRef.current = []`, and reset `assistantCreatedRef.current = false` BEFORE calling `onSessionIdChangeRef`. History re-fetch becomes sole source of truth.
- Pros: Targeted — only clears on remap, not every `done` event. Stream-event-handler owns the knowledge that a remap happened.
- Cons: Brief flash of empty message list between clear and history arrival (~50–200ms). Requires passing `setMessages` context into the handler at the remap branch.
- Complexity: Low

**2. Remove streaming guard from session-change effect (use-chat-session.ts)**
- Description: Delete `if (statusRef.current !== 'streaming')` — always clear messages when sessionId changes.
- Pros: Simplest change (remove 2 lines). Correct for the remap case since remap only happens at stream end.
- Cons: If any other code path changes sessionId mid-stream (currently none), it would incorrectly clear. Less explicit about intent. Same flash issue as approach 1.
- Complexity: Low

**3. Call `setStatus('idle')` before `onSessionIdChangeRef` in done handler**
- Description: Reorder the done handler — call `setStatus('idle')` first, then `onSessionIdChangeRef`. If React flushes `status` before the effect runs, `statusRef.current` would be 'idle' and the guard would allow `setMessages([])`.
- Pros: Minimal change, preserves existing guard logic.
- Cons: Depends on React batching/flush behavior which is implementation-specific. React 19 auto-batches across async boundaries, so this may NOT reliably fix the race — `statusRef` is only updated after a subsequent render, not synchronously. Fragile.
- Complexity: Low but unreliable

**4. Transition state — hide streaming messages while history loads (use-chat-session.ts)**
- Description: Add `isRemapping` state. Set true when remap detected; hide/filter streaming messages from render while `isRemapping && isLoadingHistory`. Set false when history arrives.
- Pros: No flash — seamless visual transition from streaming to history state.
- Cons: More complex. Requires threading `isRemapping` to the UI. Risk of getting stuck if history fails to load.
- Complexity: Medium

**5. Stable Assistant ID via Server Echo (Long-Term, Out of Scope)**
- Description: Server includes the SDK-assigned assistant message ID in the `done` event; client updates `assistantIdRef.current` in-memory so the existing ID-based dedup works correctly without any clearing.
- Pros: Fixes the root cause (ID mismatch) at the protocol level. No empty flash. ID dedup becomes reliable everywhere.
- Cons: Requires server-side changes to the `done` event payload — out of scope for this client-only fix. Better tracked as a follow-up.
- Complexity: High (server + client)

**Recommendation for Bug #1:** Approach 1 — call `setMessages([])` in the `done` handler before the remap callback. The `setMessages` setter is already in `StreamEventDeps` so no interface change is needed. This is semantically correct: "the stream has ended and a new authoritative session ID has been provided; the streaming buffer is no longer valid." The brief flash is the same UX pattern already present on manual session switches. Approach 5 is the principled long-term fix but requires server changes.

### Bug #3 — Potential Solutions

**1. Gate `streamingStatus?.model` behind `isStreaming` (use-session-status.ts)**
- Description: Change line 69 to: `localModel ?? (isStreaming ? streamingStatus?.model : null) ?? session?.model ?? DEFAULT_MODEL`
- Pros: Minimal, surgical, exactly matches the intent. Permission mode already has no equivalent streaming field, so this makes model behavior consistent.
- Cons: None significant. `streamingStatus` still persists in memory (but no longer affects display).
- Complexity: Low

**2. Clear `streamingStatus` in done handler**
- Description: Call `setSessionStatus(null)` in `stream-event-handler.ts` done case.
- Pros: Fully cleans up streaming state. Priority chain stays unchanged.
- Cons: `streamingStatus` is used for context window display too — clearing it would also clear the post-stream context percentage, which IS currently visible in the status bar after streaming ends. Would need to preserve context data while only discarding model.
- Complexity: Medium (need to selectively null out model field, not full status)

**Recommendation for Bug #3:** Approach 1. One-line change, zero side effects, consistent with how permission mode already works.

---

## 6) Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | How to fix Bug #1 duplicate messages | Clear messages in `done` handler on remap (Approach 1) | Most semantically correct — the streaming buffer is definitively invalid once a remap fires. Keeps the session-change effect's guard intact for non-remap cases. The brief flash is acceptable since it only occurs during session creation, not mid-conversation. |
| 2 | How to fix Bug #3 stale model | Gate `streamingStatus?.model` behind `isStreaming` | One-line change with no side effects. Matches the existing permission mode pattern (which has no streaming field and therefore already works correctly). Avoids clearing streamingStatus.contextTokens which IS used post-stream. |
| 3 | Clear `currentPartsRef` and `assistantCreatedRef` on remap? | Yes — reset both when clearing messages on remap | These refs track the in-flight streaming message. If they're not reset, subsequent streaming (if any) would corrupt state. Belt-and-suspenders correctness. |
| 4 | Add tests for both bugs? | Yes — add regression tests | Self-test proved these are real bugs. Tests should cover: (a) session remap clears streaming buffer, (b) model priority chain doesn't use streamingStatus when isStreaming=false. |
