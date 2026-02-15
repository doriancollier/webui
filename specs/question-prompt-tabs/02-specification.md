# Specification: Question Prompt Tabs & Answer Summary

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-13
**Slug:** question-prompt-tabs
**Ideation:** [01-ideation.md](./01-ideation.md)

---

## 1. Overview

Improve the `QuestionPrompt` component (AskUserQuestion tool UI) with two changes:

1. **Tabbed navigation** for multi-question prompts — users answer one question at a time via a pill-styled tab bar
2. **Vertical stacked answer summary** — replace the broken inline `flex-wrap` layout with a clean vertical list of Q&A pairs

## 2. Background / Problem Statement

The `QuestionPrompt` component renders the AskUserQuestion tool's interactive UI inside chat messages. Two UX issues exist:

**Problem 1 — Multi-question clutter:** When Claude asks multiple questions simultaneously (1-4 questions per tool call), all questions render vertically in one long form. Users see all options for all questions at once, making the UI cluttered and overwhelming. There is no way to focus on one question at a time.

**Problem 2 — Poor answer summary formatting:** After submitting answers, the collapsed summary uses `flex flex-wrap gap-2` with inline `<span>` elements showing `Header: value` pairs. Long answer values cause awkward line breaks, and multiple answers become hard to read in the inline flow.

## 3. Goals

- Display a tab bar when 2+ questions arrive, allowing users to focus on one question at a time
- Show completion indicators (checkmarks) on tabs where a selection has been made
- Replace the inline answer summary with a scannable vertical stacked layout
- Maintain backward compatibility — single-question prompts render identically to today
- Preserve all existing functionality: submit flow, error handling, history restoration

## 4. Non-Goals

- Changing the AskUserQuestion SDK protocol or server-side handling
- Modifying how answers are stored in JSONL transcripts
- Adding new question types (sliders, date pickers, etc.)
- Per-question submit buttons or auto-advance on answer
- Animating tab transitions (keep it simple)

## 5. Technical Dependencies

| Dependency                               | Version   | Purpose                                       |
| ---------------------------------------- | --------- | --------------------------------------------- |
| `@radix-ui/react-tabs`                   | `^1.1.13` | Tab primitives (already installed)            |
| `apps/client/src/components/ui/tabs.tsx` | N/A       | Shadcn-style Tabs wrapper (already exists)    |
| `lucide-react`                           | `latest`  | `Check`, `MessageSquare` icons (already used) |

No new dependencies required.

## 6. Detailed Design

### 6.1 Architecture — No Structural Changes

This is a component-level modification to `QuestionPrompt.tsx`. No changes to:

- Server routes or transport interface
- Type definitions (`QuestionItem`, `QuestionOption`)
- `MessageItem.tsx` (parent component)
- `use-chat-session.ts` (state management hook)
- Answer format (`Record<string, string>`)

### 6.2 Component Structure

```
QuestionPrompt
├── Submitted state (collapsed)
│   └── Vertical stacked Q&A summary (NEW layout)
│
└── Pending state (form)
    ├── questions.length === 1 → render single question directly (no tabs)
    └── questions.length >= 2 → Tabs wrapper
        ├── TabsList (pill-styled tab bar)
        │   └── TabsTrigger per question (header + optional checkmark)
        ├── TabsContent per question
        │   ├── Question header + text
        │   ├── Options (radio/checkbox)
        │   └── "Other" free-text option
        └── Submit button (outside tabs, applies to ALL questions)
```

### 6.3 Tab Navigation Implementation

**Controlled state:** Add `activeTab` state initialized to `"0"` (first question index as string).

```tsx
const [activeTab, setActiveTab] = useState('0');
```

**Conditional rendering:** Only wrap in `Tabs` when `questions.length > 1`.

```tsx
// Single question — render directly (no visual change)
if (questions.length === 1) {
  return <QuestionForm question={questions[0]} index={0} />;
}

// Multiple questions — wrap in Tabs
return (
  <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsList>
      {questions.map((q, idx) => (
        <TabsTrigger key={idx} value={String(idx)}>
          {hasAnswer(idx) && <Check className="mr-1 size-3" />}
          <span className="max-w-[120px] truncate">{q.header}</span>
        </TabsTrigger>
      ))}
    </TabsList>
    {questions.map((q, idx) => (
      <TabsContent key={idx} value={String(idx)}>
        <QuestionForm question={q} index={idx} />
      </TabsContent>
    ))}
  </Tabs>
);
```

**Completion detection helper:**

```tsx
function hasAnswer(idx: number): boolean {
  const sel = selections[idx];
  if (!sel) return false;
  if (questions[idx].multiSelect) {
    const arr = sel as string[];
    return arr.length > 0 && (!arr.includes('__other__') || !!otherText[idx]?.trim());
  }
  return sel !== '__other__' || !!otherText[idx]?.trim();
}
```

### 6.4 Tab Trigger Styling

Override the default `TabsList` / `TabsTrigger` styling for the compact tool-card context:

```tsx
<TabsList className="mb-3 h-auto flex-wrap gap-1.5 bg-transparent p-0">
  <TabsTrigger
    value={String(idx)}
    className="data-[state=inactive]:bg-muted/50 h-auto rounded-full px-2.5 py-1 text-xs font-medium data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300"
  >
    ...
  </TabsTrigger>
</TabsList>
```

Key styling decisions:

- `rounded-full` for pill shape
- `text-xs` for compact sizing
- Amber active state to match the form's amber theme
- `flex-wrap` on TabsList so tabs wrap on narrow screens
- `max-w-[120px] truncate` on header text to prevent overflow

### 6.5 Answer Summary Redesign

Replace the inline `flex flex-wrap gap-2` layout with vertical stacking:

```tsx
// Current (broken):
<div className="flex flex-wrap gap-2">
  {questions.map((q, idx) => (
    <span className="inline-flex items-center gap-1">
      <span>{q.header}:</span>
      <span>{displayValue}</span>
    </span>
  ))}
</div>

// New (vertical stack):
<div className="flex items-start gap-2">
  <Check className="size-(--size-icon-md) text-emerald-500 mt-0.5 shrink-0" />
  <div className="space-y-1.5 min-w-0">
    {questions.map((q, idx) => {
      const displayValue = getDisplayValue(q, idx);
      if (!displayValue) return null;
      return (
        <div key={idx}>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {q.header}
          </span>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 break-words">
            {displayValue}
          </p>
        </div>
      );
    })}
  </div>
</div>
```

Key changes:

- Check icon aligned to top-left with `mt-0.5 shrink-0`
- Each Q&A pair gets its own `<div>` with header above, value below
- `break-words` on value text prevents horizontal overflow
- `space-y-1.5` provides consistent vertical spacing
- `min-w-0` on the container allows text truncation to work

### 6.6 Display Value Extraction

Extract the display value logic into a helper function for clarity:

```tsx
function getDisplayValue(q: QuestionItem, idx: number): string | null {
  if (preAnswers && preAnswers[String(idx)]) {
    const raw = preAnswers[String(idx)];
    if (q.multiSelect) {
      try {
        return (JSON.parse(raw) as string[]).join(', ');
      } catch {
        return raw;
      }
    }
    return raw;
  }
  if (!preAnswers) {
    const sel = selections[idx];
    if (!sel) return null;
    if (q.multiSelect) {
      return (sel as string[]).map((v) => (v === '__other__' ? otherText[idx] : v)).join(', ');
    }
    return sel === '__other__' ? otherText[idx] : (sel as string);
  }
  return null;
}
```

### 6.7 Submit Button Placement

The submit button remains **outside** the tabs, at the bottom of the form container. It submits ALL questions at once, matching the current behavior:

```tsx
<div className="my-1 rounded border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
  {/* Tab bar + content (or single question) */}
  {renderQuestionForm()}

  {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

  <button
    onClick={handleSubmit}
    disabled={!isComplete() || submitting}
    className="mt-3 flex items-center gap-1 rounded bg-amber-600 px-3 py-1.5 text-xs text-white ..."
  >
    {submitting ? (
      'Submitting...'
    ) : (
      <>
        <Check /> Submit
      </>
    )}
  </button>
</div>
```

## 7. User Experience

### Single Question Flow (unchanged)

1. Assistant sends AskUserQuestion with 1 question
2. QuestionPrompt renders with header, question text, options — no tab bar
3. User selects option, clicks Submit
4. Prompt collapses to vertical summary

### Multi-Question Flow (new)

1. Assistant sends AskUserQuestion with 2-4 questions
2. QuestionPrompt renders with pill tab bar showing question headers
3. First tab is active by default
4. User selects an option for question 1 — tab 1 gets a checkmark
5. User clicks tab 2 to answer next question
6. After answering all questions, Submit button becomes enabled
7. User clicks Submit — all answers sent in one batch
8. Prompt collapses to vertical stacked summary showing all Q&A pairs

### History Restoration (unchanged behavior)

1. User opens a session with previously answered questions
2. QuestionPrompt receives `answers` prop from history
3. Immediately renders in collapsed state with vertical summary
4. No tab bar shown (already answered)

## 8. Testing Strategy

### Existing Tests to Preserve (update as needed)

All 11 existing tests must continue to pass. Tests that check for collapsed summary layout will need updates to match the new vertical structure.

### New Tests

```tsx
describe('Multi-question tabs', () => {
  // Verifies tab bar renders with correct question headers
  it('renders tab bar when multiple questions provided', () => {
    render(<QuestionPrompt {...baseProps} questions={[singleQ, multiQ]} />);
    expect(screen.getByRole('tablist')).toBeDefined();
    expect(screen.getByRole('tab', { name: /Approach/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Features/i })).toBeDefined();
  });

  // Verifies single question has no tab overhead
  it('does not render tab bar for single question', () => {
    render(<QuestionPrompt {...baseProps} questions={[singleQ]} />);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  // Verifies only active tab's content is visible
  it('shows only active tab content', () => {
    render(<QuestionPrompt {...baseProps} questions={[singleQ, multiQ]} />);
    // First tab active by default
    expect(screen.getByText(singleQ.question)).toBeDefined();
    expect(screen.queryByText(multiQ.question)).toBeNull();
  });

  // Verifies tab switching shows different question
  it('switches content when tab is clicked', () => {
    render(<QuestionPrompt {...baseProps} questions={[singleQ, multiQ]} />);
    fireEvent.click(screen.getByRole('tab', { name: /Features/i }));
    expect(screen.getByText(multiQ.question)).toBeDefined();
  });

  // Verifies submit requires ALL questions answered across tabs
  it('submit disabled until all questions answered across tabs', () => {
    render(<QuestionPrompt {...baseProps} questions={[singleQ, multiQ]} />);
    // Answer first question only
    fireEvent.click(screen.getAllByRole('radio')[0]);
    expect(screen.getByRole('button', { name: /submit/i }).hasAttribute('disabled')).toBe(true);
  });

  // Verifies checkmark appears on answered tabs
  it('shows checkmark on answered tabs', () => {
    const { container } = render(<QuestionPrompt {...baseProps} questions={[singleQ, multiQ]} />);
    fireEvent.click(screen.getAllByRole('radio')[0]);
    // First tab should now have a check icon (svg)
    const firstTab = screen.getByRole('tab', { name: /Approach/i });
    expect(firstTab.querySelector('svg')).not.toBeNull();
  });
});

describe('Answer summary layout', () => {
  // Verifies vertical layout renders header and value on separate elements
  it('renders vertical stacked summary after submission', async () => {
    render(<QuestionPrompt {...baseProps} questions={[singleQ]} />);
    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      // Header as label, value as separate text
      expect(screen.getByText('Approach')).toBeDefined();
      expect(screen.getByText('Reschedule the internal meeting')).toBeDefined();
    });
  });

  // Verifies pre-answered questions (from history) use vertical layout
  it('renders vertical summary for pre-answered questions', () => {
    render(
      <QuestionPrompt
        {...baseProps}
        questions={[singleQ, multiQ]}
        answers={{
          '0': 'Reschedule the internal meeting',
          '1': JSON.stringify(['Dark mode', 'Search']),
        }}
      />
    );
    expect(screen.getByText('Approach')).toBeDefined();
    expect(screen.getByText('Reschedule the internal meeting')).toBeDefined();
    expect(screen.getByText('Features')).toBeDefined();
    expect(screen.getByText('Dark mode, Search')).toBeDefined();
  });
});
```

### Mock Strategy

The existing mock pattern is sufficient — no new mocks needed:

- `motion/react` mocked to plain elements
- `TransportContext` mocked with `submitAnswers` spy
- Radix Tabs renders natively in jsdom (no mock needed — Radix handles headless rendering)

## 9. Performance Considerations

- **No impact:** This is a UI-only change to a small component
- Tab content uses Radix's lazy mounting (`forceMount` not used) — only active tab's DOM is rendered
- No new network requests, state stores, or subscriptions

## 10. Security Considerations

- No security impact — this is a client-side UI change
- No new user inputs beyond existing radio/checkbox/textarea
- Answer submission uses existing `transport.submitAnswers()` path

## 11. Documentation

No documentation changes needed. The `guides/interactive-tools.md` guide describes the AskUserQuestion flow at the protocol level, which is unchanged.

## 12. Implementation Phases

### Phase 1: Core Implementation (single phase)

1. **Add tab wrapper to pending state** — controlled Tabs with pill triggers, conditional on `questions.length > 1`
2. **Add completion indicators** — checkmark icon in tab triggers when question has an answer
3. **Redesign collapsed summary** — replace `flex-wrap` inline layout with vertical stacked `space-y-1.5` layout
4. **Extract helper functions** — `hasAnswer()` and `getDisplayValue()` for clarity
5. **Update tests** — modify collapsed-state assertions, add tab navigation tests

### Files Modified

| File                                                                | Action | Description                                   |
| ------------------------------------------------------------------- | ------ | --------------------------------------------- |
| `apps/client/src/components/chat/QuestionPrompt.tsx`                | Modify | Add Tabs for multi-question, redesign summary |
| `apps/client/src/components/chat/__tests__/QuestionPrompt.test.tsx` | Modify | Update + add tests for tabs and summary       |

## 13. Open Questions

None — all decisions resolved during ideation.

## 14. References

- [Ideation document](./01-ideation.md)
- [Radix Tabs API](https://www.radix-ui.com/primitives/docs/components/tabs) — controlled state, a11y
- [Interactive Tools Guide](../../guides/interactive-tools.md) — AskUserQuestion protocol flow
- Existing Tabs usage: `apps/client/src/components/settings/SettingsDialog.tsx`
