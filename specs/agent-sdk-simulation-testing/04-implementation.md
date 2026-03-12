# Implementation Summary: Agent SDK Simulation & Testing Infrastructure

**Created:** 2026-03-11
**Last Updated:** 2026-03-11
**Spec:** specs/agent-sdk-simulation-testing/02-specification.md

## Progress

**Status:** Complete
**Tasks Completed:** 18 / 18

## Tasks Completed

### Session 1 - 2026-03-11

- Task #1: Create sdk-scenarios.ts with wrapSdkQuery and named scenario builders
- Task #2: Create TestScenario enum in packages/test-utils
- Task #3: Create FakeAgentRuntime in packages/test-utils
- Task #4: Create collectSseEvents helper in packages/test-utils
- Task #5: Update packages/test-utils barrel to export new simulation utilities
- Task #6: Write unit tests for sdk-scenarios.ts
- Task #7: Write unit tests for FakeAgentRuntime
- Task #8: Migrate sessions.test.ts to use FakeAgentRuntime
- Task #9: Migrate sessions-interactive.test.ts to use FakeAgentRuntime
- Task #10: Migrate sessions-relay.test.ts to use FakeAgentRuntime
- Task #11: Migrate sessions-boundary.test.ts to use FakeAgentRuntime
- Task #12: Update claude-code-runtime.test.ts to use wrapSdkQuery and shared builders
- Task #13: Create sessions-streaming.test.ts with SSE integration tests
- Task #14: Create scenario-store.ts for TestModeRuntime
- Task #15: Create TestModeRuntime implementing AgentRuntime
- Task #16: Create test-control.ts router for scenario configuration
- Task #17: Add DORKOS_TEST_RUNTIME env var and wire TestModeRuntime into server
- Task #18: Update Playwright config and create initial browser tests

## Files Modified/Created

**Source files:**

- `apps/server/src/services/runtimes/claude-code/__tests__/sdk-scenarios.ts` - SDK scenario builders (wrapSdkQuery, sdkSimpleText, sdkToolCall, sdkTodoWrite, sdkError)
- `packages/test-utils/src/test-scenarios.ts` - TestScenario const enum shared across all tiers
- `packages/test-utils/src/fake-agent-runtime.ts` - FakeAgentRuntime implements AgentRuntime with vi.fn() spies
- `packages/test-utils/src/sse-test-helpers.ts` - collectSseEvents supertest helper
- `packages/test-utils/src/index.ts` - Updated barrel exports
- `apps/server/src/services/runtimes/test-mode/scenario-store.ts` - In-memory scenario store for browser tests
- `apps/server/src/services/runtimes/test-mode/test-mode-runtime.ts` - TestModeRuntime implements AgentRuntime (no vitest)
- `apps/server/src/routes/test-control.ts` - HTTP control API for scenario configuration
- `apps/server/src/env.ts` - Added DORKOS_TEST_RUNTIME env var
- `apps/server/src/index.ts` - Conditional runtime registration
- `apps/server/src/app.ts` - Conditional test control route mount

**Test files:**

- `apps/server/src/services/runtimes/claude-code/__tests__/sdk-scenarios.test.ts` - Unit tests for scenario builders
- `packages/test-utils/src/__tests__/fake-agent-runtime.test.ts` - Unit tests for FakeAgentRuntime
- `apps/server/src/routes/__tests__/sessions.test.ts` - Migrated to FakeAgentRuntime
- `apps/server/src/routes/__tests__/sessions-interactive.test.ts` - Migrated to FakeAgentRuntime
- `apps/server/src/routes/__tests__/sessions-relay.test.ts` - Migrated to FakeAgentRuntime
- `apps/server/src/routes/__tests__/sessions-relay-correlation.test.ts` - Migrated to FakeAgentRuntime
- `apps/server/src/routes/__tests__/sessions-boundary.test.ts` - Migrated to FakeAgentRuntime
- `apps/server/src/services/runtimes/claude-code/__tests__/claude-code-runtime.test.ts` - Updated to use shared builders
- `apps/server/src/routes/__tests__/sessions-streaming.test.ts` - New SSE integration tests
- `apps/e2e/tests/chat-mock.spec.ts` - Playwright browser tests
- `apps/e2e/playwright.config.ts` - Added chromium-mock project

## Known Issues

- StreamEvent data shapes in scenario-store.ts required `as StreamEvent` casts because the discriminated union types are strict (e.g., `session_status` requires `sessionId`, `done` requires `sessionId`)
- `vi.hoisted()` cannot access ESM imports; solved by using module-scope `let` + `beforeEach` initialization pattern instead
- SDKMessage types required `claude_code_version` field and `subtype: 'error_during_execution'` (not `'error'`) for error results

## Implementation Notes

### Session 1

All 18 tasks completed in a single session. Key technical decisions:

1. **`vi.hoisted()` ESM limitation**: The spec recommended `vi.hoisted(() => new FakeAgentRuntime())` but ESM imports aren't available in hoisted factories. Used `let fakeRuntime: FakeAgentRuntime` at module scope + `beforeEach` initialization instead. The `vi.mock` factory captures the variable reference (not the value).

2. **StreamEvent import path**: `StreamEvent` is exported from `@dorkos/shared/types`, not `@dorkos/shared/agent-runtime`. All new files use the correct import path.

3. **SSE wire format**: DorkOS SSE uses `event: {type}\ndata: {json}\n\n` format (separate event/data lines). The `collectSseEvents` helper was updated to handle this format correctly.

4. **`sessions-relay-correlation.test.ts`**: Also migrated to FakeAgentRuntime (spec mentioned checking this file; it used the same `mockRuntime` pattern).

5. **Test results**: 80 test files, 1,310 tests all passing. Build succeeds.
