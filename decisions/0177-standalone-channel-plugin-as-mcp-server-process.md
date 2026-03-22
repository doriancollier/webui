---
number: 177
title: Standalone Channel Plugin as MCP Server Process
status: proposed
created: 2026-03-22
spec: a2a-channels-interoperability
superseded-by: null
---

# 177. Standalone Channel Plugin as MCP Server Process

## Status

Proposed

## Context

Claude Code Channels (research preview, March 2026) can push external events into active session context via MCP notifications. DorkOS needs to bridge Relay messages into Claude Code sessions for in-context delivery — when an external agent sends a message via A2A or another agent publishes to Relay, the target Claude Code session should receive it without polling. Two approaches were evaluated: (1) embedding the Channel bridge in the DorkOS server process, or (2) building a standalone MCP server process that Claude Code spawns as a subprocess via `.mcp.json` configuration.

## Decision

Build the Channel plugin as a standalone process at `packages/channel-plugin/`. Claude Code spawns it as a subprocess via `.mcp.json` configuration using stdio transport. The plugin subscribes to Relay events via SSE from the DorkOS server and emits MCP notifications into the Claude Code session. This follows Claude Code's expected plugin architecture where MCP servers run as independent subprocesses.

## Consequences

### Positive

- **Process isolation** — A crash in the Channel plugin does not affect the DorkOS server or other subsystems
- **Independent updates** — The plugin can be versioned and updated separately from the main DorkOS server
- **Follows Claude Code's plugin architecture** — Uses the expected stdio-based MCP subprocess model, ensuring forward compatibility
- **Graceful degradation** — When the plugin is offline, Relay's persistent mailbox stores messages for later delivery; nothing is lost
- **Simple lifecycle** — Claude Code manages the plugin process lifecycle (start, restart, cleanup)

### Negative

- **Requires SSE endpoint** — The DorkOS server must expose an SSE subscription endpoint for the plugin to consume Relay events
- **Bug #36800 (duplicate spawn)** — Claude Code may spawn duplicate plugin processes; requires defensive coding with idempotent subscriptions or process-level dedup
- **One-way delivery only** — Until Bug #37072 is resolved, the plugin can push events into sessions but cannot receive responses back through the Channel
- **Additional process overhead** — Each active Claude Code session with DorkOS integration runs an extra subprocess
- **Configuration complexity** — Users must configure `.mcp.json` correctly to enable the Channel integration
