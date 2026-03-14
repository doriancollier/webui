# Implementation Summary: Relay Adapter Streaming Fixes & Enhancements

**Created:** 2026-03-14
**Last Updated:** 2026-03-14
**Spec:** specs/relay-adapter-streaming-fixes/02-specification.md

## Progress

**Status:** Complete
**Tasks Completed:** 8 / 8

## Tasks Completed

### Session 1 - 2026-03-14

1. **[P1] Fix CWD propagation in BindingRouter** — Enriched envelope payload with `cwd: binding.projectPath` before republishing to `relay.agent.*`
2. **[P1] Fix stream key collision** — Added emptiness guards to `resolveThreadTs`, separated `streamKeyTs` (uses `envelope.id` fallback) from `threadTs` (Slack API only), added `streamId` to `ActiveStream`
3. **[P1] Fix intermediate newline collapsing** — Added `.replace(/\n{2,}/g, '\n')` on intermediate `chat.update` calls; final flush preserves full paragraph formatting
4. **[P2] Telegram typing interval refresh** — Added `setInterval` at 4s in `handleTypingSignal`, `clearAllTypingIntervals()` cleanup in `_stop()`
5. **[P3] Streaming schema field** — Added `streaming: z.boolean().default(true)` to `SlackAdapterConfigSchema`
6. **[P3] Streaming manifest configField** — Added configField toggle to `SLACK_MANIFEST`
7. **[P3] Buffered mode logic** — When `streaming === false`, accumulates text silently, sends single `chat.postMessage` on `done`
8. **[P4] Slack typing indicator** — Added `typingIndicator` config, `addTypingReaction`/`removeTypingReaction` helpers using `:hourglass_flowing_sand:` emoji reaction

## Files Modified/Created

**Source files:**

- `apps/server/src/services/relay/binding-router.ts` — CWD propagation via payload enrichment
- `packages/relay/src/adapters/slack/outbound.ts` — Stream key collision fix, newline collapsing, buffered mode, typing reactions
- `packages/relay/src/adapters/slack/slack-adapter.ts` — Config threading, manifest configFields, `reactions:write` scope
- `packages/shared/src/relay-adapter-schemas.ts` — `streaming` and `typingIndicator` schema fields
- `packages/relay/src/adapters/telegram/outbound.ts` — Typing interval refresh with `setInterval`
- `packages/relay/src/adapters/telegram/telegram-adapter.ts` — `clearAllTypingIntervals()` in `_stop()`

**Test files:**

- `apps/server/src/services/relay/__tests__/binding-router.test.ts` — Updated for enriched payload assertion
- `packages/relay/src/adapters/slack/__tests__/outbound.test.ts` — Tests for stream key collision fix, newline collapsing, buffered mode, typing indicators (36 tests)
- `packages/relay/src/adapters/telegram/__tests__/outbound.test.ts` — Tests for typing interval refresh (7 tests)
- `packages/shared/src/__tests__/relay-adapter-schemas.test.ts` — Tests for new schema fields

## Known Issues

_(None)_

## Implementation Notes

### Session 1

- Stream key collision fix required separating two concerns: `streamKeyTs` (for Map key uniqueness, falls back to `envelope.id`) vs `threadTs` (for Slack API `thread_ts` and `reactions.add` `timestamp` — must be a real Slack timestamp or undefined)
- The `randomUUID()` import was added for `streamId` on `ActiveStream`, enabling future async race detection in `handleDone`
- Intermediate newline collapsing uses a regex replace only on `chat.update` (streaming intermediate) — the final `handleDone` flush preserves full `\n\n` paragraph formatting from `slackify-markdown`
