# Agent UI Control — Ideation

**Status:** Ideation
**Date:** 2026-03-24
**Origin:** Conversation exploring whether the DorkOS agent can control the client UI

---

## Problem Statement

Can a DorkOS agent control the host application's UI? For example: open/close the sidebar, navigate to a different page, switch sidebar tabs, or open panels like Pulse or Settings. If so, what's the right architecture?

## Key Finding: The Industry Pattern

Every major AI-powered app (Cursor, GitHub Copilot, Bolt.new, Lovable, CopilotKit) uses the same fundamental mechanism: **LLM tool calls intercepted by the host app**. The agent never touches the UI directly — it emits structured tool invocations, and the host executes the real action.

A critical nuance from Cursor: **UI navigation is almost never an explicit command — it's a side-effect of data operations.** When Cursor's agent calls `edit_file`, the IDE opens that file automatically. There is no `open_file_in_editor` tool.

## DorkOS Architecture Assessment

The current architecture is ~90% ready. The three pieces that would execute UI commands already exist:

| Layer               | Current state                                                                                                                                                                | What it provides                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **SSE streaming**   | 20+ event types dispatched in `stream-event-handler.ts`                                                                                                                      | Adding `ui_command` is one `case` branch                              |
| **Zustand store**   | `useAppStore` has setters for every panel: `setSidebarOpen`, `setPulseOpen`, `setRelayOpen`, `setMeshOpen`, `setSettingsOpen`, `setGlobalPaletteOpen`, `setSidebarActiveTab` | Accessible outside React via `useAppStore.getState()`                 |
| **TanStack Router** | Imperative navigation via `router.navigate()` with typed search params                                                                                                       | Can navigate to `/session?session=uuid`, `/agents?view=topology`, `/` |

**The missing piece:** A single new SSE event type (`ui_command`) and a ~30-line client-side handler.

## Two Architectural Approaches

### Approach A: Explicit UI tool

The agent gets a `control_ui` tool. It calls it like any other tool. The server emits a `ui_command` SSE event. The client executes.

- Pro: Agent has explicit, discoverable control over the UI
- Pro: Could use existing approval flow for confirmation
- Con: Agent needs to "think about" UI state, uses tokens on UI decisions

### Approach B: Implicit side-effects (Cursor pattern)

UI changes are automatic reactions to data operations. When the agent creates a session, the client navigates there. When the agent references Pulse schedules, the Pulse panel opens.

- Pro: Feels more natural — UI follows intent, not commands
- Pro: No extra tool calls or token usage
- Con: Less flexible, harder to cover all cases
- Con: Requires mapping between "agent intent" and "UI reaction"

### Approach C: Hybrid

Implicit side-effects for common cases (session creation → navigate, etc.) plus an explicit tool for direct UI control when needed.

## Proposed `UiCommand` Type

```typescript
type UiCommand =
  | { action: 'navigate'; to: string; search?: Record<string, string> }
  | { action: 'open_panel'; panel: 'sidebar' | 'pulse' | 'relay' | 'mesh' | 'settings' }
  | { action: 'close_panel'; panel: 'sidebar' | 'pulse' | 'relay' | 'mesh' | 'settings' }
  | { action: 'switch_sidebar_tab'; tab: 'sessions' | 'schedules' | 'connections' }
  | { action: 'open_command_palette' }
  | { action: 'scroll_to_message'; messageId: string };
```

## Confirmation Model

Industry practice varies:

| System            | File writes       | Terminal commands | UI navigation      |
| ----------------- | ----------------- | ----------------- | ------------------ |
| Cursor            | Auto (diff shown) | Requires approval | Auto (side-effect) |
| Copilot (VS Code) | Requires approval | Requires approval | Auto               |
| Bolt.new          | Auto (sandboxed)  | Auto (sandboxed)  | N/A                |
| CopilotKit        | Configurable      | Configurable      | Auto               |

**UI navigation is universally auto-executed without confirmation.** This makes sense — opening a sidebar is low-risk and reversible. DorkOS could follow this pattern.

## Emerging Standards

Three open protocols are formalizing agent-to-UI communication:

- **AG-UI** (CopilotKit, MIT) — Event-based SSE protocol with `STATE_DELTA` and `CUSTOM` event types. Adopted by LangGraph, CrewAI, Mastra, Google ADK.
- **A2UI** (Google, open source) — Declarative JSON component specs. Agents return component blueprints; the client renders using native components.
- **Vercel AI SDK `streamUI`** — LLM streams React Server Components based on intent.

## Open Questions

1. Should the agent have an explicit `control_ui` tool, or should UI changes be implicit side-effects of other actions, or both?
2. What's the right set of UI actions to expose? Start minimal (sidebar, navigation) or comprehensive?
3. Should the agent be able to read UI state (e.g., "is the sidebar open?") or only write it?
4. How does this interact with the Obsidian plugin's embedded mode (which bypasses the router)?
5. Does this warrant an ADR?

## Reference Material

- **Research:** [`research/20260323_ai_agent_host_ui_control_patterns.md`](../research/20260323_ai_agent_host_ui_control_patterns.md) — comprehensive survey of Cursor, Copilot, Bolt.new, Lovable, CopilotKit, AG-UI, A2UI, and Vercel AI SDK patterns
- **Architecture:** [`contributing/architecture.md`](../contributing/architecture.md) — hexagonal architecture, Transport interface
- **State management:** [`contributing/state-management.md`](../contributing/state-management.md) — Zustand vs TanStack Query patterns
- **Interactive tools:** [`contributing/interactive-tools.md`](../contributing/interactive-tools.md) — existing tool approval and AskUserQuestion flows

### Key Source Files

- `apps/client/src/layers/features/chat/model/stream-event-handler.ts` — SSE event dispatch (where `ui_command` would be added)
- `apps/client/src/layers/shared/model/app-store.ts` — Zustand store with all panel setters
- `apps/client/src/router.tsx` — TanStack Router with typed search params
- `apps/client/src/layers/features/chat/model/stream-tool-handlers.ts` — existing tool call handling
