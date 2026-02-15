---
slug: interactive-tool-ux
---

# Specification: Interactive Tool UX Improvements

## 1. Title

**Interactive Tool UX: Formatted Arguments, Waiting Status, and Keyboard Shortcuts**

## 2. Status

Draft

## 3. Authors

- Claude Code — 2026-02-13

## 4. Overview

Enhance the user experience for interactive tool calls (ToolApproval and QuestionPrompt) with three coordinated improvements:

1. **Formatted JSON display** — Replace raw `JSON.stringify` output with a context-aware key-value renderer
2. **"Waiting for response" status** — Replace rotating inference verbs with clear action-required messaging when interactive tools are pending
3. **Keyboard shortcuts** — Add Enter/Esc for approve/deny, number keys and arrows for question selection, with Kbd component hints hidden on mobile

## 5. Background / Problem Statement

When Claude's agent SDK pauses execution for user input (tool approval or AskUserQuestion), the current UI has three friction points:

1. **Raw JSON is hard to scan.** Both `ToolApproval` and `ToolCallCard` render tool arguments as `JSON.stringify(parsed, null, 2)` inside a `<pre>` block. Users must mentally parse curly braces, quotes, and commas to understand what the tool wants to do.

2. **Status messaging is misleading.** The `InferenceIndicator` continues showing rotating verbs ("Contemplating...", "Reasoning...") even when the system is blocked waiting for the user's approval or answer. There is no visual distinction between "AI is thinking" and "system needs your input."

3. **Mouse-only interaction is slow.** Approving a tool requires clicking a small button. Answering questions requires clicking radio buttons. Power users who interact with many tool calls per session lose significant time reaching for the mouse.

## 6. Goals

- Replace raw JSON with human-readable key-value formatting (top-level + one level of nesting, truncated when long)
- Show a clear, distinct "Waiting for your approval" / "Waiting for your answer" status that replaces inference verbs
- Add keyboard shortcuts: Enter/Esc for approve/deny, 1-9/arrows/Space for question selection, Enter to submit
- Display shortcut hints via a Kbd component, hidden on mobile
- Visually distinguish the "active" (shortcut-target) interactive tool from any subsequent pending ones
- Document the keyboard shortcut framework in a developer guide

## 7. Non-Goals

- Server-side or SDK changes
- New interactive tool types
- Auto-approve/deny rules or policies
- Command palette for tool actions
- Persisting shortcut preferences across sessions
- Adding third-party libraries (focus-trap-react, json-view)
- Desktop app command palette for tool selection

## 8. Technical Dependencies

- **motion/react** (motion.dev, already installed) — Animations for status transitions
- **lucide-react** (already installed) — Icons for status indicators
- **@tanstack/react-virtual** (already installed) — Virtualizer in MessageList (context for scroll-to-active behavior)
- **No new dependencies required**

Relevant documentation:

- `guides/interactive-tools.md` — Architecture of deferred promise pattern and interactive tool data flow
- `guides/architecture.md` — Transport interface, hexagonal architecture
- `guides/design-system.md` — Color palette, typography, spacing

## 9. Detailed Design

### 9.1 Architecture: Focus State Machine

The chat textarea is `disabled={isLoading}` during streaming (`ChatInput.tsx:191`). Interactive tools only appear during streaming (the SSE connection is open, keeping `isLoading=true`). This means global keyboard shortcuts can be attached without conflicting with text input.

```
┌──────────────────────────────────────────────────────────┐
│                   FOCUS STATES                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. IDLE / TYPING                                        │
│     ChatInput has focus. No global shortcuts active.     │
│     Enter = submit message, Esc = clear/close palette    │
│                                                          │
│  2. STREAMING (no interactive tool)                      │
│     ChatInput disabled. InferenceIndicator shows verbs.  │
│     No interactive shortcuts needed.                     │
│                                                          │
│  3. WAITING_FOR_APPROVAL                                 │
│     ChatInput disabled. Global shortcuts active:         │
│     Enter = Approve, Esc = Deny                          │
│     InferenceIndicator → "Waiting for your approval"     │
│                                                          │
│  4. WAITING_FOR_ANSWER                                   │
│     ChatInput disabled. Global shortcuts active:         │
│     1-9 = toggle option, ↑↓ = navigate, Space = toggle  │
│     ←→ or [/] = switch question tab, Enter = submit     │
│     InferenceIndicator → "Waiting for your answer"       │
│                                                          │
│  Exception: If QuestionPrompt's "Other" <textarea> is    │
│  focused, all shortcuts except Enter (submit) and        │
│  Esc (cancel) are disabled to allow typing.              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 9.2 New Files

#### `apps/client/src/components/ui/kbd.tsx`

Shadcn/ui-style Kbd component:

```tsx
import { cn } from '@/lib/utils';

function Kbd({ className, children, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'bg-muted text-muted-foreground pointer-events-none hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none md:inline-flex',
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

export { Kbd };
```

The `hidden md:inline-flex` ensures Kbd hints are invisible on mobile (no physical keyboard) and visible on desktop.

#### `apps/client/src/hooks/use-interactive-shortcuts.ts`

Custom hook managing the keyboard shortcut lifecycle:

```tsx
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
  onSelectOption?: (index: number) => void;
  onToggleOption?: (index: number) => void;
  onNavigateOption?: (direction: 'up' | 'down') => void;
  onNavigateQuestion?: (direction: 'prev' | 'next') => void;
  onSubmit?: () => void;
  /** Total options count for bounds checking */
  optionCount?: number;
  /** Current focused option index */
  focusedIndex?: number;
}
```

The hook:

1. Returns early (no listener) when `activeInteraction` is null
2. Attaches a `document.addEventListener('keydown', handler)` in a `useEffect`
3. Inside the handler, checks `event.target` — if it's an enabled `<textarea>` or `<input>`, only Enter and Esc are handled (all others pass through for typing)
4. For approval: Enter → `onApprove()`, Escape → `onDeny()`
5. For question: digit keys → `onToggleOption(digit - 1)`, ArrowUp/ArrowDown → `onNavigateOption()`, Space → `onToggleOption(focusedIndex)`, ArrowLeft/ArrowRight or `[`/`]` → `onNavigateQuestion()`, Enter → `onSubmit()`
6. All handled keys call `e.preventDefault()` to suppress default browser behavior
7. Cleans up listener on unmount or when `activeInteraction` changes

#### `apps/client/src/lib/tool-arguments-formatter.tsx`

A React component that renders tool arguments as formatted key-value pairs:

```tsx
interface ToolArgumentsDisplayProps {
  toolName: string;
  input: string; // JSON string
}
```

Rendering logic:

1. Parse JSON. If parse fails, fall back to plain `<pre>` (current behavior).
2. For each top-level key:
   - Render key as a label (humanized: `file_path` → `File path`, `command` → `Command`)
   - Render value based on type:
     - **string**: Truncate at 120 chars with ellipsis. Wrap in `<code>` for paths/commands.
     - **number/boolean/null**: Render directly with type-appropriate styling.
     - **object** (2nd level): Render nested keys as indented sub-rows, values truncated at 80 chars. Do NOT recurse deeper — render 3rd+ level as `{...}`.
     - **array**: Show first 5 items, then `... and N more`. Items themselves follow the same rules.
3. Use a `<dl>` (description list) for semantic markup. Style with Tailwind grid for alignment.

### 9.3 Modified Files

#### `apps/client/src/components/chat/ToolApproval.tsx`

Changes:

1. Replace `<pre>{JSON.stringify(...)}</pre>` with `<ToolArgumentsDisplay toolName={toolName} input={input} />`
2. Add `isActive` prop (boolean) — when true, show amber ring/glow border; when false, show muted border and hide Kbd hints
3. Add Kbd hints next to buttons: `Approve <Kbd>Enter</Kbd>` and `Deny <Kbd>Esc</Kbd>`
4. Only show Kbd hints when `isActive` is true

New props:

```tsx
interface ToolApprovalProps {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  input: string;
  isActive?: boolean; // NEW: whether this is the shortcut target
}
```

Active state styling:

```tsx
// Active: prominent amber border with ring
'ring-2 ring-amber-500/30 border-amber-500/40';

// Inactive: muted border, same as current but dimmed
'border-amber-500/10 bg-amber-500/5 opacity-75';
```

#### `apps/client/src/components/chat/QuestionPrompt.tsx`

Changes:

1. Add `isActive` prop
2. Add Kbd number hints next to each option: `<Kbd>1</Kbd>` next to first option, etc.
3. Add Kbd hints for tab navigation: `<Kbd>←</Kbd>` / `<Kbd>→</Kbd>` next to tab triggers
4. Add visual highlight for the currently focused option (via `focusedIndex` state managed by the hook)
5. Add validation: disable Submit button and show subtle warning when no option selected
6. Only show Kbd hints when `isActive` is true

New props:

```tsx
interface QuestionPromptProps {
  sessionId: string;
  toolCallId: string;
  questions: QuestionItem[];
  answers?: Record<string, string>;
  isActive?: boolean; // NEW
}
```

#### `apps/client/src/components/chat/ToolCallCard.tsx`

Changes:

1. Replace `<pre>{JSON.stringify(...)}</pre>` with `<ToolArgumentsDisplay toolName={toolCall.toolName} input={toolCall.input} />`
2. No keyboard shortcuts needed — ToolCallCard is not interactive

#### `apps/client/src/components/chat/InferenceIndicator.tsx`

Changes:

1. Add `isWaitingForUser` prop and `waitingType` prop:
   ```tsx
   interface InferenceIndicatorProps {
     status: 'idle' | 'streaming' | 'error';
     streamStartTime: number | null;
     estimatedTokens: number;
     theme?: IndicatorTheme;
     permissionMode?: PermissionMode;
     isWaitingForUser?: boolean; // NEW
     waitingType?: 'approval' | 'question'; // NEW
   }
   ```
2. When `isWaitingForUser` is true, render a static message instead of rotating verbs:
   - `waitingType === 'approval'`: "Waiting for your approval" with Shield icon
   - `waitingType === 'question'`: "Waiting for your answer" with MessageSquare icon
3. Use amber color scheme (matching the interactive tool cards) instead of the default muted color
4. Still show elapsed time (how long the system has been waiting)
5. No token estimate shown during waiting (tokens aren't being generated)

#### `apps/client/src/hooks/use-chat-session.ts`

Changes:

1. Derive and expose new computed state:

   ```tsx
   // Find the first pending interactive tool call across all messages
   const pendingInteractions = messages
     .flatMap((m) => m.toolCalls || [])
     .filter((tc) => tc.interactiveType && tc.status === 'pending' && !tc.decided);

   const activeInteraction = pendingInteractions[0] || null;
   const isWaitingForUser = activeInteraction !== null;
   const waitingType = activeInteraction?.interactiveType || null;
   ```

2. Return `isWaitingForUser`, `waitingType`, and `activeInteraction` from the hook

Note: `decided` is not currently on `ToolCallState`. The ToolApproval component tracks decided state internally. We need to consider whether the "decided" state should be lifted to `ToolCallState` or whether we filter by checking if the ToolApproval/QuestionPrompt has already submitted. The simpler approach: the component calls a callback to mark the tool as no longer pending, which removes it from `pendingInteractions`.

#### `apps/client/src/components/chat/MessageItem.tsx`

Changes:

1. Accept `activeToolCallId` prop (string | null) — the toolCallId of the currently active interactive tool
2. Pass `isActive={tc.toolCallId === activeToolCallId}` to `ToolApproval` and `QuestionPrompt`
3. Thread from `MessageList` → `MessageItem` via props

#### `apps/client/src/components/chat/MessageList.tsx`

Changes:

1. Accept `activeToolCallId` prop from parent (ChatPanel)
2. Pass through to each `MessageItem`

#### `apps/client/src/components/chat/ChatPanel.tsx`

Changes:

1. Extract `activeInteraction`, `isWaitingForUser`, `waitingType` from `useChatSession`
2. Pass `activeToolCallId={activeInteraction?.toolCallId}` to `MessageList`
3. Pass `isWaitingForUser` and `waitingType` to `InferenceIndicator` (via MessageList)
4. Call `useInteractiveShortcuts` with the active interaction and appropriate callbacks
5. The callbacks will need to call transport methods (approve/deny/submit) — these are wired through refs or callbacks passed down

### 9.4 Data Flow for Keyboard Shortcuts

```
ChatPanel
  ├── useChatSession() → { activeInteraction, isWaitingForUser, waitingType }
  ├── useInteractiveShortcuts({
  │     activeInteraction,
  │     onApprove: () => transport.approveTool(sessionId, activeInteraction.toolCallId),
  │     onDeny: () => transport.denyTool(sessionId, activeInteraction.toolCallId),
  │     onToggleOption: (idx) => questionRef.current?.toggleOption(idx),
  │     onSubmit: () => questionRef.current?.submit(),
  │     ...
  │   })
  ├── <MessageList activeToolCallId={activeInteraction?.toolCallId}>
  │     ├── <MessageItem activeToolCallId={...}>
  │     │     ├── <ToolApproval isActive={true/false} />
  │     │     └── <QuestionPrompt isActive={true/false} />
  │     └── <InferenceIndicator isWaitingForUser={true} waitingType="approval" />
  └── ...
```

**Challenge: ChatPanel doesn't directly control QuestionPrompt's state.**

QuestionPrompt manages its own selections/submissions internally. For keyboard shortcuts to toggle options, we need a way for the hook (in ChatPanel) to communicate with QuestionPrompt.

**Solution: Imperative handle via `useImperativeHandle`**

QuestionPrompt exposes a ref with methods:

```tsx
export interface QuestionPromptHandle {
  toggleOption: (index: number) => void;
  navigateOption: (direction: 'up' | 'down') => void;
  navigateQuestion: (direction: 'prev' | 'next') => void;
  submit: () => void;
  getFocusedIndex: () => number;
  getOptionCount: () => number;
}
```

ChatPanel holds a `questionPromptRef` and passes it down through MessageList → MessageItem → QuestionPrompt. The hook calls methods on this ref.

Similarly, ToolApproval exposes:

```tsx
export interface ToolApprovalHandle {
  approve: () => void;
  deny: () => void;
}
```

This avoids lifting all QuestionPrompt state to ChatPanel while still enabling keyboard-driven interaction.

### 9.5 Active Tool Identification and Scroll-to-Active

When a new interactive tool becomes active (first pending), the UI should:

1. Mark it with the active visual style (ring/glow)
2. Auto-scroll to it if not in viewport (the auto-scroll mechanism already scrolls to bottom on new content, which covers most cases)

When the active tool is resolved (approved/denied/answered), the next pending tool (if any) automatically becomes active because `activeInteraction` recalculates as `pendingInteractions[0]`.

## 10. User Experience

### Desktop Flow

1. User sends a message. Claude starts processing.
2. A tool call requires approval. The ToolApproval card appears with:
   - Formatted arguments (key-value, not raw JSON)
   - Amber ring indicating it's the active tool
   - "Approve `Enter`" and "Deny `Esc`" buttons with Kbd hints
3. The InferenceIndicator changes from rotating verbs to "Waiting for your approval"
4. User presses Enter → tool approved. If another tool needs approval, it becomes active.
5. For AskUserQuestion: options show `1`, `2`, `3` Kbd hints. User presses `2` to select option 2, then Enter to submit.

### Mobile Flow

Same as desktop but:

- No Kbd hints shown (no physical keyboard)
- All interaction is tap-based (buttons, radio buttons)
- Touch-friendly button sizes maintained (existing `max-md:py-2` on buttons)

### Multi-Approval Scenario

1. Two tools need approval simultaneously (SDK can call `canUseTool` concurrently)
2. First tool shows active state (amber ring, Kbd hints)
3. Second tool shows inactive state (muted border, no Kbd hints, must click)
4. User presses Enter → first tool approved
5. Second tool automatically becomes active (ring appears, Kbd hints show)

## 11. Testing Strategy

### Unit Tests

#### `apps/client/src/components/ui/__tests__/kbd.test.tsx`

- Renders children text
- Applies `hidden md:inline-flex` by default
- Accepts custom className override
- Renders as `<kbd>` element

#### `apps/client/src/hooks/__tests__/use-interactive-shortcuts.test.ts`

- **Approval shortcuts**: Enter fires onApprove, Escape fires onDeny
- **Question shortcuts**: digit keys fire onToggleOption with correct index, arrows fire onNavigateOption, Space fires onToggleOption, Enter fires onSubmit
- **Question tab navigation**: Left/Right arrows fire onNavigateQuestion, `[`/`]` fire onNavigateQuestion
- **No listener when inactive**: when activeInteraction is null, no callbacks fire
- **Textarea filtering**: when event target is an enabled textarea, only Enter/Esc are handled
- **Bounds checking**: digit key beyond optionCount is ignored
- **Cleanup**: listener removed on unmount
- **Rapid-fire prevention**: callback not called if already responding

#### `apps/client/src/lib/__tests__/tool-arguments-formatter.test.tsx`

- Renders flat key-value pairs
- Humanizes key names (`file_path` → `File path`)
- Truncates long strings at 120 chars
- Renders nested objects to 2nd level
- Renders 3rd+ level as `{...}`
- Shows first 5 array items with "and N more"
- Falls back to `<pre>` on invalid JSON
- Handles empty input string

#### Updated: `apps/client/src/components/chat/__tests__/ToolApproval.test.tsx` (new file)

- Renders formatted arguments (not raw JSON)
- Shows Kbd hints when isActive=true
- Hides Kbd hints when isActive=false
- Active state has ring styling
- Inactive state has muted styling
- Approve/Deny buttons still work via click

#### Updated: `apps/client/src/components/chat/__tests__/QuestionPrompt.test.tsx`

- Existing tests continue to pass
- New: Kbd number hints render next to options when isActive
- New: Kbd hints hidden when isActive=false
- New: Submit button disabled when no selection made

#### Updated: `apps/client/src/components/chat/__tests__/InferenceIndicator.test.tsx`

- Existing tests continue to pass
- New: renders "Waiting for your approval" when isWaitingForUser=true, waitingType='approval'
- New: renders "Waiting for your answer" when isWaitingForUser=true, waitingType='question'
- New: shows elapsed time but no token count during waiting
- New: uses amber color during waiting state

#### Updated: `apps/client/src/components/chat/__tests__/ToolCallCard.test.tsx`

- Existing tests continue to pass
- New: renders ToolArgumentsDisplay instead of raw JSON in expanded state

### Mocking Strategy

- Mock `useTransport()` for ToolApproval/QuestionPrompt tests
- Mock `motion/react` with Proxy pattern (established project convention)
- Use `fireEvent.keyDown(document, { key: 'Enter' })` for shortcut tests
- Use `vi.useFakeTimers()` for debounce/timing tests

### Edge Case Tests

- Multiple simultaneous approval requests — only first is active
- QuestionPrompt "Other" textarea focused — number keys pass through
- Empty QuestionPrompt options array — graceful fallback
- Tool approval while responding (button disabled) — shortcut is no-op
- InferenceIndicator transition: streaming → waiting → streaming

## 12. Performance Considerations

- **Keyboard listener lifecycle**: The `useInteractiveShortcuts` hook attaches/detaches the global listener based on `activeInteraction`. When no interactive tool is pending, there is zero overhead — no listener attached.
- **ToolArgumentsDisplay rendering**: JSON parsing happens once on render (same as current `JSON.stringify` approach). The formatter adds minimal DOM compared to a `<pre>` block.
- **Re-renders**: `activeInteraction` changes only when a tool is approved/denied/answered or a new tool appears. This is a low-frequency event.
- **InferenceIndicator**: The waiting state is simpler than the streaming state (no rotating verb animation), so it's actually cheaper to render.

## 13. Security Considerations

- **XSS in tool arguments**: `ToolArgumentsDisplay` renders values as React text nodes (not `dangerouslySetInnerHTML`). React's built-in escaping prevents XSS.
- **Keyboard shortcut hijacking**: Shortcuts only activate when interactive tools are pending (ChatInput is disabled). No risk of shortcuts interfering with user typing.
- **Large JSON payloads**: The formatter truncates long values and limits array display to 5 items, preventing DOM bloat from malicious/large payloads.

## 14. Documentation

### New: `guides/keyboard-shortcuts.md`

Developer guide covering:

- Focus state machine (4 states with transition diagram)
- `useInteractiveShortcuts` hook API and usage
- How to add shortcuts for new interactive tool types
- Testing keyboard shortcuts
- Accessibility considerations (ARIA, screen reader announcements)
- Convention: all keyboard shortcuts use `hidden md:inline-flex` Kbd component

### Updated: `guides/interactive-tools.md`

Add a section on keyboard shortcuts:

- How keyboard shortcuts integrate with the interactive tool data flow
- The `isActive` prop pattern for multi-tool scenarios
- The imperative handle pattern for QuestionPrompt/ToolApproval

## 15. Implementation Phases

### Phase 1: Foundation (Kbd + Formatter + Status)

1. Create `kbd.tsx` component
2. Create `tool-arguments-formatter.tsx` component
3. Replace raw JSON in `ToolCallCard` with `ToolArgumentsDisplay`
4. Replace raw JSON in `ToolApproval` with `ToolArgumentsDisplay`
5. Add `isWaitingForUser` / `waitingType` to `useChatSession`
6. Update `InferenceIndicator` with waiting state
7. Thread `isWaitingForUser` / `waitingType` through MessageList to InferenceIndicator
8. Tests for Kbd, formatter, and InferenceIndicator waiting state

### Phase 2: Keyboard Shortcuts + Active State

9. Create `use-interactive-shortcuts.ts` hook
10. Add `isActive` prop to `ToolApproval` with active/inactive visual states
11. Add Kbd hints to ToolApproval buttons
12. Add `isActive` prop to `QuestionPrompt` with active/inactive visual states
13. Add Kbd hints to QuestionPrompt options and tabs
14. Add imperative handles to QuestionPrompt and ToolApproval
15. Thread `activeToolCallId` through ChatPanel → MessageList → MessageItem
16. Wire `useInteractiveShortcuts` in ChatPanel
17. Add validation: Submit disabled when no selection
18. Tests for shortcuts hook, active state rendering, and keyboard interaction

### Phase 3: Documentation + Polish

19. Write `guides/keyboard-shortcuts.md`
20. Update `guides/interactive-tools.md` with keyboard shortcut section
21. Polish: ensure smooth transitions between active/inactive states
22. Polish: verify all shortcuts work in multi-tool scenarios

## 16. Open Questions

None — all questions were resolved during ideation:

1. ~~**Approve/Deny shortcuts**~~ (RESOLVED)
   **Answer:** Enter / Escape

2. ~~**Number key behavior**~~ (RESOLVED)
   **Answer:** Toggle on/off, Arrow Up/Down navigate, Space toggles, Enter submits with validation

3. ~~**Multi-question navigation**~~ (RESOLVED)
   **Answer:** Left/Right arrows primary, `[`/`]` secondary

4. ~~**JSON formatting depth**~~ (RESOLVED)
   **Answer:** Top-level + second-level nested, both truncated if long

5. ~~**Waiting indicator placement**~~ (RESOLVED)
   **Answer:** Replace InferenceIndicator entirely

6. ~~**Multiple pending approvals**~~ (RESOLVED)
   **Answer:** First unanswered gets active state with visual highlight

7. ~~**Documentation format**~~ (RESOLVED)
   **Answer:** Developer guide only (`guides/keyboard-shortcuts.md`)

## 17. References

- `guides/interactive-tools.md` — Full interactive tool architecture
- `guides/architecture.md` — Transport interface, hexagonal architecture
- `guides/design-system.md` — Color palette and component conventions
- `specs/gateway-interactive-tool-ui/02-specification.md` — Original interactive tool UI spec
- `apps/client/src/lib/tool-labels.ts` — Existing tool name → label mapping pattern
- `apps/client/src/components/chat/ChatInput.tsx` — Keyboard event handling patterns
