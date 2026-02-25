---
description: Run, create, debug, and maintain browser tests
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Task, TaskOutput, AskUserQuestion
argument-hint: '<run|debug|maintain|report|create> [feature] [description]'
category: testing
---

# Browser Test Command

You are managing DorkOS browser tests. Parse `$ARGUMENTS` and route to the appropriate action.

## Routing Logic

Parse the first word of `$ARGUMENTS`:

### `run [feature]`

Execute browser tests.

```bash
# Run all tests
cd apps/e2e && npx playwright test

# Run specific feature
cd apps/e2e && npx playwright test tests/<feature>/
```

After running, read `apps/e2e/manifest.json` and display a results summary.

### `create <feature> <description>`

Create a new browser test:

1. Read `apps/e2e/manifest.json` to check if a similar test already exists
2. Use the Playwright MCP tools (`mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`) to navigate to the feature in the running app at `http://localhost:4241`
3. Capture accessibility snapshots to identify key elements, selectors, and user flows
4. Check `apps/e2e/pages/` for existing POMs that cover this feature. Create a new POM if needed
5. Write a `.spec.ts` file in `apps/e2e/tests/<feature>/` using the custom fixtures from `../../fixtures`
6. Run the test to verify it passes: `cd apps/e2e && npx playwright test tests/<feature>/<new-test>.spec.ts`
7. The manifest reporter will auto-update `manifest.json`

Follow the patterns in `.claude/skills/browser-testing/SKILL.md` for test-writing methodology.

### `debug <test-name>`

Debug a failing test:

1. Run the test with JSON output: `cd apps/e2e && npx playwright test tests/**/<test-name>.spec.ts --reporter=json 2>&1`
2. Parse the error message and failure location
3. Use Playwright MCP to navigate to the page where the test fails
4. Use `mcp__playwright__browser_snapshot` to capture the current accessibility tree
5. Compare the snapshot with what the test expects (locators, text content, element visibility)
6. **Classify the failure:**
   - **TEST bug** (selector changed, timing issue, new UI pattern): Auto-fix the spec or POM, re-run, verify
   - **CODE bug** (regression, broken feature): Present diagnosis and fix options via AskUserQuestion
7. Update manifest.json with the debug session results

### `maintain`

Delegate to the maintain command:

```
Read and follow the instructions in .claude/commands/browsertest:maintain.md
```

### `report`

Display a health dashboard from manifest data:

1. Read `apps/e2e/manifest.json`
2. Calculate aggregate statistics
3. Display formatted report:

```
Browser Test Health Dashboard
==============================

Suite Status: <N> tests | <N> passing | <N> failing | <N>% pass rate
Last Run: <timestamp> (<duration>ms)

Feature Breakdown:
  <feature>: <passed>/<total> passing (<percent>%)
  ...

Recent History (last 5 runs):
  #<N>: <passed>/<total> passed (<duration>ms)
  ...
```

### No recognized subcommand (default)

Treat the arguments as a feature search:

1. Read `apps/e2e/manifest.json`
2. Search for a test matching the arguments (fuzzy match on test key, feature, or description)
3. **If found**: Run the matching test
4. **If not found**: Offer to create a new test using the `create` flow above

## Key Principles

- Always import `test` and `expect` from `../../fixtures`, never from `@playwright/test` directly
- Use Page Object Models for all interactions
- Tag tests: `@smoke` for fast critical path, `@integration` for SDK-dependent
- Never use `page.waitForTimeout()` — use locator state waits
- Auto-fix test bugs; ask the user before making code changes
