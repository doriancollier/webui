---
slug: browser-testing-system
number: 61
created: 2026-02-25
status: ideation
---

# Browser Testing System for DorkOS

**Slug:** browser-testing-system
**Author:** Claude Code
**Date:** 2026-02-25
**Branch:** preflight/browser-testing-system
**Related:** N/A

---

## 1) Intent & Assumptions

- **Task brief:** Build an AI-driven browser testing system with two layers: (1) Standard Playwright Test suite with deterministic `.spec.ts` files that run via `npx playwright test` (CI-friendly, no AI needed), and (2) AI orchestration layer with skills + commands that use the Playwright MCP server to write, debug, and maintain those tests.
- **Assumptions:**
  - Tests run against real dev server (Vite on 4241, Express on DORKOS_PORT)
  - Chromium-only initially
  - Full chat tests with real Agent SDK (requires ANTHROPIC_API_KEY)
  - Tests live in `apps/e2e/` as a separate Turborepo workspace
  - Playwright MCP is already available in the environment
  - No authentication layer exists — no auth setup needed
- **Out of scope:**
  - Multi-browser support (Firefox, WebKit) — add later
  - Visual regression testing / screenshot diffing
  - Performance benchmarking
  - CI/CD pipeline configuration (tests should work in CI, but pipeline setup is separate)

## 2) Pre-reading Log

- `vitest.workspace.ts`: Defines 7 Vitest test projects (client, roadmap, server, cli, mesh, relay, shared)
- `turbo.json`: Turborepo config with `globalPassThroughEnv` for runtime vars; `test` task depends on `^build`
- `.claude/rules/testing.md`: Complete unit test patterns (Vitest, jsdom, mock Transport), no E2E patterns
- `apps/client/vite.config.ts`: Vite dev server on port 4241, proxies `/api` to DORKOS_PORT (default 4242, user uses 6942)
- `apps/client/package.json`: React 19, Vite 6, no Playwright dependency
- `apps/server/package.json`: Express, Agent SDK, vitest only
- `packages/test-utils/src/`: Mock factories (createMockTransport, createMockSession, createMockStreamEvent), React test helpers, SSE helpers
- `.claude/commands/`: YAML frontmatter command files — pattern for `/browsertest` command
- `.claude/skills/`: Skill directories with SKILL.md — pattern for `browser-testing` skill
- `contributing/`: 13 existing guides — pattern for `browser-testing.md`
- `apps/client/src/App.tsx`: Entry point — standalone vs embedded modes, sidebar + chat layout
- `apps/client/src/layers/features/`: 80+ feature components organized by FSD (chat, session-list, commands, settings, pulse, relay, mesh, status, files)

## 3) Codebase Map

**Primary Components/Modules:**

- `apps/client/src/App.tsx` — App shell with sidebar + chat panel layout
- `apps/client/src/layers/features/chat/ui/ChatPanel.tsx` — Main chat interface (message list, input, tasks, status line)
- `apps/client/src/layers/features/chat/ui/ChatInput.tsx` — Message input with slash command integration
- `apps/client/src/layers/features/chat/ui/MessageList.tsx` — Scrollable message list with virtualization
- `apps/client/src/layers/features/chat/ui/MessageItem.tsx` — Individual message rendering (user/assistant)
- `apps/client/src/layers/features/chat/ui/ToolCallCard.tsx` — Tool call display with expand/collapse
- `apps/client/src/layers/features/chat/ui/ToolApproval.tsx` — Tool approval/deny UI
- `apps/client/src/layers/features/session-list/ui/SessionSidebar.tsx` — Session list with time grouping
- `apps/client/src/layers/features/session-list/ui/SessionItem.tsx` — Individual session row
- `apps/client/src/layers/features/commands/ui/CommandPalette.tsx` — Slash command palette (Cmd+K)
- `apps/client/src/layers/features/settings/ui/SettingsDialog.tsx` — Settings with tabs
- `apps/client/src/layers/features/pulse/ui/PulsePanel.tsx` — Pulse scheduler UI
- `apps/client/src/layers/features/relay/ui/RelayPanel.tsx` — Relay messaging dashboard
- `apps/client/src/layers/features/mesh/ui/MeshPanel.tsx` — Mesh agent discovery + topology
- `apps/client/src/layers/features/status/ui/StatusLine.tsx` — Bottom status bar

**Shared Dependencies:**

- `packages/shared/src/transport.ts` — Transport interface (HttpTransport for web)
- `packages/shared/src/schemas.ts` — Zod schemas for all types
- `packages/shared/src/constants.ts` — DEFAULT_PORT and other constants
- `packages/test-utils/` — Mock factories, React helpers (used by unit tests, not E2E)

**Data Flow:**

```
User Input (ChatInput)
  → transport.sendMessage(sessionId, content, onEvent, signal, cwd)
    → HttpTransport: POST /api/sessions/:id/messages
      → Express route → AgentManager.query() with SDK
        → SDK streaming → sdk-event-mapper → StreamEvent
          → SSE wire protocol → client parses ReadableStream
            → useChatSession updates state → UI re-renders
```

**Feature Flags/Config:**

- `DORKOS_PORT` (default 4242, user uses 6942)
- `VITE_PORT` (default 4241)
- `DORKOS_PULSE_ENABLED` — toggles Pulse scheduler
- `DORKOS_RELAY_ENABLED` — toggles Relay messaging
- `DORKOS_MESH_ENABLED` — toggles Mesh discovery
- `TUNNEL_ENABLED` — toggles ngrok tunnel

**Potential Blast Radius:**

- **New files:** ~30+ files (config, fixtures, POMs, specs, reporters, commands, skills, guides)
- **Modified files:** root `package.json`, `turbo.json`, `.gitignore`, possibly `vitest.workspace.ts`
- **data-testid sparse:** Only 12 files currently use data-testid — may need additions for stable locators

## 4) Root Cause Analysis

N/A — This is a new feature, not a bug fix.

## 5) Research

Research agent analyzed 17 sources across Playwright docs, Turborepo docs, Playwright MCP GitHub, and practitioner guides.

**Potential Solutions:**

1. **`apps/e2e/` Turborepo workspace with feature-mirrored tests**
   - Pros: Turborepo-native, isolated deps, targetable via `--filter`, mirrors FSD structure
   - Cons: Slightly more setup than flat tests at root
   - Complexity: Medium
   - Maintenance: Low

2. **`tests/browser/` at repo root (original plan)**
   - Pros: Simple, no workspace config needed
   - Cons: Doesn't integrate with Turbo's workspace model, manual script wiring
   - Complexity: Low
   - Maintenance: Medium

3. **Inline E2E in `apps/client/e2e/`**
   - Pros: Co-located with client code
   - Cons: E2E tests span client+server; wrong scope
   - Complexity: Low
   - Maintenance: High (blurred boundaries)

**Key Research Findings:**

- Multi-server `webServer` array config handles Vite + Express natively
- `reuseExistingServer: !process.env.CI` is the canonical pattern for fast local dev
- `test.extend()` fixture-based POMs are strictly better than `beforeEach` patterns
- Project dependencies approach preferred over `globalSetup` (avoids race conditions with `webServer`)
- E2E tasks must use `cache: false` in Turborepo (real server behavior can't be cached)
- `@playwright/mcp` uses accessibility tree snapshots (2-5KB), not screenshots — 10-100x faster for AI
- AI-generated tests should always get human review before merge

**Recommendation:** Option 1 — `apps/e2e/` workspace with feature-mirrored structure, fixture-based POMs, multi-reporter config, and `@playwright/mcp` for AI orchestration.

## 6) Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Test location | `apps/e2e/` workspace | Turborepo best practice — separate package.json, own devDeps, targetable via `--filter=@dorkos/e2e`. Research + Turborepo docs converge on this. |
| 2 | Agent SDK in tests | Full chat tests with real SDK | Tests the core feature immediately. Requires ANTHROPIC_API_KEY. Tag slow tests with `@integration`. |
| 3 | Implementation scope | All 4 phases | Infrastructure + seed tests + AI commands + self-maintenance + health reporting. |
