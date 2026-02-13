---
slug: shortcut-chips
---

# Specification: Shortcut Chips

**Slug:** shortcut-chips
**Status:** Draft
**Date:** 2026-02-13
**Ideation:** [01-ideation.md](./01-ideation.md)

---

## Overview

Add clickable "shortcut chips" below the chat input that surface available triggers (`/ Commands` and `@ Files`). Clicking a chip inserts the trigger character into the input and focuses it, causing the corresponding palette to open via existing detection logic. A `showShortcutChips` preference toggle in Settings > Preferences controls visibility (default: ON).

This improves discoverability of the slash command and file autocomplete features, especially on mobile where special characters require extra taps.

---

## Technical Design

### Approach

Render chips in **ChatPanel** between `<ChatInput>` and `<StatusLine>`, outside the input container border. This requires zero changes to the ChatInput component and keeps the implementation isolated.

### Architecture

```
ChatPanel.tsx
  └── chat-input-container
        ├── CommandPalette (absolute, above)
        ├── FilePalette (absolute, above)
        ├── ChatInput
        ├── ShortcutChips (new, conditional on setting)
        └── StatusLine
```

### Data Flow

1. **Rendering:** `ChatPanel` reads `showShortcutChips` from Zustand store → conditionally renders `<ShortcutChips>` row
2. **Click:** Chip `onClick` → calls `onChipClick(trigger: string)` prop → ChatPanel handler sets input value to current value + trigger char → existing `detectTrigger()` logic opens the palette
3. **Settings:** Toggle in Preferences tab → Zustand setter → localStorage persistence → ChatPanel re-renders

---

## Implementation Phases

### P1: Zustand Store Toggle

**File:** `apps/client/src/stores/app-store.ts`

Add to the store interface and implementation:
- `showShortcutChips: boolean` (default: `true`)
- `setShowShortcutChips: (v: boolean) => void`
- localStorage key: `gateway-show-shortcut-chips`
- Initial value: read from localStorage, default `true` (note: most other prefs default to `false`, but chips should be ON for discoverability)
- Add to `resetPreferences()` cleanup

### P2: Settings Dialog Toggle

**File:** `apps/client/src/components/settings/SettingsDialog.tsx`

Add a new `<SettingRow>` in the Preferences tab:
- Label: "Show shortcut chips"
- Description: "Display shortcut hints below the message input"
- Child: `<Switch checked={showShortcutChips} onCheckedChange={setShowShortcutChips} />`
- Position: after the "Auto-hide tool calls" row (groups with other UI visibility settings)

### P3: ShortcutChips Component

**New file:** `apps/client/src/components/chat/ShortcutChips.tsx`

A small, self-contained component that renders the chip row.

**Props:**
```typescript
interface ShortcutChipsProps {
  onChipClick: (trigger: string) => void;
}
```

**Chips data:**
```typescript
const chips = [
  { trigger: '/', label: 'Commands', icon: Terminal },
  { trigger: '@', label: 'Files', icon: FileText },
];
```

**Visual spec:**
- Container: `flex items-center gap-2 mt-1.5`
- Each chip: `<button>` element with:
  - `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs`
  - `bg-secondary text-muted-foreground`
  - `hover:text-foreground hover:bg-muted`
  - `transition-colors duration-150`
  - Trigger character rendered in `<kbd>` style: `font-mono text-[10px] opacity-60`
- Icons: 12px Lucide icons (`Terminal` for `/`, `FileText` for `@`)
- Animation: `motion.div` wrapper with fade-in (`opacity: 0 → 1`, `duration: 0.2`)
- No visual state change when palette is open (the palette appearing is sufficient feedback)
- Chips stay visible and unchanged regardless of palette state

**Accessibility:**
- Each chip is a `<button>` with `type="button"`
- `aria-label` like "Insert slash command trigger" / "Insert file mention trigger"
- Focusable via Tab key

**Mobile:**
- Chips stay inline (two small pills fit on any screen width)
- Touch targets: `py-1` + line-height gives ~28px height, but the `gap-2` + `mt-1.5` spacing ensures the effective tap area is adequate. If needed, add `min-h-[32px]` for safety.

### P4: ChatPanel Integration

**File:** `apps/client/src/components/chat/ChatPanel.tsx`

1. Import `ShortcutChips` and `useAppStore` selector for `showShortcutChips`
2. Add `handleChipClick` callback:
   - Sets input value to `currentInput + trigger` (e.g., appending `/` or `@`)
   - Calls `detectTrigger()` with the new value and cursor position to open the palette
   - Focuses the textarea (via ref or existing focus mechanism)
3. Render `<ShortcutChips>` between `<ChatInput>` and `<StatusLine>`, wrapped in `<AnimatePresence>`:
   ```tsx
   <AnimatePresence>
     {showShortcutChips && (
       <ShortcutChips onChipClick={handleChipClick} />
     )}
   </AnimatePresence>
   ```
4. Chips remain visible when palettes are open (per user decision)

### P5: Tests

**New file:** `apps/client/src/components/chat/__tests__/ShortcutChips.test.tsx`

Test cases:
- Renders both chips with correct labels ("Commands", "Files")
- Calls `onChipClick` with "/" when Commands chip clicked
- Calls `onChipClick` with "@" when Files chip clicked
- Each chip has accessible button role and aria-label
- Renders Lucide icons

**Modified:** `apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx`
- Verify "Show shortcut chips" label appears in Preferences tab
- Verify the toggle switch is present and defaults to checked

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `apps/client/src/stores/app-store.ts` | Modify | Add `showShortcutChips` + setter + localStorage |
| `apps/client/src/components/settings/SettingsDialog.tsx` | Modify | Add SettingRow for shortcut chips toggle |
| `apps/client/src/components/chat/ShortcutChips.tsx` | Create | New chip row component |
| `apps/client/src/components/chat/ChatPanel.tsx` | Modify | Render ShortcutChips, add handleChipClick |
| `apps/client/src/components/chat/__tests__/ShortcutChips.test.tsx` | Create | Unit tests for ShortcutChips |
| `apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx` | Modify | Add test for new toggle |

---

## Acceptance Criteria

- [ ] Two chips ("/ Commands" and "@ Files") render below the chat input
- [ ] Clicking a chip inserts the trigger character and opens the corresponding palette
- [ ] Chips use `bg-secondary` filled style with Lucide icons
- [ ] Chips animate in with fade (200ms)
- [ ] Chips remain visible when a palette is open
- [ ] "Show shortcut chips" toggle exists in Settings > Preferences, defaults to ON
- [ ] Toggling the setting hides/shows chips immediately
- [ ] Setting persists across page reloads (localStorage)
- [ ] Chips are accessible (button elements, aria-labels, keyboard focusable)
- [ ] Chips display correctly on mobile (inline, adequate tap targets)
- [ ] All new and modified tests pass
- [ ] No regressions in existing ChatInput, ChatPanel, or Settings tests

---

## Dependencies

- Existing `detectTrigger()` function in ChatPanel (from file-autocomplete feature)
- Existing `CommandPalette` and `FilePalette` components
- Lucide React icons (`Terminal`, `FileText`)
- `motion/react` for animations
- Zustand store pattern (well-established)

---

## Non-Goals

- Rotating/cycling placeholder text
- Contextual placeholder based on open files
- Additional chip types beyond `/` and `@`
- Chip drag-and-drop reordering
- Chip customization by users
