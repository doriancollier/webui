---
title: 'Claude Code Agent Identity Model — IDs, Subagent Lifecycle, and Agent-to-Agent Communication'
date: 2026-03-29
type: external-best-practices
status: active
tags: [claude-code, agent-sdk, subagents, agent-teams, session-id, agent-id, hooks, identity]
searches_performed: 6
sources_count: 5
---

# Claude Code Agent Identity Model

## Research Summary

Claude Code uses a two-level identity model: **session IDs** (UUID format) for the main conversation
and **agent IDs** (opaque short strings, dynamically generated at spawn time) for subagents. Agent
IDs are not predictable — they are assigned at spawn time and exposed to hooks and the resumption
system. Agent-to-agent communication in Agent Teams uses a mailbox system addressed by teammate
name (not by ID), while subagents are resumed via the `SendMessage` tool using the agent ID Claude
receives upon subagent completion.

---

## Key Findings

### 1. Session IDs Are UUIDs, Passed Explicitly or Auto-Generated

Sessions use UUID-format IDs (e.g., `00893aaf-19fa-41d2-8238-13269b9b3ca0`). The CLI exposes
`--session-id` which lets callers **supply** a specific UUID, confirming the format is UUID v4.
When not supplied, Claude Code auto-generates one. The session ID appears in:

- The transcript file path: `~/.claude/projects/{slug}/{session-id}.jsonl`
- Every hook's `session_id` field in the JSON input sent via stdin

Sessions can be named with `--name` / `-n`. The name is a human-readable alias for the session and
does NOT replace the underlying UUID. `claude --resume <name>` resolves the name to the UUID
internally.

### 2. Subagent IDs Are Short Opaque Strings, Dynamically Assigned

Subagents get an `agent_id` that is:

- A short alphanumeric string (e.g., `"def456"`, not a UUID)
- Assigned at spawn time — not predictable in advance
- Scoped to the session — visible in the subagent's transcript path and hook events
- Used to name the subagent transcript: `~/.claude/projects/{slug}/{session-id}/subagents/agent-{agent_id}.jsonl`

There is **no mechanism to pre-assign or predict** a subagent's ID. The ID is only available after
the subagent has been spawned (returned to the orchestrating agent as part of the Agent tool
result).

### 3. Agent Type Is the Human-Readable Identity

The `agent_type` field carries the subagent's **name** from its frontmatter `name` field
(e.g., `"Explore"`, `"Bash"`, `"code-reviewer"`). This is the primary identifier humans and hook
scripts use. Hook matchers target `agent_type` strings, not `agent_id` values. The `agent_type`
is stable and predictable — it comes from the subagent definition file.

### 4. Hook Input Exposes Both IDs on Every Event

Every hook receives a JSON payload via stdin with this structure:

```json
{
  "session_id": "00893aaf-19fa-41d2-8238-13269b9b3ca0",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "agent_id": "def456", // only present when inside a subagent
  "agent_type": "Explore" // only present when --agent flag or inside a subagent
}
```

`agent_id` is **absent** in the main session — its presence is the canonical way to detect whether
a hook is running in subagent context. The `SubagentStop` event adds two additional fields:

```json
{
  "agent_id": "def456",
  "agent_type": "Explore",
  "agent_transcript_path": "~/.claude/projects/.../abc123/subagents/agent-def456.jsonl",
  "last_assistant_message": "Analysis complete...",
  "stop_hook_active": false
}
```

### 5. Subagent Resumption Uses Agent ID via SendMessage Tool

When a subagent completes, Claude receives its `agent_id` as part of the Agent tool result. To
resume it, Claude uses the `SendMessage` tool with that `agent_id` as the `to` field. A stopped
subagent that receives a `SendMessage` auto-resumes in the background.

The user can request agent IDs explicitly ("ask Claude for the agent ID") or find them by
inspecting transcript paths at `~/.claude/projects/{slug}/{session-id}/subagents/`.

### 6. Agent Teams Use Named Mailboxes, Not IDs

In agent teams (experimental), teammates communicate via a **mailbox system** addressed by teammate
**name** (the human name the lead assigned at spawn, e.g., "security-reviewer"), not by agent ID.
Operations are:

- `message`: send to one specific teammate by name
- `broadcast`: send to all teammates simultaneously

The team config at `~/.claude/teams/{team-name}/config.json` contains a `members` array with each
teammate's **name**, **agent ID**, and **agent type**. Teammates can read this file to discover each
other.

### 7. No Stable Cross-Session Agent Identity

There is no persistent "agent identity" that survives across sessions. Every subagent invocation
gets a new `agent_id`. Persistent memory (`memory: user|project|local` frontmatter field) is the
mechanism for persisting learned knowledge — it stores to a named directory based on the
subagent's **type name**, not its ID. The memory directory path is:

- User scope: `~/.claude/agent-memory/{agent-name}/`
- Project scope: `.claude/agent-memory/{agent-name}/`

This means continuity of knowledge is by **agent type name** (stable, from the definition file),
not by the ephemeral agent ID.

---

## Detailed Analysis

### ID Hierarchy

```
Session (UUID, e.g. 00893aaf-19fa-41d2-8238-13269b9b3ca0)
│
├── Main conversation transcript: ~/.claude/projects/{slug}/{session-id}.jsonl
│
└── Subagents/
    ├── agent-def456 (agent_type: "Explore")
    │   └── transcript: .../{session-id}/subagents/agent-def456.jsonl
    ├── agent-abc789 (agent_type: "code-reviewer")
    │   └── transcript: .../{session-id}/subagents/agent-abc789.jsonl
    └── ...
```

### Subagent Identity Lifecycle

1. Subagent is requested (via Agent tool, natural language, @-mention, or `--agent` flag)
2. Claude Code assigns a new `agent_id` (short alphanumeric string) at spawn time
3. Subagent context is initialized — it does NOT inherit the parent's conversation history
4. Subagent transcript is created at `.../{session-id}/subagents/agent-{agent_id}.jsonl`
5. Hooks fire with `agent_id` + `agent_type` in their JSON input
6. Subagent runs, completes, returns result to parent
7. Parent receives `agent_id` in the Agent tool result (enabling future `SendMessage` resumption)
8. Transcript persists for up to `cleanupPeriodDays` (default: 30 days)

### CLAUDE_CODE_SUBAGENT_MODEL Environment Variable

The environment variable `CLAUDE_CODE_SUBAGENT_MODEL` can be set to override the model used for
subagents globally. This is a session-scoped override that sits at the highest priority in the
model resolution chain (above per-invocation model, subagent frontmatter, and main conversation
model). This env var is identity-adjacent: it's the recommended way to change all subagent
behavior without touching individual definitions.

### --session-id CLI Flag: Explicit UUID Injection

```bash
claude --session-id "550e8400-e29b-41d4-a716-446655440000"
```

This flag lets external orchestrators (like DorkOS) assign a deterministic session ID before the
session starts. The value must be a valid UUID. This is the primary integration point for
DorkOS's session tracking — sessions created this way will have their ID known in advance,
making it possible to correlate DorkOS session records with Claude Code transcript files.

### Agent Teams: team config.json Structure

```json
{
  "members": [
    {
      "name": "security-reviewer",
      "agent_id": "xyz123",
      "agent_type": "code-reviewer"
    }
  ]
}
```

The `name` is the teammate's assigned name within the team (set at spawn). `agent_type` is the
subagent definition name. `agent_id` is the runtime identifier. Team storage:

- Team config: `~/.claude/teams/{team-name}/config.json`
- Task list: `~/.claude/tasks/{team-name}/`

---

## Implications for DorkOS

### Session Tracking (Use --session-id)

DorkOS can inject a deterministic session ID via `--session-id <uuid>` when launching Claude Code
sessions. This lets DorkOS pre-create the session record in its DB and correlate it with the
JSONL transcript file without polling or guessing.

### Subagent Observability (Use Hooks)

The `SubagentStart` and `SubagentStop` hooks are the authoritative stream of subagent lifecycle
events. They fire in the **main session's hook context** (not the subagent's) and provide
`agent_id`, `agent_type`, and `agent_transcript_path`. DorkOS can use these to track which
subagents ran within a session.

Hook matchers for these events use `agent_type` (the subagent name) as the pattern:

```json
{
  "hooks": {
    "SubagentStart": [
      { "matcher": "Explore", "hooks": [{ "type": "command", "command": "./observe.sh" }] }
    ]
  }
}
```

### Agent Identity Is Ephemeral by Design

DorkOS cannot use `agent_id` as a persistent key across sessions. For cross-session continuity,
the correct key is the subagent's **type name** (from the definition's `name` frontmatter field),
combined with the optional `memory` directory which Claude Code itself manages.

### No Agent-to-Agent ID Exchange Needed in Subagent Mode

Subagents report results to the parent; they do not need to know each other's IDs. The parent
orchestrates all delegation. DorkOS's multi-agent coordination model (Relay, Mesh) maps to Agent
Teams (where agents do communicate peer-to-peer) rather than to subagents.

---

## Sources & Evidence

- Subagent IDs and transcript paths: [Claude Code Sub-agents docs](https://code.claude.com/docs/en/sub-agents) — "find IDs in the transcript files at `~/.claude/projects/{project}/{sessionId}/subagents/`"
- Hook input schema with `session_id`, `agent_id`, `agent_type`: [Claude Code Hooks docs](https://code.claude.com/docs/en/hooks)
- `--session-id` CLI flag requiring valid UUID: [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)
- Agent Teams mailbox architecture and team config structure: [Claude Code Agent Teams docs](https://code.claude.com/docs/en/agent-teams)
- `SubagentStop` event payload including `agent_transcript_path` and `last_assistant_message`: [Hooks docs](https://code.claude.com/docs/en/hooks)
- `CLAUDE_CODE_SUBAGENT_MODEL` env var for model override: [Sub-agents docs, model resolution section](https://code.claude.com/docs/en/sub-agents)

---

## Research Gaps & Limitations

- The exact algorithm for generating `agent_id` values is not documented (UUID variant vs. random
  short string). From examples, they appear to be short alphanumeric strings rather than full UUIDs.
- The `--session-id` flag documentation says "must be a valid UUID" but doesn't specify UUID version.
  UUID v4 is the conventional choice and consistent with the example transcript path format.
- Agent Teams are still experimental (disabled by default) and subject to change. The `config.json`
  structure could change before GA.
- No documentation on maximum agent_id string length or character set constraints.

---

## Contradictions & Disputes

None found. The session ID = UUID, subagent ID = short opaque string distinction is internally
consistent across the hooks docs, CLI reference, and sub-agents docs.

---

## Search Methodology

- Searches performed: 6 (WebFetch calls to official documentation)
- URLs fetched: `/en/overview`, `/en/sub-agents`, `/en/hooks` (×2), `/en/agent-teams`, `/en/cli-reference`
- Primary source: `code.claude.com/docs` (redirected from `docs.anthropic.com/en/docs/claude-code/*`)
- Most productive pages: `/en/sub-agents` (agent lifecycle, resumption), `/en/hooks` (ID fields in
  JSON payloads), `/en/cli-reference` (`--session-id` flag spec)
