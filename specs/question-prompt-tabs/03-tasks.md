# Tasks: Question Prompt Tabs & Answer Summary

**Spec:** [02-specification.md](./02-specification.md)
**Slug:** question-prompt-tabs
**Generated:** 2026-02-13

---

## Task 1: Add tab wrapper for multi-question pending state

**File:** `apps/client/src/components/chat/QuestionPrompt.tsx`

1. Import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `../../components/ui/tabs`
2. Add `activeTab` state initialized to `"0"`
3. Add `hasAnswer(idx)` helper for completion detection
4. Refactor pending state:
   - `questions.length === 1` → render directly (no tabs)
   - `questions.length > 1` → wrap in controlled `<Tabs>`
5. Pill-styled triggers with amber theme, `Check` icon for answered tabs
6. Submit button outside tabs, `isComplete()` checks ALL questions

## Task 2: Redesign collapsed answer summary to vertical stacked layout

**File:** `apps/client/src/components/chat/QuestionPrompt.tsx`

1. Extract `getDisplayValue(q, idx)` helper
2. Replace `flex flex-wrap gap-2` with vertical `space-y-1.5` layout
3. Each Q&A pair: header label above, answer value below
4. Remove colon from header display
5. Keep emerald styling and fallback text

## Task 3: Update and add tests for tabs and summary

**File:** `apps/client/src/components/chat/__tests__/QuestionPrompt.test.tsx`

1. Update existing collapsed summary test (remove colon from assertion)
2. Add `Multi-question tabs` describe block (6 tests: tab bar rendering, single question no tabs, active tab content, tab switching, submit disabled until all answered, checkmark indicators)
3. Add `Answer summary layout` describe block (2 tests: vertical summary after submission, pre-answered vertical summary)

## Task 4: Verify build and all tests pass

1. Run QuestionPrompt tests
2. Run full `turbo build`
3. Run full `turbo test`

---

## Dependencies

- Task 4 blocked by Tasks 1, 2, 3
- Tasks 1, 2, 3 are independent and can be done in parallel (all modify the same file, but different sections)
