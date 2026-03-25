---
number: 193
title: Generic Background Task System Replacing Subagent-Specific Tracking
status: accepted
created: 2026-03-24
spec: background-task-visibility
superseded-by: null
---

# 193. Generic Background Task System Replacing Subagent-Specific Tracking

## Status

Accepted

## Context

DorkOS tracked background agent work using a `SubagentPart` message part type and corresponding `subagent_started`, `subagent_progress`, `subagent_done` SSE events. This system was purpose-built for a single use case: background subagent tasks spawned by the Claude Code SDK.

The SDK now also emits events for background bash commands (`BashCommand` tool calls executed in parallel). The UI needed to surface both types of background work — agent tasks and bash commands — with consistent status indicators, progress tracking, and the ability to stop running tasks.

Two approaches were considered:

1. **Additive**: Keep `SubagentPart` and add a parallel `BashTaskPart` type with its own SSE events. Minimal disruption, but creates two parallel tracking systems with duplicated UI logic.
2. **Generic refactor**: Replace `SubagentPart` with a `BackgroundTask` type that uses a `taskType` discriminator (`'agent' | 'bash'`) to distinguish task kinds. Single data pipeline, single UI surface.

## Decision

Replace the subagent-specific system with a generic `BackgroundTask` abstraction:

- **Types**: Replace `SubagentPart` with `BackgroundTaskPart` containing a `taskType` discriminator field. Replace `SubagentStatus` with `BackgroundTaskStatus`.
- **SSE events**: Replace `subagent_started`, `subagent_progress`, `subagent_done` with `background_task_started`, `background_task_progress`, `background_task_done`.
- **Runtime interface**: Add `stopTask(sessionId, taskId)` to `AgentRuntime` and `Transport`, enabling runtime-agnostic task cancellation.
- **Migration strategy**: Big-bang migration with no deprecation period, since all consumers (client, server, shared types) are internal to the monorepo.
- **JSONL backward compatibility**: The transcript parser maps legacy `subagent` JSONL blocks to the new `BackgroundTaskPart` shape, preserving readability of historical session transcripts.

## Consequences

### Positive

- **Extensible without schema changes**: Future task types (e.g., MCP tool execution, long-running file operations) require only a new `taskType` value — no new part types, SSE events, or UI components.
- **Single data pipeline**: One set of SSE events, one reducer, one UI component handles all background work. Reduces cognitive load for both users and developers.
- **Runtime-agnostic stop**: `stopTask` is defined on the `AgentRuntime` interface. Future runtimes implement their own cancellation mechanism without client changes.
- **Aligned with project values**: Per the codebase quality standard, we had the courage to refactor even when the additive approach would have been easier. Simplicity is an active pursuit.

### Negative

- **JSONL backward compatibility code**: The transcript parser includes a mapping layer to read old `subagent` blocks as `BackgroundTaskPart`. This code must remain as long as historical transcripts exist.
- **All existing subagent tests required migration**: Every test referencing `SubagentPart`, `subagent_started`, etc. needed updating. This was a one-time cost absorbed during the migration.
- **Breaking change to internal types**: Any out-of-tree code (e.g., custom scripts) referencing the old type names would break. Acceptable because all consumers are within the monorepo.
