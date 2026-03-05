---
description: "Self-test the DorkOS chat UI in a live browser session — drives real interactions, monitors JSONL transcript, compares API vs UI, researches issues, and creates a spec for improvements"
argument-hint: "[url]"
allowed-tools: Read, Write, Bash, Grep, Glob, Task, TaskOutput, AskUserQuestion, Skill, WebSearch, WebFetch, mcp__playwright__browser_snapshot, mcp__playwright__browser_navigate, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_resize, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_evaluate, mcp__playwright__browser_press_key, mcp__playwright__browser_wait_for, mcp__playwright__browser_fill_form, mcp__playwright__browser_select_option, mcp__playwright__browser_tabs, mcp__playwright__browser_handle_dialog
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

Verify the dev server is up:

```bash
DORKOS_PORT="${DORKOS_PORT:-6942}"
curl -sf "http://localhost:$DORKOS_PORT/api/health" | grep -q '"ok"' \
  || { echo "ERROR: DorkOS server not responding on port $DORKOS_PORT. Run 'pnpm dev' first."; exit 1; }
```

Fetch the current model list to know what's available:

```bash
curl -s "http://localhost:$DORKOS_PORT/api/models" | jq '.models[].id'
```

Navigate the browser to `TEST_URL`. Take a screenshot and accessibility snapshot. Capture any pre-existing console errors as a baseline (filter: `error`).

---

## Phase 2 — Create New Session

1. Locate the "New Session" button (Plus icon) in the SessionSidebar via the accessibility snapshot.
2. Click it and wait for the URL to update with a `?session=` query parameter.
3. Evaluate `window.location.search` in the browser to extract the session UUID. Store it as `SESSION_ID`.
4. Locate the JSONL file on disk:

```bash
SESSION_ID="<extracted UUID>"
JSONL_FILE=$(find ~/.claude/projects -name "${SESSION_ID}.jsonl" -type f 2>/dev/null)
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

## Phase 4 — Send Messages & Observe (8 rounds)

Send the following messages in sequence. For each message:

**Message script:**

| # | Message |
|---|---------|
| 1 | `Write a JavaScript bubble sort function with comments` |
| 2 | `Add TypeScript types to the function` |
| 3 | `Write a minimal HTML page with a <h1>Hello World</h1> heading` |
| 4 | `Use the Task tool to launch a background agent that counts the number of files in /tmp and reports back` |
| 5 | `Use the Bash tool in the background to watch /tmp for 5 seconds and report any changes` |
| 6 | `Use TodoWrite to create a task list with 3 tasks for our current conversation` |
| 7 | `Mark the first task as completed` |
| 8 | `What is 2+2?` |

**Per-message observation loop (repeat for each message):**

**a. Send the message:**
Click the chat input, type the message text, and press `Meta+Enter` (Cmd+Enter) to submit.

**b. Wait for streaming to complete:**
Watch for the Stop button to disappear from the DOM. Use `mcp__playwright__browser_wait_for` with `textGone` on the stop button label. Use a 30-second time-based fallback if the indicator cannot be detected. For background agent messages (4, 5), allow up to 60 seconds and poll every 3 seconds.

**c. Take a screenshot** of the full rendered exchange.

**d. Collect console messages** at `warning` level. Note any new warnings since the last check.

**e. Collect network requests.** Note status codes for `/api/sessions/:id/messages` POST calls.

**f. Extract visible messages from the DOM:**
```js
// Use mcp__playwright__browser_evaluate
() => [...document.querySelectorAll('[data-message-role]')]
  .map(el => ({ role: el.dataset.messageRole, text: el.textContent.slice(0, 120) }))
```
First inspect the actual DOM via snapshot to confirm the correct selectors are used.

**g. Compare against the API:**
```bash
curl -s "http://localhost:$DORKOS_PORT/api/sessions/$SESSION_ID/messages" \
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

**i. For background agent messages (4 and 5):**
After sending, poll every 3 seconds until the background task token appears resolved. Check:
- Is a "completed" badge shown on the tool call card in the DOM?
- Does a `tool_result` line appear for the corresponding `tool_use` ID in the JSONL?

Compare timing: when does JSONL update vs when does the UI update?

**j. For task list messages (6 and 7):**
After sending, check whether `TaskListPanel` is visible in the DOM. Compare its rendered tasks against:
- `GET /api/sessions/:id/tasks` response (if this endpoint exists)
- `task_update` SSE events captured in the network log
- `TaskCreate`/`TaskUpdate` tool_use blocks in the JSONL

**k. Record any discrepancy or anomaly** — data mismatch, console error, broken element, missing state update, unexpected blank area, scroll regression, etc.

---

## Phase 5 — Final State Capture

After all 8 rounds:

1. Full-page screenshot.
2. Console messages at `debug` level (comprehensive log).
3. Full network request log.
4. Full DOM snapshot of the message list.
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
curl -s "http://localhost:$DORKOS_PORT/api/sessions/$SESSION_ID" | jq '{model, permissionMode, title}'
```

---

## Phase 5b — Reload from History (Critical Regression Check)

This phase verifies that message history renders correctly when loaded from disk — a different code path (`GET /api/sessions/:id/messages` → `transcript-parser.ts` → `MessageList` props) that often hides bugs invisible during live streaming.

**Method A: Hard page refresh**

Navigate to the same URL with the `?session=` param preserved (e.g., `http://localhost:4241/?dir=...&session=SESSION_ID`). Wait for messages to finish loading (use `mcp__playwright__browser_wait_for` with text from the first response). Take a screenshot and accessibility snapshot.

**Method B: Navigate away then back**

1. Click a different session in the sidebar (or click the DorkOS logo to go home).
2. Wait for that session to load.
3. Click the test session back in the sidebar.
4. Wait for messages to re-render.
5. Take a screenshot and accessibility snapshot.

**Verify after each reload:**

| Check | Expected |
|-------|----------|
| Message count | Same as during live session (DOM count == API count == JSONL count) |
| Code blocks | Properly rendered (not raw markdown) |
| Tool call cards | All tool calls visible and collapsible |
| Background agent results | Result shown, not stuck as "pending" |
| Task list | Tasks visible with correct status |
| Tool call order | Same order as during live session |
| Model/permission display | Correct values in status bar |
| Scroll position | Scrolled to bottom (latest message) — check via `window.scrollY` |

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
- Session ID: [UUID]
- Model: [model used]
- Permission mode: [mode used]
- Messages sent: 8

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

- **JSONL location:** `~/.claude/projects/{slug}/{sessionId}.jsonl` — use `find` by session ID since computing the slug is non-trivial.
- **Session ID:** `?session=` URL param, managed by `useSessionId()` hook via nuqs.
- **Model selector:** `ModelItem` in `StatusLine` — opens a `ResponsiveDropdownMenu`.
- **Permission mode selector:** `PermissionModeItem` in `StatusLine` — 4 options available.
- **New session button:** Plus icon in `SessionSidebar`.
- **API port:** `DORKOS_PORT` env var — default in this repo is 6942.
- **Streaming complete signal:** Stop button present during streaming, gone when done.
- **SSE event types to watch:** `text_delta`, `tool_call_start`, `tool_call_end`, `tool_result`, `task_update`, `done`.
- **Background task polling:** For `Task` tool with `run_in_background: true`, the stream may stay alive until the background agent completes — poll at 3s intervals and check both DOM and JSONL.
