---
description: "Self-test the DorkOS chat UI in a live browser session — drives real interactions, monitors JSONL transcript, compares API vs UI, researches issues, and creates a spec for improvements"
argument-hint: "[url]"
allowed-tools: Read, Write, Bash, Grep, Glob, Task, TaskOutput, AskUserQuestion, Skill, WebSearch, WebFetch, mcp__claude-in-chrome__computer, mcp__claude-in-chrome__read_page, mcp__claude-in-chrome__find, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__read_console_messages, mcp__claude-in-chrome__read_network_requests, mcp__claude-in-chrome__javascript_tool, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__tabs_create_mcp, mcp__claude-in-chrome__get_page_text, mcp__claude-in-chrome__computer
category: testing
---

Self-test the DorkOS chat UI in a live browser session. This command drives real interactions through the full stack, monitors JSONL transcripts on disk, compares API vs UI state at every step, researches any issues found, and produces an evidence-based findings report. If bugs or significant UX issues are found, it creates a spec for an improvement cycle.

---

## Phase 1 — Preflight

Parse `$ARGUMENTS`. If a URL starting with `http` is provided, use it as `TEST_URL`. Default:

```
TEST_URL="http://localhost:4241/?dir=/Users/doriancollier/Keep/temp/empty"
```

Extract the `dir` query param value from `TEST_URL` for JSONL resolution later.

Verify the dev server is up. Try multiple ports since the server may run on `DORKOS_PORT` (from `.env`), the default 4242 (when `.env` isn't loaded), or be proxied through Vite on 4241:

```bash
DORKOS_PORT="${DORKOS_PORT:-6942}"
# Try configured port first, then default, then Vite proxy
for port in $DORKOS_PORT 4242 4241; do
  if curl -sf "http://localhost:$port/api/health" | grep -q '"ok"'; then
    API_PORT=$port
    echo "Server found on port $port"
    break
  fi
done
[ -z "$API_PORT" ] && { echo "ERROR: DorkOS server not responding. Run 'pnpm dev' first."; exit 1; }
```

Check server config for Relay and Pulse status (affects session ID resolution and API comparison):

```bash
curl -s "http://localhost:$API_PORT/api/config" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('RELAY_ENABLED:', d.get('relay',{}).get('enabled', False))
print('PULSE_ENABLED:', d.get('pulse',{}).get('enabled', False))
"
```

Store `RELAY_ENABLED` — this affects session ID resolution in Phase 2 and API comparison in Phase 4.

Fetch the current model list to know what's available:

```bash
curl -s "http://localhost:$API_PORT/api/models" | jq '.models[].value'
```

Navigate the browser to `TEST_URL`. Use `mcp__claude-in-chrome__tabs_context_mcp` first to get tab context, then `mcp__claude-in-chrome__navigate`. Take a screenshot and read the page. Capture any pre-existing console errors as a baseline via `mcp__claude-in-chrome__read_console_messages` (filter: `error`).

---

## Phase 2 — Create New Session

1. Locate the "New Session" button in the SessionSidebar via `mcp__claude-in-chrome__find`.
2. Click it and wait for the URL to update with a `?session=` query parameter.
3. Extract the session UUID from the URL. Store it as `URL_SESSION_ID`.

**Relay-aware JSONL resolution:**

When Relay is enabled, the URL `?session=` param contains the **Agent-ID**, NOT the SDK session ID. The JSONL filename uses the real SDK session ID. The sidebar displays the SDK session ID.

4. Locate the JSONL file on disk. **If Relay is enabled**, find by most-recent modification time (since the URL session ID won't match the JSONL filename):

```bash
# When Relay is enabled — find by recent modification
JSONL_FILE=$(find ~/.claude/projects -name "*.jsonl" -mmin -2 -type f 2>/dev/null | head -1)
SDK_SESSION_ID=$(basename "$JSONL_FILE" .jsonl)
echo "URL Session ID (Agent-ID): $URL_SESSION_ID"
echo "SDK Session ID: $SDK_SESSION_ID"
echo "JSONL: $JSONL_FILE"
```

When Relay is NOT enabled, find by URL session ID directly:

```bash
JSONL_FILE=$(find ~/.claude/projects -name "${URL_SESSION_ID}.jsonl" -type f 2>/dev/null)
SDK_SESSION_ID="$URL_SESSION_ID"
echo "JSONL: $JSONL_FILE"
```

The file may not exist yet — re-run this check after the first message is sent.

5. Take a screenshot of the new empty session.

---

## Phase 3 — Configure Session

1. **Change model:** Click the model selector in the status bar. Choose `claude-haiku-4-5` (fastest, cheapest — appropriate for UI testing, not AI capability testing). If `claude-haiku-4-5` is not available, choose the smallest/cheapest model visible in the list.
2. **Set permission mode:** Click the permission mode selector in the status bar. Choose "Accept Edits" so tool-use file writes do not require manual approval during the test.
3. Take a screenshot after configuring both settings. Verify both settings are reflected in the status bar.

---

## Phase 4 — Send Messages & Observe (5 rounds)

Send the following messages in sequence. For each message:

**Message script:**

| # | Message | Notes |
|---|---------|-------|
| 1 | `Write a JavaScript bubble sort function with comments` | Tests code rendering |
| 2 | `Add TypeScript types to the function` | Tests multi-turn context |
| 3 | `Write a minimal HTML page with a <h1>Hello World</h1> heading` | Tests HTML in code blocks |
| 4 | `Use TodoWrite to create a task list with 3 tasks for our current conversation` | Tests task UI |
| 5 | `What is 2+2?` | Tests simple text response |

**Extended test messages (optional, adds significant time):**

| # | Message | Notes |
|---|---------|-------|
| E1 | `Use the Task tool to launch a background agent that counts the number of files in /tmp and reports back` | Tests background agents |
| E2 | `Use the Bash tool in the background to watch /tmp for 5 seconds and report any changes` | Tests background tasks |
| E3 | `Mark the first task as completed` | Tests task updates |

**Per-message observation loop (repeat for each message):**

**a. Send the message:**
Click the chat input (use `mcp__claude-in-chrome__find` for "Message Claude input"), type the message text, and press `Meta+Enter` (Cmd+Enter) to submit.

**b. Wait for streaming to complete (with SSE freeze regression detection):**
Wait up to 120 seconds for the stop button to disappear. Use this staleness detection heuristic:

1. Take a screenshot after 15 seconds.
2. Wait 10 more seconds, take another screenshot.
3. If visible text is identical between screenshots but stop button persists, record an **"SSE stream freeze"** observation and click the stop button to unblock the test.
4. If stop button disappears naturally, note the actual streaming duration.

This prevents the test from hanging indefinitely per message. SSE freezes were fixed in the `fix-relay-sse-delivery-pipeline` spec — any freeze is now a **regression** and should be investigated with high priority.

**c. Take a screenshot** of the full rendered exchange.

**d. Collect console messages** at `warning` level via `mcp__claude-in-chrome__read_console_messages`. Note any new warnings since the last check.

**e. Collect network requests** via `mcp__claude-in-chrome__read_network_requests`. Note status codes for `/api/sessions/:id/messages` POST calls.

**f. Extract visible messages from the DOM:**
```js
// Use mcp__claude-in-chrome__javascript_tool
() => [...document.querySelectorAll('[data-message-role]')]
  .map(el => ({ role: el.dataset.messageRole, text: el.textContent.slice(0, 120) }))
```
First inspect the actual DOM via `mcp__claude-in-chrome__read_page` to confirm the correct selectors are used.

**g. Compare against the API (skip when Relay is enabled):**

When Relay is enabled, `GET /api/sessions/:id/messages` may return 0 messages even for valid sessions. This is a known limitation — skip the API comparison and rely on JSONL as the source of truth.

When Relay is NOT enabled:
```bash
curl -s "http://localhost:$API_PORT/api/sessions/$SDK_SESSION_ID/messages" \
  | jq '[.messages[] | {role, preview: (.content | if type=="string" then .[0:100] else (.[0].text // "[block]")[0:100] end)}]'
```

**h. Compare against JSONL on disk:**
```bash
python3 -c "
import sys, json
for line in open('$JSONL_FILE'):
    o = json.loads(line)
    print(o.get('type','?'), '|', o.get('message',{}).get('role',''), '|', str(o.get('message',{}).get('content',''))[:80])
"
```

**i. For task list messages (message 4):**
After sending, check whether task list UI elements are visible in the DOM. Compare rendered tasks against:
- `task_update` SSE events captured in the network log
- `TaskCreate`/`TaskUpdate` tool_use blocks in the JSONL

**j. Record any discrepancy or anomaly** — data mismatch, console error, broken element, missing state update, unexpected blank area, scroll regression, SSE freeze, etc.

---

## Phase 5 — Final State Capture

After all 5 rounds:

1. Full-page screenshot.
2. Console messages at `debug` level (comprehensive log) via `mcp__claude-in-chrome__read_console_messages`.
3. Full network request log via `mcp__claude-in-chrome__read_network_requests`.
4. Full DOM snapshot of the message list via `mcp__claude-in-chrome__read_page`.
5. Read the complete JSONL file (all lines) in structured form:

```bash
python3 -c "
import json
for i, line in enumerate(open('$JSONL_FILE')):
    o = json.loads(line)
    print(f'{i:3}', o.get('type','?').ljust(20), o.get('message',{}).get('role','').ljust(12), str(o.get('message',{}).get('content',''))[:60])
"
```

6. Fetch final session metadata:

```bash
curl -s "http://localhost:$API_PORT/api/sessions/$SDK_SESSION_ID" | jq '{model, permissionMode, title}'
```

---

## Phase 5b — Reload from History (Critical Regression Check)

This phase verifies that message history renders correctly when loaded from disk — a different code path (`GET /api/sessions/:id/messages` -> `transcript-parser.ts` -> `MessageList` props) that often hides bugs invisible during live streaming.

**Method A: Hard page refresh**

Navigate to the same URL with the `?session=` param preserved. Wait for messages to finish loading. Take a screenshot.

**Method B: Navigate away then back**

1. Click a different session in the sidebar (or click the DorkOS logo to go home).
2. Wait for that session to load.
3. Click the test session back in the sidebar.
4. Wait for messages to re-render.
5. Take a screenshot.

**Verify after each reload:**

| Check | Expected |
|-------|----------|
| Message count | Same as during live session (DOM count == JSONL count) |
| Code blocks | Properly rendered (not raw markdown) |
| Tool call cards | All tool calls visible and collapsible |
| Task list | Tasks visible with correct status |
| Tool call order | Same order as during live session |
| Model/permission display | Correct values in status bar |
| Scroll position | Scrolled to bottom (latest message) |

Compare the history-loaded screenshots against the live-session screenshots from Phase 4. Note any visual differences, especially:
- Expanded/collapsed state of tool call cards
- Missing or duplicated messages
- Timestamp correctness
- Any layout shifts or blank areas

---

## Phase 6 — Issue Analysis & Deep Research

Classify each observation into one of:

| Class | Meaning |
|-------|---------|
| **Bug** | Broken functionality — data mismatch, console error, broken element |
| **UX Issue** | Works but feels wrong — scroll, animation, layout, affordance |
| **Improvement** | Could be better — missing feature, unclear affordance |

**For every Bug or significant UX Issue, do the research before writing anything:**

1. **Trace the code path.** Use `Grep` and `Read` to find the relevant component, hook, or service. Do not guess file locations.
2. **Review ADRs.** `Glob` `decisions/*.md` and read any ADRs relevant to the topic area.
3. **Read contributing guides.** Read `contributing/architecture.md`, `contributing/data-fetching.md`, `contributing/animations.md`, `contributing/design-system.md` as applicable.
4. **Validate the assumption.** Confirm the bug exists in actual code, not just in observation.
5. **Research best practices.** Use `WebSearch` if the fix isn't clear from the codebase alone.

Only after completing this research: form a concrete recommendation with file paths and line references.

---

## Phase 7 — Write Findings Report

Save the report to: `plans/YYYY-MM-DD-chat-self-test-findings.md`

Use this structure:

```markdown
# Chat Self-Test Findings — [DATE]

## Test Config
- URL: [test URL]
- Session ID (URL/Agent): [URL_SESSION_ID]
- Session ID (SDK/JSONL): [SDK_SESSION_ID]
- Model: [model used]
- Permission mode: [mode used]
- Relay enabled: [yes/no]
- Messages sent: 5

## Summary
[2-3 sentences: overall quality, number of issues, anything critical]

## Issues Found

### [Issue Title] — [Bug | UX Issue | Improvement]
**Observed:** [what actually happened]
**Expected:** [what should have happened]
**Root cause:** [file:line reference after code research]
**ADR context:** [relevant ADR if any]
**Research:** [what you found]
**Recommendation:** [concrete suggestion with specifics]

## Observations (No Issues)
[What worked well — important to preserve in future changes]

## Passing Verdict (if applicable)
[Note if all checks passed]
```

---

## Phase 8 — Create Spec (if warranted)

- **If bugs or significant UX issues were found:** invoke `Skill` with `skill: "spec:create"`, describing the improvement area. Let that skill drive the full spec process.
- **If only minor improvements:** note them in the report with priority labels (P1/P2/P3). Stop there — no spec needed.
- **If no issues found:** note "All checks passed" in the report.

---

## Technical Notes

- **JSONL location:** `~/.claude/projects/{slug}/{sessionId}.jsonl` — use `find` by session ID or by recent modification time.
- **Session ID:** `?session=` URL param, managed by `useSessionId()` hook via nuqs.
- **Model selector:** `ModelItem` in `StatusLine` — opens a `ResponsiveDropdownMenu`.
- **Permission mode selector:** `PermissionModeItem` in `StatusLine` — 4 options available.
- **New session button:** Plus icon in `SessionSidebar`.
- **API port:** `DORKOS_PORT` env var — default is 4242; user config may override (e.g., 6942 via `.env`). The Vite dev server on 4241 proxies `/api` to the backend.
- **Streaming complete signal:** Stop button present during streaming, gone when done.
- **SSE event types to watch:** `text_delta`, `tool_call_start`, `tool_call_end`, `tool_result`, `task_update`, `done`, `stream_ready` (Relay only — confirms SSE subscription is active before POST).
- **SSE freeze detection:** Use content staleness detection (two screenshots 10s apart with identical text) to detect and unblock via stop button click. SSE freezes were fixed in `fix-relay-sse-delivery-pipeline` — any occurrence is a regression.

### Relay Mode

When `DORKOS_RELAY_ENABLED` is true, session messaging uses Relay transport. This changes several behaviors:

- **URL session ID is the Agent-ID**, not the SDK session ID. The JSONL filename uses the real SDK session ID (different from the URL).
- **The sidebar shows the SDK session ID** (e.g., "Session 21b09157"), which matches the JSONL filename.
- **User messages in JSONL are wrapped in `<relay_context>` XML** containing Agent-ID, Session-ID, From, Message-ID, Subject, Sent, Budget, and Reply-to fields.
- **Subscribe-first handshake:** The SSE `/stream` endpoint sends a `stream_ready` event after the relay subscription is active. The client waits for this event (up to 5s) before POSTing the message. If the POST fires before `stream_ready` arrives, early response chunks are buffered server-side (pending buffer in SubscriptionRegistry) and drained when the subscription registers.
- **`GET /api/sessions/:id/messages` may return 0 messages** for Relay sessions — this is a known limitation (session ID duality between Agent-ID and SDK-Session-ID). Use JSONL on disk as the source of truth for comparison.
- **To find the JSONL**, use `find ~/.claude/projects -name "*.jsonl" -mmin -2 -type f` (by recent modification time) rather than searching by URL session ID.
