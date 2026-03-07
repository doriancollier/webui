# Task Breakdown: Fix streamdown Render Truncation of `[]`-Containing Inline Code

Generated: 2026-03-07
Source: specs/fix-streamdown-render-truncation/02-specification.md
Last Decompose: 2026-03-07

---

## Overview

`streamdown@2.3.0` bundles `remend@1.2.1`, whose incomplete-markdown preprocessor silently discards content after inline backtick code containing `[]` (e.g. `` `number[]` ``) when processing partial text at streaming chunk boundaries. Hard reload renders correctly; the truncation is visible only during live streaming.

The fix is a targeted dependency bump: change `apps/client/package.json` from `"streamdown": "latest"` to `"streamdown": "^2.4.0"`, regenerate the lockfile, and add one regression test. No component code changes are required.

---

## Phase 1: Complete Fix

### Task 1.1: Bump streamdown to ^2.4.0 and regenerate lockfile

**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (1.2 depends on this)

**Problem**:

`streamdown@2.3.0` bundles `remend@1.2.1`, which misfires when it encounters `[` inside a complete inline code span (e.g. `` `number[]` ``). It misidentifies the `[` as the start of an incomplete `[link](url)` reference and discards everything after it. This produces silent content truncation during streaming. After a hard reload the full text is passed to `remend` at once and renders correctly.

`remend@1.2.2` (release notes: _"fixes emphasis completion handlers incorrectly closing markers inside complete inline code spans"_) is bundled in `streamdown@2.4.0` and fixes the root cause.

**Change 1 — `apps/client/package.json` line 53**:

```diff
-    "streamdown": "latest",
+    "streamdown": "^2.4.0",
```

The `"latest"` specifier is an anti-pattern: any future major/minor bump could silently introduce regressions on a fresh install. `"^2.4.0"` (patch-compatible) receives patch fixes but not breaking minor/major changes.

**Change 2 — Regenerate lockfile**:

```bash
pnpm install
```

Run from the repo root. This updates `pnpm-lock.yaml` to resolve `streamdown@2.4.0` and `remend@1.2.2`. No other dependencies are expected to change.

**Acceptance Criteria**:

- [ ] `apps/client/package.json` line 53 reads `"streamdown": "^2.4.0"` (not `"latest"`)
- [ ] `pnpm-lock.yaml` resolves `streamdown@2.4.0` and `remend@1.2.2`
- [ ] `pnpm install` completes without errors
- [ ] `pnpm typecheck` passes (no TypeScript changes required)
- [ ] `pnpm test` suite passes

---

### Task 1.2: Add regression test for array-type inline code truncation

**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Purpose**:

Add one test case to the existing `StreamingText` describe block that will fail if the dependency is ever downgraded back to `streamdown@2.3.x` (which bundles the buggy `remend@1.2.1`).

**File**: `apps/client/src/layers/features/chat/__tests__/StreamingText.test.tsx`

**Existing file context**:

The file uses a `vi.mock('streamdown', ...)` at the top that renders `<Streamdown>` as a plain `<div data-testid="streamdown">{children}</div>`. The `StreamingText` component passes its `content` prop directly as `children` to `<Streamdown>`. Therefore `screen.getByTestId('streamdown').textContent` equals exactly the `content` string that `StreamingText` passes through.

**New test case — append inside the existing `describe('StreamingText', ...)` block after the last `it(...)` case**:

```typescript
it('passes TypeScript array type syntax through without truncation', () => {
  // Purpose: Regression guard for the streamdown@2.3.0/remend@1.2.1 bug where `[]`
  // inside inline code spans caused trailing content to be silently dropped during
  // streaming. Verifies the full content string—including array brackets—reaches
  // <Streamdown> unchanged. This test CAN fail if the dependency is downgraded to 2.3.x.
  const content =
    '- **Array literals**: `numbers` is typed as `number[]`\n\nThis paragraph must also render.';
  render(<StreamingText content={content} />);
  expect(screen.getByTestId('streamdown').textContent).toBe(content);
});
```

**How the assertion works**:

If `remend` truncation regresses, the content reaching `<Streamdown>` would be shorter (truncated at `number[`) and `toBe(content)` would fail with a clear string mismatch showing the missing trailing content.

**Acceptance Criteria**:

- [ ] The new test case is inside the `describe('StreamingText', ...)` block
- [ ] The content string is `'- **Array literals**: \`numbers\` is typed as \`number[]\`\n\nThis paragraph must also render.'`
- [ ] The assertion is `expect(screen.getByTestId('streamdown').textContent).toBe(content)`
- [ ] All 7 tests in the describe block (6 existing + 1 new) pass: `pnpm vitest run apps/client/src/layers/features/chat/__tests__/StreamingText.test.tsx`
- [ ] No existing tests are modified

---

## Dependency Graph

```
1.1 (bump + lockfile)
  └─→ 1.2 (regression test)
```

## Critical Path

Task 1.1 → Task 1.2

Both tasks are small. Total implementation time is minimal — one line change in `package.json`, one `pnpm install`, and one `it(...)` block added to an existing test file.
