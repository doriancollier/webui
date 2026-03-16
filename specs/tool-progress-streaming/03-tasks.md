# Tool Progress Streaming — Task Breakdown

**Spec:** `specs/tool-progress-streaming/02-specification.md`
**Generated:** 2026-03-16
**Mode:** Full
**Tasks:** 4

## Dependency Graph

```
1.1 Foundation (schemas)
 ├── 2.1 Server (mapper)         ──┐
 └── 3.1 Client Core (handler)  ──┤ (2.1 and 3.1 can run in parallel)
                                   │
     4.1 Client UI (ToolCallCard) ─┘ (depends on 1.1 + 3.1)
```

## Phase 1: Foundation

### Task 1.1 — Add tool_progress schemas and progressOutput field to shared package
**Size:** Small | **Priority:** High | **Dependencies:** None

Add `tool_progress` to `StreamEventTypeSchema` enum, create `ToolProgressEventSchema`, add it to the `StreamEventSchema` union, add `progressOutput` field to `ToolCallPartSchema` and `HistoryToolCallSchema`, and re-export `ToolProgressEvent` from `types.ts`.

**Files:**
- `packages/shared/src/schemas.ts` — 5 changes (enum, new schema, union, ToolCallPart, HistoryToolCall)
- `packages/shared/src/types.ts` — Add `ToolProgressEvent` to re-exports

## Phase 2: Server

### Task 2.1 — Add tool_progress branch to sdk-event-mapper with test
**Size:** Small | **Priority:** High | **Dependencies:** 1.1 | **Parallel with:** 3.1

Add `tool_progress` message handler to `sdk-event-mapper.ts` that maps `{ type: 'tool_progress', tool_use_id, content }` to `{ type: 'tool_progress', data: { toolCallId, content } }`. Add test to `sdk-event-mapper.test.ts`.

**Files:**
- `apps/server/src/services/runtimes/claude-code/sdk-event-mapper.ts` — New handler block
- `apps/server/src/services/core/__tests__/sdk-event-mapper.test.ts` — New describe block

## Phase 3: Client Core

### Task 3.1 — Add tool_progress handler to client stream-event-handler and chat-types
**Size:** Medium | **Priority:** High | **Dependencies:** 1.1 | **Parallel with:** 2.1

Add `progressOutput?: string` to `ToolCallState`, add `tool_progress` switch case to accumulate progress content, clear `progressOutput` on `tool_result`, and include `progressOutput` in `deriveFromParts`.

**Files:**
- `apps/client/src/layers/features/chat/model/chat-types.ts` — Add field to interface
- `apps/client/src/layers/features/chat/model/stream-event-handler.ts` — 4 changes (import, new case, tool_result update, deriveFromParts)

## Phase 4: Client UI

### Task 4.1 — Add progress output rendering to ToolCallCard and AutoHideToolCall pass-through
**Size:** Medium | **Priority:** High | **Dependencies:** 1.1, 3.1

Add auto-expand behavior via `useEffect`, create `ProgressOutput` internal component with 5KB truncation and disclosure, render progress between input and result blocks, and pass `progressOutput` through `AutoHideToolCall`.

**Files:**
- `apps/client/src/layers/features/chat/ui/ToolCallCard.tsx` — useEffect, constant, ProgressOutput component, render logic
- `apps/client/src/layers/features/chat/ui/message/AssistantMessageContent.tsx` — Part type update, prop pass-through

## Summary

| Phase | Task | Size | Parallel |
|-------|------|------|----------|
| 1. Foundation | 1.1 Shared schemas | Small | — |
| 2. Server | 2.1 SDK event mapper | Small | With 3.1 |
| 3. Client Core | 3.1 Stream handler + types | Medium | With 2.1 |
| 4. Client UI | 4.1 ToolCallCard + pass-through | Medium | — |

**Critical path:** 1.1 → 3.1 → 4.1 (3 sequential steps)
**Parallel opportunity:** Tasks 2.1 and 3.1 can execute simultaneously after 1.1 completes.
