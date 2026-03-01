# Implementation Summary: Server & Client Code Review Fixes

**Created:** 2026-02-28
**Last Updated:** 2026-02-28
**Spec:** specs/server-client-code-review-fixes/02-specification.md

## Progress

**Status:** Complete
**Tasks Completed:** 11 / 11

## Tasks Completed

### Session 1 - 2026-02-28

1. **S1: Double lock release race condition** - Added `releaseLockOnce()` idempotent guard with boolean flag in `sessions.ts`
2. **S2: inFlight promise permanently poisoned** - Moved `inFlight.delete(key)` into `finally` block in `binding-router.ts`
3. **S3: CORS wildcard restriction** - Added `buildCorsOrigin()` helper, `DORKOS_CORS_ORIGIN` env var, updated `turbo.json` `globalPassThroughEnv`
4. **S4: Unvalidated relay subscription** - Added `ALLOWED_PREFIXES` whitelist and `validateSubscriptionPattern()` in `relay.ts`, default changed from `>` to `relay.human.console.>`
5. **C1+C2: EventSource reconnection cascade** - Ref-stabilized callbacks in `useChatSession` via `useRef`, removed `options` from `useMemo` deps, updated `StreamEventDeps` interface
6. **C3: FSD layer violation** - Moved `FileEntry` type to `shared/lib/file-types.ts`, updated imports in `ChatPanel.tsx`, `use-file-autocomplete.ts`, `files/index.ts`
7. **C4: Mutable ref during streaming** - Replaced in-place mutation with immutable array/object updates in `text_delta` handler
8. **C5: Incorrect ARIA on LinkSafetyModal** - Replaced `role="button"` with `role="dialog"`, `aria-modal="true"`, `aria-label` on content div; added `aria-hidden="true"` to backdrop
9. **C6: Duplicated sessions query** - Replaced inline `useQuery` with `useSessions()` entity hook in `SessionSidebar.tsx`
10. **C7: Uncaught JSON.parse** - Wrapped both `JSON.parse` calls in try/catch with `console.warn` in `use-relay-event-stream.ts`
11. **Validation** - Typecheck (14/14), tests (11/11), lint (no new errors) all pass

## Files Modified/Created

**Source files:**

- `apps/server/src/routes/sessions.ts` - S1: releaseLockOnce guard
- `apps/server/src/services/relay/binding-router.ts` - S2: finally block for inFlight cleanup
- `apps/server/src/app.ts` - S3: buildCorsOrigin() + tunnel CORS middleware
- `apps/server/src/routes/relay.ts` - S4: subscription pattern validation
- `apps/client/src/layers/features/chat/model/use-chat-session.ts` - C1+C2: ref-stabilized callbacks
- `apps/client/src/layers/features/chat/model/stream-event-handler.ts` - C1+C2: StreamEventDeps update, C4: immutable text_delta
- `apps/client/src/layers/features/chat/ui/ChatPanel.tsx` - C3: FileEntry import path
- `apps/client/src/layers/features/chat/model/use-file-autocomplete.ts` - C3: FileEntry import path
- `apps/client/src/layers/shared/lib/file-types.ts` - C3: new FileEntry type definition
- `apps/client/src/layers/shared/lib/index.ts` - C3: FileEntry re-export
- `apps/client/src/layers/features/files/index.ts` - C3: updated re-export
- `apps/client/src/layers/features/chat/ui/StreamingText.tsx` - C5: ARIA dialog pattern
- `apps/client/src/layers/features/session-list/ui/SessionSidebar.tsx` - C6: useSessions() hook
- `apps/client/src/layers/entities/relay/model/use-relay-event-stream.ts` - C7: JSON.parse try/catch
- `turbo.json` - S3: DORKOS_CORS_ORIGIN in globalPassThroughEnv

**Test files:**

_(No new test files — all existing tests pass)_

## Known Issues

_(None)_

## Implementation Notes

### Session 1

- 9 tasks executed in parallel (Batch 1), 2 tasks required manual implementation (agents picked up wrong spec context)
- S5 (skipNextReload race) was already fixed in prior commit `3046fb4` via write generation counter
- Tunnel URL CORS middleware is defensive (no-op when `app.locals.tunnelUrl` is unset); follow-up needed to wire `tunnelManager.status.url` to `app.locals.tunnelUrl`
