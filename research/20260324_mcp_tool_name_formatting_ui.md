---
title: 'MCP Tool Name Formatting — UI Patterns and Shared Utility Design'
date: 2026-03-24
type: implementation
status: active
tags: [mcp, tool-names, formatting, shared-lib, fsd, ux, tool-labels]
searches_performed: 4
sources_count: 8
---

# MCP Tool Name Formatting — UI Patterns and Shared Utility Design

## Research Summary

The codebase already contains a production-quality shared formatting utility in `apps/client/src/layers/shared/lib/tool-labels.ts`. It exports `parseMcpToolName`, `getToolLabel`, and `getMcpServerBadge` — a three-function API that handles all cases: MCP-prefixed names, snake_case humanization, server badge extraction, and context-rich labels from tool input arguments. The utility is fully tested (31 test cases) and already consumed by `ToolCallCard`. The primary gap is that `ToolApproval.tsx` renders the raw `toolName` in two places without passing it through this shared formatter.

---

## Key Findings

### 1. The Shared Utility Already Exists and Is Well-Designed

`shared/lib/tool-labels.ts` provides three pure functions:

- **`parseMcpToolName(toolName)`** — Parses `mcp__<server>__<tool_name>` into `{ server, serverLabel, tool, toolLabel }`. Returns `null` for non-MCP names. Server labels have a human-readable override table (`dorkos → "DorkOS"`, `filesystem → "Files"`, `playwright → "Browser"`, etc.).
- **`getMcpServerBadge(toolName)`** — Returns the server label for non-DorkOS MCP tools (for badge rendering), or `null` for DorkOS tools and native tools.
- **`getToolLabel(toolName, input)`** — Returns a context-rich short label: for known built-in tools (Bash, Read, Write, Edit, Glob, Grep, Task, etc.) it extracts meaningful detail from the JSON input; for MCP tools it falls back to the humanized tool label from `parseMcpToolName`; for unknown tools it returns the raw name.

The utility is exported through the `shared/lib` barrel at `@/layers/shared/lib` and is importable from any FSD layer above `shared`.

### 2. Architectural Placement Is Correct

`shared/lib` is the right FSD home for a pure formatting utility. Per the FSD rules:

- `shared/lib/` contains pure utilities and helpers
- `shared/model/` contains hooks and stores
- A tool name formatter has no React dependency and no server state — it is purely a string transformation, which makes `shared/lib` the canonical location

This allows any FSD layer (`entities`, `features`, `widgets`) to import it without violating the unidirectional dependency rule.

### 3. Current Consumers

| File                                    | Functions used                      |
| --------------------------------------- | ----------------------------------- |
| `features/chat/ui/ToolCallCard.tsx`     | `getToolLabel`, `getMcpServerBadge` |
| (indirectly) all chat message rendering | via ToolCallCard                    |

### 4. The Gap: ToolApproval Shows Raw Tool Names

`features/chat/ui/ToolApproval.tsx` renders `toolName` without humanization in two places:

- **Line 194** (decided/post-approval state): `<span className="text-3xs font-mono">{toolName}</span>` — the compact result row after a decision is made
- **Line 281** (active approval state): `<div className="mb-2 font-mono text-xs">{toolName}</div>` — the primary tool name display before the user approves or denies

Both show the raw name like `mcp__dorkos__binding_list_sessions`, which is the exact anti-pattern the task brief identifies. The shared formatters are not yet imported here.

### 5. UI Pattern Research: How Other AI/Dev Tools Handle This

**Claude's own web UI**: Shows tool names as-is in the developer console but provides human-readable descriptions in tool confirmation dialogs. The MCP specification (2025) explicitly recommends that hosts "present confirmation prompts" that make clear which tool is being invoked with human-readable context.

**VS Code MCP integration**: The [VS Code MCP developer guide](https://code.visualstudio.com/api/extension-guides/ai/mcp) shows tool descriptions displayed alongside tool names in the tools picker and confirmation dialogs, suggesting that name + description together provide context rather than formatting the name alone.

**Best practice from the MCP spec**: "Applications SHOULD provide UI that makes clear which tools are being exposed to the AI model, insert clear visual indicators when tools are invoked, and present confirmation prompts." This implies human-readable formatting in approval UI is considered a should-requirement.

**Server badge pattern**: Showing the MCP server as a visual badge (e.g., a `DorkOS` pill beside `Binding List Sessions`) is consistent with how VS Code shows the server origin in its tools picker. DorkOS's `getMcpServerBadge` implements exactly this pattern for `ToolCallCard`.

---

## Potential Solutions

### Option A: Apply existing formatters to ToolApproval (Recommended)

Import `getToolLabel` and `getMcpServerBadge` from `@/layers/shared/lib` into `ToolApproval.tsx` and replace the two raw `{toolName}` renders.

**Pros:**

- Zero new code — reuses the fully-tested existing utility
- Consistent display between the approval card and the post-approval ToolCallCard
- Follows the DRY principle the codebase enforces
- No FSD violation (features can import from shared)

**Cons:**

- None of significance

**Implementation sketch for ToolApproval.tsx:**

```tsx
// Add to existing imports from @/layers/shared/lib:
import { ToolArgumentsDisplay, cn, getToolLabel, getMcpServerBadge } from '@/layers/shared/lib';

// In the decided (post-approval) CompactResultRow, replace:
<span className="text-3xs font-mono">{toolName}</span>
// with:
<span className="text-3xs font-mono">{getToolLabel(toolName, input)}</span>

// In the active approval card, replace:
<div className="mb-2 font-mono text-xs">{toolName}</div>
// with:
<div className="mb-2 flex items-center gap-1.5">
  {getMcpServerBadge(toolName) && (
    <span className="bg-muted text-muted-foreground text-3xs rounded px-1 py-0.5 font-medium">
      {getMcpServerBadge(toolName)}
    </span>
  )}
  <span className="font-mono text-xs">{getToolLabel(toolName, input)}</span>
</div>
```

Note: In the decided state, `getToolLabel(toolName, input)` is preferred over `parseMcpToolName` directly because it also handles non-MCP tool names gracefully (Bash, Read, etc.) through the known-tool switch table.

### Option B: Add a `formatToolName` utility (not recommended)

Create a simpler `formatToolName(toolName: string): string` that only does name formatting without the context-aware label enrichment.

**Pros:**

- Slightly simpler API for callers that only need the name, not context from input

**Cons:**

- `getToolLabel(toolName, input)` already degrades gracefully to name-only formatting when input is `'{}'` or `''` (see test: "humanizes MCP tool name when input is empty string")
- Adding a second formatter creates divergence risk — two utilities that do overlapping things
- The existing tests already cover the fallback path

### Option C: Add a `formatToolName` display helper to `shared/ui` as a React component

Create a `<ToolNameDisplay toolName={string} />` component in `shared/ui`.

**Pros:**

- Encapsulates badge + label rendering in one component, eliminating repeated JSX patterns

**Cons:**

- Creates a UI dependency where a pure string function is sufficient
- `ToolCallCard` and `ToolApproval` have different visual contexts (card header vs approval dialog) — a shared component would need variants or `className` props, adding complexity
- The badge/label JSX pattern is only 4-6 lines — not worth abstracting into a component yet (doesn't meet the 3-strike rule)

---

## Recommendation

**Option A — apply existing formatters to `ToolApproval.tsx`.** No new utility is needed. The shared lib already solves the problem correctly. The only work is a targeted edit to `ToolApproval.tsx` to import and apply `getToolLabel` and `getMcpServerBadge` in the two raw-name display sites.

The design is already sound:

- **Pure functions in `shared/lib`** handle all formatting logic with no React coupling
- **Humanization** via `humanizeSnakeCase` converts `binding_list_sessions` → `Binding List Sessions`
- **MCP parsing** via `parseMcpToolName` strips the `mcp__dorkos__` prefix and yields the human label
- **Server badges** via `getMcpServerBadge` show origin context for third-party MCP servers (Slack, GitHub, etc.) while suppressing the badge for first-party DorkOS tools

If a new surface needs tool name display in the future (e.g., a command palette, notification toasts), it should import from the same barrel export — no changes to the utility itself are needed.

---

## Detailed Analysis

### humanizeSnakeCase — Edge Cases to Know

The existing `humanizeSnakeCase` function splits on `_` (single underscore). Double underscores (from the `mcp__` prefix) produce an empty word and a double space. The test confirms this is documented expected behavior:

```
parseMcpToolName('mcp__slack__channel__send')?.toolLabel === 'Channel  Send'
```

This only occurs for extra `__` separators inside the tool part of the name, not during normal `mcp__server__tool_name` parsing (where `parts.slice(2).join('__')` re-joins extra segments). For the DorkOS use case (`mcp__dorkos__binding_list_sessions`), `humanizeSnakeCase` on `binding_list_sessions` correctly produces `Binding List Sessions` with no double spaces.

### Where `getToolLabel` Falls Back

`getToolLabel(toolName, input)` call chain for an MCP tool with no input or invalid input:

1. JSON.parse fails → falls to the `catch` block → calls `parseMcpToolName` → returns `mcp.toolLabel` if parsed
2. If JSON parses but the tool isn't in the switch → falls to `default` → calls `parseMcpToolName` → returns `mcp.toolLabel` if parsed
3. If not an MCP name → returns raw `toolName`

This makes `getToolLabel` safe to call even when `input` is `''`, `undefined`, or arbitrary text.

### MCP Server Label Override Table

The `MCP_SERVER_LABELS` record is module-scope in `tool-labels.ts`. Adding new servers is a one-line edit:

```ts
const MCP_SERVER_LABELS: Record<string, string> = {
  dorkos: 'DorkOS',
  slack: 'Slack',
  telegram: 'Telegram',
  github: 'GitHub',
  filesystem: 'Files',
  playwright: 'Browser',
  context7: 'Context7',
  // add new servers here
};
```

No interface changes needed — the `humanizeSnakeCase` fallback handles unknown servers automatically.

---

## Research Gaps and Limitations

- No research was done on whether showing a server badge in the `ToolApproval` approval state (pre-decision) is the right UX choice — the decision was inferred from consistency with `ToolCallCard`. If the product direction is to hide server origin in approval contexts, only `getToolLabel` (not `getMcpServerBadge`) would be applied there.
- The existing test suite does not cover `getToolLabel` with DorkOS MCP tool names specifically (e.g., `mcp__dorkos__binding_list_sessions`). A new test case would strengthen confidence.

---

## Contradictions and Disputes

None. The codebase direction is consistent: the shared utility exists, is exported from the barrel, and is already used in the primary tool call display surface. Extending it to `ToolApproval` is unambiguously correct.

---

## Sources and Evidence

- Existing implementation: `/apps/client/src/layers/shared/lib/tool-labels.ts`
- Existing tests: `/apps/client/src/layers/shared/lib/__tests__/tool-labels.test.ts`
- Consumer: `/apps/client/src/layers/features/chat/ui/ToolCallCard.tsx`
- Gap site: `/apps/client/src/layers/features/chat/ui/ToolApproval.tsx` (lines 194, 281)
- MCP specification tool display guidance: [Tools — Model Context Protocol Spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- VS Code MCP tool display patterns: [MCP developer guide — VS Code Extension API](https://code.visualstudio.com/api/extension-guides/ai/mcp)
- MCP Apps interactive UI patterns: [MCP Apps — MCP Blog](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- Prior naming conventions research: `research/20260304_mcp_tool_naming_conventions.md`

---

## Search Methodology

- Searches performed: 4
- Most productive terms: "MCP tool name display UI patterns developer tools 2025", "Claude tool use approval UI display tool name formatting"
- Primary finding method: Direct codebase inspection (tool-labels.ts, ToolCallCard.tsx, ToolApproval.tsx) was more informative than web search for this task
