# Implementation Summary: Adapter & Binding UX Overhaul

**Created:** 2026-03-11
**Last Updated:** 2026-03-12
**Spec:** specs/adapter-binding-ux-overhaul/02-specification.md

## Progress

**Status:** Complete
**Tasks Completed:** 15 / 15

## Tasks Completed

### Session 1 - 2026-03-11

- Task #1: [P1] Add PATCH /bindings/:id server route
- Task #2: [P1] Add label field to adapter config schema and server
- Task #3: [P1] Enable multi-instance Telegram adapters
- Task #4: [P1] Add ObservedChat schema and Transport method

### Session 2 - 2026-03-11

- Task #5: [P3] Update AdapterCard with label display and binding status
- Task #6: [P2] Implement observed chats server endpoint and client hook

## Files Modified/Created

**Source files:**

- `apps/server/src/routes/relay.ts` — PATCH /bindings/:id route, label extraction in POST /adapters, GET /adapters/:id/chats route
- `apps/server/src/services/relay/adapter-manager.ts` — label parameter in addAdapter(), getCatalog() label inclusion, updateAdapterLabel()
- `apps/server/src/services/relay/trace-store.ts` — getObservedChats() method
- `packages/shared/src/relay-adapter-schemas.ts` — label on CatalogInstance/AdapterConfig/AdapterCreateRequest, ObservedChatSchema
- `packages/shared/src/transport.ts` — getObservedChats() interface method
- `apps/client/src/layers/shared/lib/transport/relay-methods.ts` — getObservedChats() implementation
- `apps/client/src/layers/shared/lib/transport/http-transport.ts` — getObservedChats delegation
- `apps/client/src/layers/shared/lib/direct-transport.ts` — getObservedChats() stub
- `packages/test-utils/src/mock-factories.ts` — getObservedChats mock, createMockObservedChat(), createMockBinding() factories, updateBinding dynamic mock
- `packages/relay/src/adapters/telegram/telegram-adapter.ts` — multiInstance: true
- `apps/client/src/layers/features/relay/ui/AdapterCard.tsx` — label display, status dot, bound agents, onBindClick prop
- `apps/client/src/layers/features/relay/ui/RelayPanel.tsx` — passes onBindClick to AdapterCard (navigates to bindings tab)
- `apps/client/src/layers/entities/relay/model/use-observed-chats.ts` — useObservedChats hook
- `apps/client/src/layers/entities/relay/index.ts` — exports useObservedChats
- `apps/client/src/layers/features/relay/ui/BindingList.tsx` — New Binding button, Add similar binding action, duplicate pre-fill
- `apps/client/src/layers/features/relay/ui/AdapterSetupWizard.tsx` — BindStep component, bind-to-agent step after confirm, StepIndicator showBindStep prop
- `apps/client/src/layers/features/relay/ui/ConversationRow.tsx` — Route button with popover agent picker, quick-route, BindingDialog "More options"

**Test files:**

- `apps/server/src/routes/__tests__/relay.test.ts` — 6 new PATCH binding tests + 5 observed chats route tests
- `apps/server/src/services/relay/__tests__/adapter-manager.test.ts` — 9 label tests + multi-instance test
- `apps/server/src/services/relay/__tests__/trace-store.test.ts` — 9 getObservedChats tests
- `packages/relay/src/__tests__/manifests.test.ts` — Updated Telegram multiInstance assertion
- `apps/client/src/layers/features/relay/__tests__/AdapterCard.test.tsx` — 14 new tests for label, status dot, bound agents, Bind button
- `apps/client/src/layers/entities/relay/model/__tests__/use-observed-chats.test.tsx` — 4 hook tests
- `apps/client/src/layers/features/mesh/ui/BindingDialog.tsx` — expanded with create/edit modes, adapter/agent pickers, chat filter
- `apps/client/src/layers/features/mesh/ui/__tests__/BindingDialog.test.tsx` — 22 new tests
- `apps/server/src/routes/__tests__/relay-bindings-integration.test.ts` — 17 integration tests
- `apps/client/src/layers/features/relay/__tests__/BindingList.test.tsx` — 7 new tests for New Binding button and duplicate action
- `apps/client/src/layers/features/relay/__tests__/AdapterSetupWizard.test.tsx` — bind step tests
- `apps/client/src/layers/features/relay/__tests__/ConversationRow.test.tsx` — 18 new tests for Route button, popover, quick-route, BindingDialog integration

## Known Issues

_(None yet)_

## Implementation Notes

### Session 1

Batch 1 (Foundation) complete. All 4 P1 tasks implemented in parallel. Note: task 1.3 agent reported a pre-existing test expectation mismatch in relay.test.ts line 665 due to addAdapter signature change from task 1.2 — task 1.2's agent updated that test, so this should be resolved.

### Session 2

Task #5 (3.2): AdapterCard updated with label display, binding-aware status dot, and bound agent names. The existing AdapterCard test file was extended (not replaced) with 14 new tests covering label display, status dot colors, bound agent names, and the Bind button. `useBindings` and `useRegisteredAgents` entity hooks are now called inside AdapterCard — the test file was updated to mock both. `RelayPanel` passes `onBindClick` to `AdapterCard` which navigates to the bindings tab as a placeholder (will be wired to BindingDialog in task 2.3).

Task #6 (2.1): Observed chats endpoint and client hook. `TraceStore.getObservedChats()` queries trace metadata via SQLite json_extract, groups by chatId in application code, and sorts by lastMessageAt descending. GET `/api/relay/adapters/:id/chats` route passes through to traceStore (returns 404 when tracing unavailable). `useObservedChats(adapterId)` TanStack Query hook with 30s staleTime, disabled when adapterId is undefined. Tests: 9 TraceStore unit tests covering aggregation, filtering, sorting, limit, and edge cases; 5 route tests; 4 hook tests.

Task #8 (3.1): Label input added to AdapterSetupWizard configure step. "Name (optional)" input above config fields. Telegram auto-label: `testConnection()` now returns `botUsername` from `getMe()`, client auto-fills `@username` when label empty. 5 new wizard tests. Transport `testRelayAdapterConnection` return type extended with `botUsername?: string`.

Task #9 (3.2): AdapterCard already completed in prior batch.

Task #10 (3.3): CatalogCard updated with instance count badge and "Add Another" button text for multi-instance types.

Task #13 (4.3): Sidebar Connections view filtering. NavigationLayout accepts `connectionFilter` prop. Parent computes filter from useBindings + useAdapterCatalog.

Task #6 (2.2): BindingDialog expanded with create/edit modes. Create mode shows adapter picker (from catalog), agent picker (from mesh registry), project path input, session strategy selector, label input, and collapsible Chat Filter section with chatId picker (from observed chats) and channelType dropdown. Edit mode shows read-only adapter/agent names with mutable fields. "Active" badge on Chat Filter when filters set. "Clear filters" button resets chatId/channelType. 22 new tests covering create mode, edit mode, chat filter, cancel, and pre-fill behavior.

Task #14 (5.1): Integration tests for binding CRUD and observed chats. 17 tests across 4 describe blocks: binding CRUD roundtrip (6 tests with stateful Map-backed store), multi-instance adapter flow (4 tests), observed chats pipeline (6 tests), and cross-concern binding+chats (1 test). Uses express+supertest pattern matching discovery.integration.test.ts. Full server suite: 1298 tests, 78 files, zero regressions.

### Session 3

Task #7 (2.3): BindingList updated with "New Binding" button (Plus icon) above the list and empty state. "Add similar binding" dropdown item (Copy icon) added to kebab menu. Duplicate pre-fills all fields except chatId. BindingDialog fixed: Radix Select forbids empty-string values, so `SELECT_ANY` sentinel replaces empty strings for chatId/channelType "no filter" state. 7 new BindingList tests (4 New Binding, 3 duplicate). Full client suite: 1815 tests, 0 failures.

Task #11 (4.1): AdapterSetupWizard bind step. WizardStep type extended with 'bind'. BindStep component shows agent picker + session strategy selector after adapter creation succeeds. StepIndicator accepts `showBindStep` prop to conditionally show the bind step indicator. SESSION_STRATEGIES constant for strategy options. "Bind to Agent" primary button and "Skip" ghost button. Toast notification after adapter creation.

Task #12 (4.2): ConversationRow "Route to Agent" action. Route button with popover containing agent picker (Radix Select), "Create Binding" button for quick route, and "More options..." link that opens BindingDialog in create mode with adapterId/chatId/channelType pre-filled from conversation payload. Extract helpers (`extractAdapterId`, `extractChatId`, `extractChannelType`) parse payload metadata. stopPropagation prevents row expand on Route click. 18 new tests.

Task #15 (5.2): Mock factories and animation polish. `createMockObservedChat()` and `createMockBinding()` factory functions added to `@dorkos/test-utils`. `updateBinding` mock upgraded to dynamic `mockImplementation` that merges id + updates. Animation verification: wizard bind step uses existing `AnimatePresence mode="wait"` with `motion.div` opacity transition; amber status dot has `animate-pulse`; all other new UI uses standard shadcn dialog/popover animations. Full suite: 1833 client tests (148 files), 1298 server tests (78 files), zero regressions. TypeScript clean across monorepo (13/13 packages).

### Session 3 - 2026-03-11

- Task #7: [P2] Add New Binding button and duplicate action to BindingList
- Task #11: [P4] Add optional Bind to Agent step to AdapterSetupWizard
- Task #12: [P4] Add Route to Agent action to ConversationRow
- Task #15: [P5] Update mock factories and polish animations
