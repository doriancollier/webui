---
slug: friendly-tool-name-display
number: 176
created: 2026-03-24
status: specified
---

# Friendly Tool Name Display in ToolApproval

## Overview

The `ToolApproval` component renders raw MCP tool names (e.g., `mcp__dorkos__binding_list_sessions`) in two locations — the pending approval card (line 281) and the decided/compact state (line 194). The identical formatting utilities already used by `ToolCallCard` (`getToolLabel`, `getMcpServerBadge`) should be applied here for consistency.

This is a minimal, surgical change: import two existing functions, apply them to two render sites, update tests.

## Technical Design

### Approach

Reuse the existing `getToolLabel()` and `getMcpServerBadge()` from `@/layers/shared/lib` — the same pattern already used in `ToolCallCard.tsx` (lines 146, 159–165).

### Changes to `ToolApproval.tsx`

**1. Add import (line 5):**

Update the existing import from `@/layers/shared/lib` to include the two formatting functions:

```typescript
// Before
import { ToolArgumentsDisplay, cn } from '@/layers/shared/lib';

// After
import { ToolArgumentsDisplay, cn, getToolLabel, getMcpServerBadge } from '@/layers/shared/lib';
```

**2. Pending state (line 281) — replace raw `{toolName}`:**

```tsx
// Before
<div className="mb-2 font-mono text-xs">{toolName}</div>

// After
<div className="mb-2 flex items-center gap-1.5">
  {getMcpServerBadge(toolName) && (
    <span className="bg-muted text-muted-foreground text-3xs rounded px-1 py-0.5 font-medium">
      {getMcpServerBadge(toolName)}
    </span>
  )}
  <span className="font-mono text-xs">{getToolLabel(toolName, input)}</span>
</div>
```

Note: Call `getMcpServerBadge` once and store in a variable (or use `useMemo`) rather than calling twice. The ToolCallCard pattern stores it in a `const badge` before the return.

**3. Decided/compact state (line 194) — replace raw `{toolName}`:**

```tsx
// Before
label={<span className="text-3xs font-mono">{toolName}</span>}

// After
label={<span className="text-3xs font-mono">{getToolLabel(toolName, input)}</span>}
```

The decided state is compact (single line), so the MCP badge is omitted here — matches the space-constrained layout of `CompactResultRow`. The friendly label alone is sufficient context.

### Badge computation

Add a `const badge = getMcpServerBadge(toolName);` near the top of the component body (matching the ToolCallCard pattern), then reference `badge` in the JSX to avoid double function calls.

### No changes to `tool-labels.ts`

The formatting utilities already handle all MCP tool name patterns correctly, including:

- `mcp__dorkos__binding_list_sessions` → badge: `null` (DorkOS tools suppressed), label: "Binding List Sessions"
- `mcp__slack__send_message` → badge: "Slack", label: "Send Message"
- `Write` → badge: `null`, label: "Write /tmp/test.txt" (with input context)
- Unknown MCP servers humanized automatically via `humanizeSnakeCase`

### Test changes to `ToolApproval.test.tsx`

**Test at line 41** — currently asserts `screen.getByText('Write')`. After the change, `getToolLabel('Write', '{"file_path": "/tmp/test.txt"}')` returns `"Write test.txt"`. Update assertion:

```typescript
// Before
expect(screen.getByText('Write')).toBeDefined();

// After
expect(screen.getByText('Write test.txt')).toBeDefined();
```

**Test at line 155–166** — asserts decided state shows `'Write'` in mono font. Update to match new label:

```typescript
// Before
expect(toolNameEl!.textContent).toBe('Write');

// After
expect(toolNameEl!.textContent).toBe('Write test.txt');
```

**Add new test** for MCP tool name formatting with badge:

```typescript
it('renders friendly label for MCP tool names with server badge', () => {
  render(
    <ToolApproval
      {...baseProps}
      toolName="mcp__slack__send_message"
      input='{"channel": "#general"}'
    />
  );
  expect(screen.getByText('Slack')).toBeDefined(); // badge
  expect(screen.getByText('Send Message')).toBeDefined(); // friendly label
});

it('suppresses badge for DorkOS tools but shows friendly label', () => {
  render(
    <ToolApproval
      {...baseProps}
      toolName="mcp__dorkos__binding_list_sessions"
      input="{}"
    />
  );
  expect(screen.queryByText('DorkOS')).toBeNull(); // no badge
  expect(screen.getByText('Binding List Sessions')).toBeDefined(); // friendly label
});
```

## Implementation Phases

### Phase 1 (only phase)

1. Update `ToolApproval.tsx`:
   - Add `getToolLabel`, `getMcpServerBadge` to import
   - Add `const badge = getMcpServerBadge(toolName);` in component body
   - Replace pending state tool name display (line 281)
   - Replace decided state tool name display (line 194)
2. Update `ToolApproval.test.tsx`:
   - Fix existing assertions for formatted tool labels
   - Add MCP badge test cases
3. Run `pnpm vitest run` on affected test files to verify

## Acceptance Criteria

- [ ] ToolApproval pending state shows friendly tool label (e.g., "Send Message" not "mcp**slack**send_message")
- [ ] ToolApproval pending state shows MCP server badge for non-DorkOS servers (e.g., "Slack")
- [ ] ToolApproval decided/compact state shows friendly tool label
- [ ] DorkOS MCP tools show no badge (existing behavior from `getMcpServerBadge`)
- [ ] Non-MCP tools (Read, Write, Bash, etc.) display with context-aware labels (existing `getToolLabel` behavior)
- [ ] All existing ToolApproval tests pass (updated assertions)
- [ ] New test cases cover MCP badge rendering in ToolApproval

## Risks & Mitigations

- **Risk:** Test assertions break due to label format change. **Mitigation:** Update assertions to match `getToolLabel` output — the function is well-tested with 25+ test cases.
- **Risk:** Badge styling doesn't match ToolCallCard. **Mitigation:** Copy exact CSS classes from ToolCallCard line 160.

## Files Modified

| File                                                                   | Change                                     |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| `apps/client/src/layers/features/chat/ui/ToolApproval.tsx`             | Import formatters, apply to 2 render sites |
| `apps/client/src/layers/features/chat/__tests__/ToolApproval.test.tsx` | Update assertions, add MCP badge tests     |
