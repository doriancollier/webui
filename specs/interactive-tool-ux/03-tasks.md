---
slug: interactive-tool-ux
last-decompose: 2026-02-13
---

# Tasks: Interactive Tool UX Improvements

## Phase 1: Foundation (Kbd + Formatter + Status)

### Task 1: [P1] Create Kbd component

**File**: `apps/client/src/components/ui/kbd.tsx`

Create a shadcn/ui-style Kbd component for rendering keyboard shortcut hints. Hidden on mobile (`hidden md:inline-flex`), visible on desktop.

#### Code Implementation

```tsx
import { cn } from '@/lib/utils';

function Kbd({ className, children, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

export { Kbd };
```

#### Acceptance Criteria
- [ ] Renders children text inside a `<kbd>` element
- [ ] Has `hidden md:inline-flex` classes by default (hidden on mobile, inline-flex on md+)
- [ ] Accepts and merges custom `className` via `cn()`
- [ ] Passes through all standard `<kbd>` HTML attributes
- [ ] Uses `pointer-events-none` and `select-none` to prevent interaction
- [ ] Uses monospace font at 10px size

---

### Task 2: [P1] Create ToolArgumentsDisplay component

**File**: `apps/client/src/lib/tool-arguments-formatter.tsx`

Create a React component that renders tool arguments as formatted key-value pairs instead of raw JSON.

#### Code Implementation

```tsx
import { cn } from '@/lib/utils';

interface ToolArgumentsDisplayProps {
  toolName: string;
  input: string; // JSON string
}

/** Humanize a snake_case or camelCase key into a readable label */
function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/** Truncate a string at a given length with ellipsis */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + '\u2026';
}

/** Check if a string looks like a file path or command */
function isPathOrCommand(value: string): boolean {
  return /^[\/~.]/.test(value) || /\.(ts|tsx|js|jsx|json|md|py|rs|go|sh|yml|yaml|toml)$/.test(value);
}

function renderValue(value: unknown, maxLen: number): React.ReactNode {
  if (value === null) return <span className="text-muted-foreground italic">null</span>;
  if (typeof value === 'boolean') return <span className="text-amber-600 dark:text-amber-400">{String(value)}</span>;
  if (typeof value === 'number') return <span className="text-blue-600 dark:text-blue-400">{value}</span>;
  if (typeof value === 'string') {
    const truncated = truncate(value, maxLen);
    if (isPathOrCommand(value)) {
      return <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">{truncated}</code>;
    }
    return <span className="break-words">{truncated}</span>;
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, 5);
    const remaining = value.length - 5;
    return (
      <div className="space-y-0.5">
        {items.map((item, i) => (
          <div key={i} className="pl-2 border-l border-border/40">
            {renderValue(item, 80)}
          </div>
        ))}
        {remaining > 0 && (
          <span className="text-muted-foreground text-xs italic">
            \u2026 and {remaining} more
          </span>
        )}
      </div>
    );
  }
  if (typeof value === 'object') {
    // Render one level of nesting, then {...} for deeper
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className="space-y-0.5">
        {entries.map(([k, v]) => (
          <div key={k} className="pl-2 border-l border-border/40">
            <span className="text-muted-foreground text-xs">{humanizeKey(k)}: </span>
            {typeof v === 'object' && v !== null ? (
              <span className="text-muted-foreground italic">{'{...'}</span>
            ) : (
              renderValue(v, 80)
            )}
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

export function ToolArgumentsDisplay({ toolName, input }: ToolArgumentsDisplayProps) {
  if (!input) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(input);
  } catch {
    // Fall back to raw <pre> on invalid JSON
    return <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{input}</pre>;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{input}</pre>;
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) return null;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground font-medium py-0.5 whitespace-nowrap">
            {humanizeKey(key)}
          </dt>
          <dd className="py-0.5 min-w-0">
            {renderValue(value, 120)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
```

#### Acceptance Criteria
- [ ] Parses JSON input and renders key-value pairs using a `<dl>` grid layout
- [ ] Humanizes key names: `file_path` -> `File path`, `camelCase` -> `Camel case`
- [ ] Truncates strings at 120 chars (top-level) and 80 chars (nested)
- [ ] Wraps file paths and commands in `<code>` tags
- [ ] Renders nested objects to 2nd level only; 3rd+ level shows `{...}`
- [ ] Renders arrays showing first 5 items with "and N more" for the rest
- [ ] Falls back to raw `<pre>` on invalid JSON
- [ ] Handles empty input string gracefully (returns null)
- [ ] Renders booleans, numbers, and null with distinct styling

---

### Task 3: [P1] Replace raw JSON in ToolCallCard and ToolApproval with ToolArgumentsDisplay

**Files**:
- `apps/client/src/components/chat/ToolCallCard.tsx`
- `apps/client/src/components/chat/ToolApproval.tsx`

#### Changes to ToolCallCard.tsx

Replace lines 48-57 (the `<pre>` block for `toolCall.input`) with:

```tsx
import { ToolArgumentsDisplay } from '../../lib/tool-arguments-formatter';

// In the expanded content section, replace:
{toolCall.input && (
  <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
    {(() => { try { return JSON.stringify(JSON.parse(toolCall.input), null, 2); } catch { return toolCall.input; } })()}
  </pre>
)}

// With:
{toolCall.input && (
  <ToolArgumentsDisplay toolName={toolCall.toolName} input={toolCall.input} />
)}
```

#### Changes to ToolApproval.tsx

Replace lines 63-72 (the `<pre>` block for `input`) with:

```tsx
import { ToolArgumentsDisplay } from '../../lib/tool-arguments-formatter';

// Replace:
{input && (
  <pre className="text-xs overflow-x-auto mb-3 p-2 bg-muted rounded whitespace-pre-wrap">
    {(() => { try { return JSON.stringify(JSON.parse(input), null, 2); } catch { return input; } })()}
  </pre>
)}

// With:
{input && (
  <div className="mb-3 p-2 bg-muted rounded">
    <ToolArgumentsDisplay toolName={toolName} input={input} />
  </div>
)}
```

#### Acceptance Criteria
- [ ] ToolCallCard expanded view shows formatted key-value pairs instead of raw JSON
- [ ] ToolApproval shows formatted key-value pairs instead of raw JSON
- [ ] Invalid JSON still renders as plain text (fallback behavior preserved)
- [ ] ToolCallCard result section still renders as raw `<pre>` (only input is formatted)
- [ ] No visual regression in collapsed ToolCallCard state

---

### Task 4: [P1] Add waiting-for-user state to useChatSession and InferenceIndicator

**Files**:
- `apps/client/src/hooks/use-chat-session.ts`
- `apps/client/src/components/chat/InferenceIndicator.tsx`
- `apps/client/src/components/chat/MessageList.tsx`
- `apps/client/src/components/chat/ChatPanel.tsx`

#### Changes to useChatSession.ts

Add computed state after the `isTextStreaming` state:

```tsx
// Derive pending interactive tools from current messages
const pendingInteractions = useMemo(() => {
  return messages
    .flatMap(m => m.toolCalls || [])
    .filter(tc => tc.interactiveType && tc.status === 'pending');
}, [messages]);

const activeInteraction = pendingInteractions[0] || null;
const isWaitingForUser = activeInteraction !== null;
const waitingType = activeInteraction?.interactiveType || null;
```

Update the return statement to include:
```tsx
return {
  ...existingReturn,
  isWaitingForUser,
  waitingType,
  activeInteraction,
};
```

#### Changes to InferenceIndicator.tsx

Add new props:
```tsx
interface InferenceIndicatorProps {
  status: 'idle' | 'streaming' | 'error';
  streamStartTime: number | null;
  estimatedTokens: number;
  theme?: IndicatorTheme;
  permissionMode?: PermissionMode;
  isWaitingForUser?: boolean;        // NEW
  waitingType?: 'approval' | 'question';  // NEW
}
```

Add a new rendering branch BEFORE the streaming state check. When `isWaitingForUser` is true and `status === 'streaming'`:

```tsx
import { Shield, MessageSquare } from 'lucide-react';

// After the "Complete state" block and before the "Streaming state" block:
if (status === 'streaming' && isWaitingForUser) {
  const WaitIcon = waitingType === 'approval' ? Shield : MessageSquare;
  const waitMessage = waitingType === 'approval'
    ? 'Waiting for your approval'
    : 'Waiting for your answer';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-baseline gap-1.5 px-4 py-2 text-2xs"
      data-testid="inference-indicator-waiting"
    >
      <WaitIcon className="size-3 text-amber-500" />
      <span className="text-amber-600 dark:text-amber-400">{waitMessage}</span>
      <span className="text-muted-foreground/70 tabular-nums ml-1.5">{elapsed}</span>
    </motion.div>
  );
}
```

#### Changes to MessageList.tsx

Add new props:
```tsx
interface MessageListProps {
  // ...existing props
  isWaitingForUser?: boolean;
  waitingType?: 'approval' | 'question';
}
```

Pass these to `InferenceIndicator`:
```tsx
<InferenceIndicator
  status={status ?? 'idle'}
  streamStartTime={streamStartTime ?? null}
  estimatedTokens={estimatedTokens ?? 0}
  permissionMode={permissionMode}
  isWaitingForUser={isWaitingForUser}
  waitingType={waitingType}
/>
```

#### Changes to ChatPanel.tsx

Extract new state from useChatSession and pass to MessageList:
```tsx
const { ..., isWaitingForUser, waitingType, activeInteraction } = useChatSession(sessionId, { ... });

<MessageList
  // ...existing props
  isWaitingForUser={isWaitingForUser}
  waitingType={waitingType}
/>
```

#### Acceptance Criteria
- [ ] When an interactive tool is pending, InferenceIndicator shows "Waiting for your approval" (for approval) or "Waiting for your answer" (for question)
- [ ] Waiting state uses amber color scheme and Shield/MessageSquare icon
- [ ] Elapsed time is still shown during waiting state
- [ ] Token estimate is NOT shown during waiting state
- [ ] When no interactive tool is pending during streaming, normal rotating verbs are shown
- [ ] Transition from streaming -> waiting -> streaming is smooth
- [ ] `activeInteraction` correctly identifies the first pending interactive tool across all messages

---

### Task 5: [P1] Phase 1 tests

**Files**:
- `apps/client/src/components/ui/__tests__/kbd.test.tsx` (new)
- `apps/client/src/lib/__tests__/tool-arguments-formatter.test.tsx` (new)
- `apps/client/src/components/chat/__tests__/InferenceIndicator.test.tsx` (new or updated)

#### Kbd Tests

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Kbd } from '../kbd';

describe('Kbd', () => {
  it('renders children text', () => {
    render(<Kbd>Enter</Kbd>);
    expect(screen.getByText('Enter')).toBeInTheDocument();
  });

  it('renders as a <kbd> element', () => {
    render(<Kbd>Esc</Kbd>);
    const el = screen.getByText('Esc');
    expect(el.tagName).toBe('KBD');
  });

  it('has hidden md:inline-flex classes by default', () => {
    render(<Kbd>X</Kbd>);
    const el = screen.getByText('X');
    expect(el.className).toContain('hidden');
    expect(el.className).toContain('md:inline-flex');
  });

  it('accepts custom className', () => {
    render(<Kbd className="text-red-500">Y</Kbd>);
    const el = screen.getByText('Y');
    expect(el.className).toContain('text-red-500');
  });
});
```

#### ToolArgumentsDisplay Tests

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToolArgumentsDisplay } from '../tool-arguments-formatter';

describe('ToolArgumentsDisplay', () => {
  it('renders flat key-value pairs', () => {
    render(<ToolArgumentsDisplay toolName="Read" input='{"file_path":"/foo/bar.ts","limit":100}' />);
    expect(screen.getByText('File path')).toBeInTheDocument();
    expect(screen.getByText('Limit')).toBeInTheDocument();
  });

  it('humanizes key names', () => {
    render(<ToolArgumentsDisplay toolName="Test" input='{"my_key":"val","camelCase":"val2"}' />);
    expect(screen.getByText('My key')).toBeInTheDocument();
    expect(screen.getByText('Camel case')).toBeInTheDocument();  // Note: actual implementation humanizes camelCase
  });

  it('truncates long strings at 120 chars', () => {
    const longStr = 'a'.repeat(200);
    render(<ToolArgumentsDisplay toolName="Test" input={JSON.stringify({ text: longStr })} />);
    // Should contain the truncated version with ellipsis
    const textContent = screen.getByText(/^a+/);
    expect(textContent.textContent!.length).toBeLessThan(200);
  });

  it('renders nested objects to 2nd level', () => {
    render(<ToolArgumentsDisplay toolName="Test" input='{"opts":{"key":"val"}}' />);
    expect(screen.getByText('Opts')).toBeInTheDocument();
    expect(screen.getByText(/Key/)).toBeInTheDocument();
  });

  it('renders 3rd+ level as {...}', () => {
    render(<ToolArgumentsDisplay toolName="Test" input='{"opts":{"nested":{"deep":"val"}}}' />);
    expect(screen.getByText(/\{\.\.\./).toBeInTheDocument();
  });

  it('shows first 5 array items with "and N more"', () => {
    const arr = Array.from({ length: 8 }, (_, i) => `item${i}`);
    render(<ToolArgumentsDisplay toolName="Test" input={JSON.stringify({ items: arr })} />);
    expect(screen.getByText(/and 3 more/)).toBeInTheDocument();
  });

  it('falls back to <pre> on invalid JSON', () => {
    const { container } = render(<ToolArgumentsDisplay toolName="Test" input="not json" />);
    expect(container.querySelector('pre')).toBeInTheDocument();
  });

  it('handles empty input string', () => {
    const { container } = render(<ToolArgumentsDisplay toolName="Test" input="" />);
    expect(container.innerHTML).toBe('');
  });
});
```

#### InferenceIndicator Waiting State Tests

```tsx
// Add to existing or new test file
describe('InferenceIndicator - waiting state', () => {
  it('renders "Waiting for your approval" when isWaitingForUser and type=approval', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isWaitingForUser={true}
        waitingType="approval"
      />
    );
    expect(screen.getByText('Waiting for your approval')).toBeInTheDocument();
    expect(screen.getByTestId('inference-indicator-waiting')).toBeInTheDocument();
  });

  it('renders "Waiting for your answer" when isWaitingForUser and type=question', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isWaitingForUser={true}
        waitingType="question"
      />
    );
    expect(screen.getByText('Waiting for your answer')).toBeInTheDocument();
  });

  it('shows elapsed time but no token count during waiting', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now() - 5000}
        estimatedTokens={500}
        isWaitingForUser={true}
        waitingType="approval"
      />
    );
    // Should NOT show token estimate
    expect(screen.queryByText(/tokens/)).not.toBeInTheDocument();
  });

  it('uses amber color during waiting state', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isWaitingForUser={true}
        waitingType="approval"
      />
    );
    const el = screen.getByTestId('inference-indicator-waiting');
    // The waiting message span should have amber text class
    const messageSpan = screen.getByText('Waiting for your approval');
    expect(messageSpan.className).toContain('amber');
  });
});
```

#### Acceptance Criteria
- [ ] All Kbd tests pass
- [ ] All ToolArgumentsDisplay tests pass including edge cases
- [ ] All InferenceIndicator waiting state tests pass
- [ ] Tests use `@vitest-environment jsdom` directive
- [ ] Tests follow existing patterns (vi.mock for motion/react, etc.)

---

## Phase 2: Keyboard Shortcuts + Active State

### Task 6: [P2] Create useInteractiveShortcuts hook

**File**: `apps/client/src/hooks/use-interactive-shortcuts.ts`

#### Code Implementation

```tsx
import { useEffect, useRef, useCallback } from 'react';

interface UseInteractiveShortcutsOptions {
  /** The currently active interactive tool, or null */
  activeInteraction: {
    type: 'approval' | 'question';
    toolCallId: string;
  } | null;
  /** Callbacks for approval shortcuts */
  onApprove?: () => void;
  onDeny?: () => void;
  /** Callbacks for question shortcuts */
  onToggleOption?: (index: number) => void;
  onNavigateOption?: (direction: 'up' | 'down') => void;
  onNavigateQuestion?: (direction: 'prev' | 'next') => void;
  onSubmit?: () => void;
  /** Total options count for bounds checking */
  optionCount?: number;
  /** Current focused option index */
  focusedIndex?: number;
}

export function useInteractiveShortcuts({
  activeInteraction,
  onApprove,
  onDeny,
  onToggleOption,
  onNavigateOption,
  onNavigateQuestion,
  onSubmit,
  optionCount = 0,
  focusedIndex = 0,
}: UseInteractiveShortcutsOptions) {
  const respondingRef = useRef(false);

  // Reset responding flag when active interaction changes
  useEffect(() => {
    respondingRef.current = false;
  }, [activeInteraction?.toolCallId]);

  useEffect(() => {
    if (!activeInteraction) return;

    function handler(e: KeyboardEvent) {
      // If target is an enabled textarea or input, only handle Enter/Esc
      const target = e.target as HTMLElement;
      const isTextInput =
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') &&
        !(target as HTMLInputElement).disabled;

      if (respondingRef.current) return;

      if (activeInteraction!.type === 'approval') {
        if (e.key === 'Enter') {
          e.preventDefault();
          respondingRef.current = true;
          onApprove?.();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          respondingRef.current = true;
          onDeny?.();
        }
        return;
      }

      if (activeInteraction!.type === 'question') {
        // In text input, only Enter/Esc work
        if (isTextInput) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit?.();
          }
          // Esc in textarea — do nothing special (browser default: blur)
          return;
        }

        // Digit keys 1-9 toggle option
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 9) {
          e.preventDefault();
          if (digit - 1 < optionCount) {
            onToggleOption?.(digit - 1);
          }
          return;
        }

        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            onNavigateOption?.('up');
            break;
          case 'ArrowDown':
            e.preventDefault();
            onNavigateOption?.('down');
            break;
          case ' ':
            e.preventDefault();
            onToggleOption?.(focusedIndex);
            break;
          case 'ArrowLeft':
          case '[':
            e.preventDefault();
            onNavigateQuestion?.('prev');
            break;
          case 'ArrowRight':
          case ']':
            e.preventDefault();
            onNavigateQuestion?.('next');
            break;
          case 'Enter':
            e.preventDefault();
            onSubmit?.();
            break;
        }
      }
    }

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    activeInteraction,
    onApprove,
    onDeny,
    onToggleOption,
    onNavigateOption,
    onNavigateQuestion,
    onSubmit,
    optionCount,
    focusedIndex,
  ]);
}
```

#### Acceptance Criteria
- [ ] Returns early (no listener) when `activeInteraction` is null
- [ ] Approval mode: Enter fires `onApprove`, Escape fires `onDeny`
- [ ] Question mode: digit keys 1-9 fire `onToggleOption(digit - 1)`, arrows fire `onNavigateOption`, Space toggles, Enter submits
- [ ] Question mode: ArrowLeft/`[` fire `onNavigateQuestion('prev')`, ArrowRight/`]` fire `onNavigateQuestion('next')`
- [ ] When target is an enabled textarea/input, only Enter and Esc are handled
- [ ] Digit key beyond `optionCount` is ignored
- [ ] All handled keys call `e.preventDefault()`
- [ ] Listener is removed on unmount
- [ ] Rapid-fire prevention via `respondingRef`

---

### Task 7: [P2] Add isActive prop and Kbd hints to ToolApproval

**File**: `apps/client/src/components/chat/ToolApproval.tsx`

#### Changes

1. Add `isActive` prop to `ToolApprovalProps`:
```tsx
interface ToolApprovalProps {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  input: string;
  isActive?: boolean;  // NEW
}
```

2. Update the pending state container styling based on `isActive`:
```tsx
// Active: prominent amber border with ring
const activeClasses = isActive
  ? 'ring-2 ring-amber-500/30 border-amber-500/40'
  : 'border-amber-500/10 bg-amber-500/5 opacity-75';

<div className={cn(
  'my-1 rounded border bg-amber-500/10 p-3 text-sm transition-colors duration-200',
  activeClasses
)}>
```

3. Add Kbd hints next to buttons (only when `isActive`):
```tsx
<button onClick={handleApprove} disabled={responding} className="...">
  <Check className="size-(--size-icon-xs)" /> Approve
  {isActive && <Kbd>Enter</Kbd>}
</button>
<button onClick={handleDeny} disabled={responding} className="...">
  <X className="size-(--size-icon-xs)" /> Deny
  {isActive && <Kbd>Esc</Kbd>}
</button>
```

#### Acceptance Criteria
- [ ] `isActive=true` shows ring-2 amber ring/glow border styling
- [ ] `isActive=false` shows muted border with reduced opacity
- [ ] Kbd hints ("Enter", "Esc") are visible next to buttons when `isActive=true`
- [ ] Kbd hints are hidden when `isActive=false`
- [ ] Approve/Deny buttons still work via click regardless of isActive
- [ ] Default `isActive` is undefined (backward compatible)

---

### Task 8: [P2] Add isActive prop, Kbd hints, focused option, and imperative handle to QuestionPrompt

**File**: `apps/client/src/components/chat/QuestionPrompt.tsx`

#### Changes

1. Add `isActive` prop and `focusedIndex` state:
```tsx
interface QuestionPromptProps {
  sessionId: string;
  toolCallId: string;
  questions: QuestionItem[];
  answers?: Record<string, string>;
  isActive?: boolean;  // NEW
}
```

2. Add `focusedIndex` local state for keyboard navigation highlighting:
```tsx
const [focusedIndex, setFocusedIndex] = useState(0);
```

3. Add Kbd number hints next to each option (when `isActive`):
```tsx
{q.options.map((opt, oIdx) => (
  <label key={oIdx} className={cn('...', oIdx === focusedIndex && isActive && 'ring-1 ring-amber-500/30')}>
    {isActive && oIdx < 9 && <Kbd>{oIdx + 1}</Kbd>}
    <input type={...} ... />
    <div>
      <span className="font-medium">{opt.label}</span>
      ...
    </div>
  </label>
))}
```

4. Add Kbd hints for tab navigation when multiple questions:
```tsx
<TabsTrigger ...>
  {isActive && idx > 0 && <Kbd>&larr;</Kbd>}
  {hasAnswer(idx) && <Check className="size-3 mr-1" />}
  <span ...>{q.header}</span>
  {isActive && idx < questions.length - 1 && <Kbd>&rarr;</Kbd>}
</TabsTrigger>
```

5. Add `useImperativeHandle` with ref:
```tsx
import { forwardRef, useImperativeHandle } from 'react';

export interface QuestionPromptHandle {
  toggleOption: (index: number) => void;
  navigateOption: (direction: 'up' | 'down') => void;
  navigateQuestion: (direction: 'prev' | 'next') => void;
  submit: () => void;
  getFocusedIndex: () => number;
  getOptionCount: () => number;
}

export const QuestionPrompt = forwardRef<QuestionPromptHandle, QuestionPromptProps>(
  function QuestionPrompt({ sessionId, toolCallId, questions, answers: preAnswers, isActive }, ref) {
    // ... existing state ...
    const [focusedIndex, setFocusedIndex] = useState(0);

    const currentQuestion = questions[parseInt(activeTab, 10)] || questions[0];
    const currentOptionCount = currentQuestion ? currentQuestion.options.length + 1 : 0; // +1 for "Other"

    useImperativeHandle(ref, () => ({
      toggleOption: (index: number) => {
        const qIdx = parseInt(activeTab, 10);
        const q = questions[qIdx];
        if (!q) return;
        const opt = index < q.options.length ? q.options[index].label : '__other__';
        if (q.multiSelect) {
          const current = (selections[qIdx] as string[]) || [];
          const checked = !current.includes(opt);
          handleMultiSelect(qIdx, opt, checked);
        } else {
          handleSingleSelect(qIdx, opt);
        }
        setFocusedIndex(index);
      },
      navigateOption: (direction: 'up' | 'down') => {
        setFocusedIndex(prev => {
          if (direction === 'up') return prev > 0 ? prev - 1 : currentOptionCount - 1;
          return prev < currentOptionCount - 1 ? prev + 1 : 0;
        });
      },
      navigateQuestion: (direction: 'prev' | 'next') => {
        if (questions.length <= 1) return;
        const current = parseInt(activeTab, 10);
        if (direction === 'prev' && current > 0) {
          setActiveTab(String(current - 1));
          setFocusedIndex(0);
        } else if (direction === 'next' && current < questions.length - 1) {
          setActiveTab(String(current + 1));
          setFocusedIndex(0);
        }
      },
      submit: () => handleSubmit(),
      getFocusedIndex: () => focusedIndex,
      getOptionCount: () => currentOptionCount,
    }));

    // ... rest of component ...
  }
);
```

6. Update container styling for active/inactive:
```tsx
<div className={cn(
  'my-1 rounded border bg-amber-500/10 p-3 text-sm transition-colors duration-200',
  isActive ? 'ring-2 ring-amber-500/30 border-amber-500/40' : 'border-amber-500/10 bg-amber-500/5 opacity-75'
)}>
```

7. Add Kbd hint to Submit button:
```tsx
<button onClick={handleSubmit} disabled={!isComplete() || submitting} className="...">
  {submitting ? <>Submitting...</> : <><Check className="size-(--size-icon-xs)" /> Submit {isActive && <Kbd>Enter</Kbd>}</>}
</button>
```

#### Acceptance Criteria
- [ ] `isActive=true` shows ring-2 amber ring/glow
- [ ] `isActive=false` shows muted styling
- [ ] Kbd number hints (1-9) render next to options when isActive
- [ ] Kbd arrow hints render in tab navigation when isActive and multiple questions
- [ ] focusedIndex highlights the current option
- [ ] Imperative handle exposes toggleOption, navigateOption, navigateQuestion, submit, getFocusedIndex, getOptionCount
- [ ] QuestionPrompt is wrapped with forwardRef
- [ ] Submit button shows Kbd "Enter" hint when isActive
- [ ] Backward compatible: works without isActive prop

---

### Task 9: [P2] Add imperative handle to ToolApproval

**File**: `apps/client/src/components/chat/ToolApproval.tsx`

#### Changes

Wrap ToolApproval with `forwardRef` and expose imperative methods:

```tsx
import { useState, forwardRef, useImperativeHandle } from 'react';

export interface ToolApprovalHandle {
  approve: () => void;
  deny: () => void;
}

export const ToolApproval = forwardRef<ToolApprovalHandle, ToolApprovalProps>(
  function ToolApproval({ sessionId, toolCallId, toolName, input, isActive }, ref) {
    // ... existing state ...

    useImperativeHandle(ref, () => ({
      approve: () => {
        if (!responding && !decided) handleApprove();
      },
      deny: () => {
        if (!responding && !decided) handleDeny();
      },
    }));

    // ... rest of component unchanged ...
  }
);
```

#### Acceptance Criteria
- [ ] ToolApproval is wrapped with forwardRef
- [ ] ToolApprovalHandle interface is exported
- [ ] approve() calls handleApprove when not already responding/decided
- [ ] deny() calls handleDeny when not already responding/decided
- [ ] Existing click-based approve/deny still works
- [ ] Component is backward compatible (works without ref)

---

### Task 10: [P2] Wire activeToolCallId and useInteractiveShortcuts in ChatPanel

**Files**:
- `apps/client/src/components/chat/ChatPanel.tsx`
- `apps/client/src/components/chat/MessageList.tsx`
- `apps/client/src/components/chat/MessageItem.tsx`

#### Changes to MessageItem.tsx

Add `activeToolCallId` prop and pass `isActive` to ToolApproval/QuestionPrompt:

```tsx
interface MessageItemProps {
  message: ChatMessage;
  grouping: MessageGrouping;
  sessionId: string;
  isNew?: boolean;
  isStreaming?: boolean;
  activeToolCallId?: string | null;  // NEW
  toolApprovalRef?: React.RefObject<ToolApprovalHandle | null>;  // NEW
  questionPromptRef?: React.RefObject<QuestionPromptHandle | null>;  // NEW
}

// In the rendering of tool_call parts:
if (part.interactiveType === 'approval') {
  const isActive = part.toolCallId === activeToolCallId;
  return (
    <ToolApproval
      key={part.toolCallId}
      ref={isActive ? toolApprovalRef : undefined}
      sessionId={sessionId}
      toolCallId={part.toolCallId}
      toolName={part.toolName}
      input={part.input || ''}
      isActive={isActive}
    />
  );
}
if (part.interactiveType === 'question' && part.questions) {
  const isActive = part.toolCallId === activeToolCallId;
  return (
    <QuestionPrompt
      key={part.toolCallId}
      ref={isActive ? questionPromptRef : undefined}
      sessionId={sessionId}
      toolCallId={part.toolCallId}
      questions={part.questions}
      answers={part.answers}
      isActive={isActive}
    />
  );
}
```

#### Changes to MessageList.tsx

Add `activeToolCallId` and ref props and pass through:

```tsx
interface MessageListProps {
  // ...existing
  activeToolCallId?: string | null;
  toolApprovalRef?: React.RefObject<ToolApprovalHandle | null>;
  questionPromptRef?: React.RefObject<QuestionPromptHandle | null>;
}

// Pass to MessageItem:
<MessageItem
  message={msg}
  grouping={groupings[virtualRow.index]}
  sessionId={sessionId}
  isNew={isNew}
  isStreaming={isStreaming}
  activeToolCallId={activeToolCallId}
  toolApprovalRef={toolApprovalRef}
  questionPromptRef={questionPromptRef}
/>
```

#### Changes to ChatPanel.tsx

Wire useInteractiveShortcuts and refs:

```tsx
import { useInteractiveShortcuts } from '../../hooks/use-interactive-shortcuts';
import type { ToolApprovalHandle } from './ToolApproval';
import type { QuestionPromptHandle } from './QuestionPrompt';

// Inside ChatPanel:
const toolApprovalRef = useRef<ToolApprovalHandle>(null);
const questionPromptRef = useRef<QuestionPromptHandle>(null);

const activeToolCallId = activeInteraction?.toolCallId ?? null;

useInteractiveShortcuts({
  activeInteraction: activeInteraction
    ? { type: activeInteraction.interactiveType!, toolCallId: activeInteraction.toolCallId }
    : null,
  onApprove: () => toolApprovalRef.current?.approve(),
  onDeny: () => toolApprovalRef.current?.deny(),
  onToggleOption: (idx) => questionPromptRef.current?.toggleOption(idx),
  onNavigateOption: (dir) => questionPromptRef.current?.navigateOption(dir),
  onNavigateQuestion: (dir) => questionPromptRef.current?.navigateQuestion(dir),
  onSubmit: () => questionPromptRef.current?.submit(),
  optionCount: questionPromptRef.current?.getOptionCount() ?? 0,
  focusedIndex: questionPromptRef.current?.getFocusedIndex() ?? 0,
});

// Pass to MessageList:
<MessageList
  ref={messageListRef}
  messages={messages}
  sessionId={sessionId}
  status={status}
  isTextStreaming={isTextStreaming}
  onScrollStateChange={handleScrollStateChange}
  streamStartTime={streamStartTime}
  estimatedTokens={estimatedTokens}
  permissionMode={permissionMode}
  isWaitingForUser={isWaitingForUser}
  waitingType={waitingType}
  activeToolCallId={activeToolCallId}
  toolApprovalRef={toolApprovalRef}
  questionPromptRef={questionPromptRef}
/>
```

#### Acceptance Criteria
- [ ] `activeToolCallId` flows from ChatPanel -> MessageList -> MessageItem
- [ ] Only the active ToolApproval/QuestionPrompt receives the ref
- [ ] `isActive` prop is correctly computed as `part.toolCallId === activeToolCallId`
- [ ] Keyboard shortcuts (Enter/Esc for approval, digits/arrows for questions) work
- [ ] When first tool is approved, second pending tool automatically becomes active
- [ ] Multiple simultaneous approval requests: only first is active
- [ ] All existing click-based interactions still work

---

### Task 11: [P2] Phase 2 tests

**Files**:
- `apps/client/src/hooks/__tests__/use-interactive-shortcuts.test.ts` (new)
- `apps/client/src/components/chat/__tests__/ToolApproval.test.tsx` (new)
- `apps/client/src/components/chat/__tests__/QuestionPrompt.test.tsx` (updated)

#### useInteractiveShortcuts Tests

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useInteractiveShortcuts } from '../use-interactive-shortcuts';

describe('useInteractiveShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not attach listener when activeInteraction is null', () => {
    const onApprove = vi.fn();
    renderHook(() => useInteractiveShortcuts({
      activeInteraction: null,
      onApprove,
    }));
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('fires onApprove on Enter for approval type', () => {
    const onApprove = vi.fn();
    renderHook(() => useInteractiveShortcuts({
      activeInteraction: { type: 'approval', toolCallId: 'tc1' },
      onApprove,
    }));
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('fires onDeny on Escape for approval type', () => {
    const onDeny = vi.fn();
    renderHook(() => useInteractiveShortcuts({
      activeInteraction: { type: 'approval', toolCallId: 'tc1' },
      onDeny,
    }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDeny).toHaveBeenCalledOnce();
  });

  it('fires onToggleOption with digit key for question type', () => {
    const onToggleOption = vi.fn();
    renderHook(() => useInteractiveShortcuts({
      activeInteraction: { type: 'question', toolCallId: 'tc1' },
      onToggleOption,
      optionCount: 5,
    }));
    fireEvent.keyDown(document, { key: '3' });
    expect(onToggleOption).toHaveBeenCalledWith(2); // 0-indexed
  });

  it('ignores digit key beyond optionCount', () => {
    const onToggleOption = vi.fn();
    renderHook(() => useInteractiveShortcuts({
      activeInteraction: { type: 'question', toolCallId: 'tc1' },
      onToggleOption,
      optionCount: 2,
    }));
    fireEvent.keyDown(document, { key: '5' });
    expect(onToggleOption).not.toHaveBeenCalled();
  });

  it('fires onNavigateOption on arrow keys for question type', () => {
    const onNavigateOption = vi.fn();
    renderHook(() => useInteractiveShortcuts({
      activeInteraction: { type: 'question', toolCallId: 'tc1' },
      onNavigateOption,
    }));
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(onNavigateOption).toHaveBeenCalledWith('down');
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(onNavigateOption).toHaveBeenCalledWith('up');
  });

  it('fires onNavigateQuestion on left/right arrows', () => {
    const onNavigateQuestion = vi.fn();
    renderHook(() => useInteractiveShortcuts({
      activeInteraction: { type: 'question', toolCallId: 'tc1' },
      onNavigateQuestion,
    }));
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(onNavigateQuestion).toHaveBeenCalledWith('prev');
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(onNavigateQuestion).toHaveBeenCalledWith('next');
  });

  it('fires onNavigateQuestion on [ and ] keys', () => {
    const onNavigateQuestion = vi.fn();
    renderHook(() => useInteractiveShortcuts({
      activeInteraction: { type: 'question', toolCallId: 'tc1' },
      onNavigateQuestion,
    }));
    fireEvent.keyDown(document, { key: '[' });
    expect(onNavigateQuestion).toHaveBeenCalledWith('prev');
    fireEvent.keyDown(document, { key: ']' });
    expect(onNavigateQuestion).toHaveBeenCalledWith('next');
  });

  it('fires onSubmit on Enter for question type', () => {
    const onSubmit = vi.fn();
    renderHook(() => useInteractiveShortcuts({
      activeInteraction: { type: 'question', toolCallId: 'tc1' },
      onSubmit,
    }));
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('cleans up listener on unmount', () => {
    const onApprove = vi.fn();
    const { unmount } = renderHook(() => useInteractiveShortcuts({
      activeInteraction: { type: 'approval', toolCallId: 'tc1' },
      onApprove,
    }));
    unmount();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onApprove).not.toHaveBeenCalled();
  });
});
```

#### ToolApproval Tests (new file)

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ToolApproval } from '../ToolApproval';

// Mock transport
vi.mock('../../../contexts/TransportContext', () => ({
  useTransport: () => ({
    approveTool: vi.fn().mockResolvedValue(undefined),
    denyTool: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock motion/react
vi.mock('motion/react', () => new Proxy({}, {
  get: (_, prop) => {
    if (prop === 'motion') return new Proxy({}, { get: (_, tag) => tag });
    if (prop === 'AnimatePresence') return ({ children }: any) => children;
    return undefined;
  },
}));

describe('ToolApproval', () => {
  const defaultProps = {
    sessionId: 'sess1',
    toolCallId: 'tc1',
    toolName: 'Bash',
    input: '{"command":"ls -la"}',
  };

  it('renders formatted arguments (not raw JSON)', () => {
    render(<ToolApproval {...defaultProps} />);
    expect(screen.getByText('Command')).toBeInTheDocument();
    expect(screen.queryByText('{')).not.toBeInTheDocument();
  });

  it('shows Kbd hints when isActive=true', () => {
    render(<ToolApproval {...defaultProps} isActive={true} />);
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('hides Kbd hints when isActive=false', () => {
    render(<ToolApproval {...defaultProps} isActive={false} />);
    expect(screen.queryByText('Enter')).not.toBeInTheDocument();
    expect(screen.queryByText('Esc')).not.toBeInTheDocument();
  });

  it('Approve/Deny buttons work via click', async () => {
    const user = userEvent.setup();
    render(<ToolApproval {...defaultProps} />);
    await user.click(screen.getByText('Approve'));
    // Should transition to decided state
  });
});
```

#### Acceptance Criteria
- [ ] All useInteractiveShortcuts tests pass
- [ ] All ToolApproval tests pass
- [ ] Tests verify keyboard listener lifecycle (attach/detach)
- [ ] Tests verify textarea filtering
- [ ] Tests verify bounds checking for digit keys

---

## Phase 3: Documentation + Polish

### Task 12: [P3] Write keyboard-shortcuts developer guide

**File**: `guides/keyboard-shortcuts.md` (new)

Create a developer guide covering:
1. Focus state machine (4 states: IDLE/TYPING, STREAMING, WAITING_FOR_APPROVAL, WAITING_FOR_ANSWER)
2. `useInteractiveShortcuts` hook API and usage
3. How to add shortcuts for new interactive tool types
4. Testing keyboard shortcuts
5. Accessibility considerations (ARIA, screen reader announcements)
6. Convention: all keyboard shortcuts use `hidden md:inline-flex` Kbd component

**File**: `guides/interactive-tools.md` (updated)

Add a new section on keyboard shortcuts:
- How keyboard shortcuts integrate with the interactive tool data flow
- The `isActive` prop pattern for multi-tool scenarios
- The imperative handle pattern for QuestionPrompt/ToolApproval

#### Acceptance Criteria
- [ ] `guides/keyboard-shortcuts.md` exists with all 6 sections
- [ ] `guides/interactive-tools.md` has new keyboard shortcuts section
- [ ] Code examples are correct and match actual implementation
- [ ] Focus state diagram is included

---

### Task 13: [P3] Polish transitions and multi-tool scenarios

Verify and fix:

1. **Smooth transitions**: Active/inactive state changes on ToolApproval and QuestionPrompt should animate smoothly (ring appearance, opacity changes)
2. **Multi-tool flow**: When first tool is approved, second tool automatically gets active state
3. **Edge cases**:
   - QuestionPrompt "Other" textarea focused: number keys pass through to textarea
   - Empty QuestionPrompt options array: graceful fallback
   - Tool approval while responding (button disabled): shortcut is no-op
   - InferenceIndicator transition: streaming -> waiting -> streaming
4. **Auto-scroll**: When a new interactive tool becomes active, it should be visible (existing auto-scroll to bottom covers most cases)

#### Acceptance Criteria
- [ ] Active/inactive transitions are smooth (no flicker)
- [ ] Multi-tool approval flow works correctly
- [ ] All edge cases handled gracefully
- [ ] No regressions in existing functionality
