---
slug: friendly-tool-name-display
number: 176
created: 2026-03-24
status: ideation
---

# Friendly Tool Name Display in ToolApproval

**Slug:** friendly-tool-name-display
**Author:** Claude Code
**Date:** 2026-03-24
**Branch:** preflight/friendly-tool-name-display

---

## 1) Intent & Assumptions

- **Task brief:** The ToolApproval component displays raw MCP tool names like `mcp__dorkos__binding_list_sessions`. These should be reformatted to user-friendly labels. The codebase already has this formatting in `getToolLabel()` / `parseMcpToolName()` / `getMcpServerBadge()` (used by ToolCallCard). The goal is to reuse that existing shared logic in ToolApproval — and audit for any other places showing raw tool names.
- **Assumptions:**
  - The existing `tool-labels.ts` in `shared/lib` is the canonical formatting utility
  - ToolCallCard already uses these formatters correctly — ToolApproval is the main gap
  - The MCP badge pattern (showing server origin like "DorkOS", "Slack") is valuable for approval security context
  - The decided/compact state also needs the friendly name
- **Out of scope:**
  - Unifying server-side `formatToolDescription` (relay package) with client-side `getToolLabel` — different use cases (prose vs compact labels)
  - Adding custom/override display names for specific tools
  - Changing the underlying MCP tool name protocol

## 2) Pre-reading Log

- `apps/client/src/layers/shared/lib/tool-labels.ts`: Core formatting utilities — `getToolLabel()` (contextual labels from tool name + input JSON), `parseMcpToolName()` (splits `mcp__server__tool` into components), `getMcpServerBadge()` (returns server label or null), `humanizeSnakeCase()` (private helper). Well-tested with 25+ test cases.
- `apps/client/src/layers/shared/lib/index.ts`: Barrel exports `getToolLabel`, `getMcpServerBadge`, `parseMcpToolName` — already available for any client code to import.
- `apps/client/src/layers/features/chat/ui/ToolApproval.tsx`: The component with the problem. Displays raw `toolName` at line 194 (decided state) and line 281 (pending state). Does not import or use any formatting.
- `apps/client/src/layers/features/chat/ui/ToolCallCard.tsx`: Already uses `getToolLabel()` (line 165) and `getMcpServerBadge()` (line 146) correctly. This is the pattern to follow.
- `apps/client/src/layers/shared/lib/__tests__/tool-labels.test.ts`: Comprehensive tests including MCP name humanization, server badge extraction, and edge cases.
- `packages/relay/src/lib/payload-utils.ts`: Server-side `formatToolDescription()` — produces prose like "wants to write to `/path`" for Slack/Telegram approval cards. Different format, different audience. Correctly kept separate.
- `contributing/interactive-tools.md`: Documents tool approval flow and ToolApproval component.

## 3) Codebase Map

**Primary Components/Modules:**

- `apps/client/src/layers/shared/lib/tool-labels.ts` — Formatting utilities (getToolLabel, parseMcpToolName, getMcpServerBadge)
- `apps/client/src/layers/features/chat/ui/ToolApproval.tsx` — Tool approval card (lines 194, 281 show raw names)
- `apps/client/src/layers/features/chat/ui/ToolCallCard.tsx` — Tool call display (already uses formatters correctly)

**Shared Dependencies:**

- `@/layers/shared/lib` barrel — already exports all three formatting functions
- `cn()` from shared lib — used for conditional styling (badge rendering)

**Data Flow:**

```
Server SSE → approval_required event → { toolCallId, toolName, input, timeoutMs }
  → ToolApproval receives toolName + input as props
  → Currently renders raw toolName
  → Should call getToolLabel(toolName, input) + getMcpServerBadge(toolName)
```

**Feature Flags/Config:** None.

**Potential Blast Radius:**

- Direct: 1 file (`ToolApproval.tsx`) — two render locations (pending state line 281, decided state line 194)
- Tests: `ToolApproval.test.tsx` — assertions that check for raw tool name text will need updating
- Indirect: None — this is purely additive formatting, no data model changes

## 5) Research

**Potential Solutions:**

**1. Import getToolLabel + getMcpServerBadge into ToolApproval (reuse existing)**

- Description: Import the two functions from `@/layers/shared/lib` and apply them in the same pattern as ToolCallCard — badge for MCP server, friendly label for tool name.
- Pros:
  - Zero new code — reuse existing, well-tested utilities
  - Consistent display between ToolCallCard and ToolApproval
  - Already follows FSD conventions (shared → features import)
- Cons:
  - None significant
- Complexity: Low
- Maintenance: Low

**2. Create a new `<ToolNameDisplay>` component in shared/ui**

- Description: Extract the "badge + label" rendering into a shared UI component used by both ToolCallCard and ToolApproval.
- Pros:
  - Single source of truth for tool name rendering
  - Could be reused in future surfaces (Pulse schedules, Mesh bindings)
- Cons:
  - Over-engineering for just two consumers
  - ToolCallCard and ToolApproval have different layout contexts (card header vs inline)
  - Premature abstraction — wait for a third consumer
- Complexity: Medium
- Maintenance: Medium

**Recommendation:** Approach 1 — direct import of existing formatters. The ToolCallCard pattern is simple (3 lines of code) and doesn't warrant a shared component yet. If a third consumer appears, extract at that point.

## 6) Decisions

| #   | Decision                          | Choice                            | Rationale                                                                                                                                                                                                                           |
| --- | --------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How to display friendly tool name | Friendly label + MCP server badge | Matches ToolCallCard pattern. Badge provides server origin context valuable for security approval decisions.                                                                                                                        |
| 2   | Unify client/server formatting    | Keep separate                     | Client uses compact labels ("List Sessions"), relay uses prose ("wants to use tool `list_sessions`"). Different audiences, different formats. The MCP name parsing is already shared within the client — that's the right boundary. |
