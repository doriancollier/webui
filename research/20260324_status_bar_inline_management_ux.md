---
title: 'Status Bar Inline Management UX — VS Code, Figma, Arc, macOS, Linear and Beyond'
date: 2026-03-24
type: external-best-practices
status: active
tags:
  [
    status-bar,
    toolbar,
    inline-customization,
    drag-to-reorder,
    right-click,
    context-menu,
    progressive-disclosure,
    overflow-menu,
    accessibility,
    micro-interactions,
    ux-patterns,
  ]
searches_performed: 18
sources_count: 42
---

# Status Bar Inline Management UX — VS Code, Figma, Arc, macOS, Linear and Beyond

## Research Summary

The gold standard for inline status bar management combines three interaction layers: a **right-click context menu** for immediate, contextual hide/show access; **drag-to-reorder** with a visible drag handle or modifier key; and a **secondary discovery surface** (submenu, flyout, or dedicated panel) that reveals all available but currently-hidden items. The best implementations — VS Code's toolbar action menus, IntelliJ's status bar widgets, Microsoft Word's right-click checklist, macOS Finder's modal toolbar sheet, Linear's personalized sidebar — share a common structure: zero friction to hide an item, moderate friction to add one, and always a "reset to defaults" escape hatch. Accessibility requires every interaction to have a keyboard-equivalent path, with ARIA live regions announcing reorder outcomes to screen readers.

---

## Key Findings

### 1. Right-Click Context Menus Are the Universal Entry Point

Every world-class desktop-quality application uses right-click (or long-press equivalent) as the primary inline customization trigger. There is no exception among the references studied.

- **VS Code status bar**: Right-click any item opens a context menu with two sections: item-specific actions at the top, and a "Hide [Item Name]" command at the bottom (bottom placement is intentional — the menu opens upward from the status bar, so "Hide" is physically closest to the cursor)
- **VS Code toolbar actions** (Search, Explorer, Source Control panel toolbars): Right-click opens a checklist popup where each action has a checkmark. Unchecking hides the action and moves it to a "..." More Actions overflow menu. A "Reset Menu" command restores defaults.
- **IntelliJ IDEA / JetBrains IDEs**: Right-click anywhere on the status bar opens a flat checklist of all available widgets. Checked = visible, unchecked = hidden. Immediate effect with no confirmation.
- **Microsoft Word / Excel status bar**: Right-click the status bar opens a large checklist (~20+ items) where each row is a widget name with a checkmark indicating visibility. Clicking any row immediately toggles that item. This is the **canonical checkmark-toggle pattern**.
- **Linear sidebar**: Right-click any sidebar item opens a context menu with "Hide [item]" and "Customize sidebar" options. "Customize sidebar" opens a full management view.
- **macOS menu bar**: No right-click (macOS menu bar items respond to Cmd+drag for reorder/remove, not right-click), but System Settings > Control Center provides a per-item dropdown with "Show in Menu Bar / Don't show in Menu Bar" options.

**What makes this pattern excellent**: The user is already looking at the item they want to manage. Right-click requires zero additional navigation — the action is zero-distance from the target.

### 2. The Two-Track System: Hide vs. Manage-All

The best apps distinguish between two customization modes:

**Track A — Contextual item action**: Right-click a specific item → hide just that item. Fast, zero-friction, no decision paralysis. Designed for "I never use this."

**Track B — Global management surface**: A dedicated panel, submenu, or modal that shows ALL available items (both visible and hidden) simultaneously. Designed for "I want to reconfigure my setup."

| App                  | Track A trigger               | Track B trigger                         |
| -------------------- | ----------------------------- | --------------------------------------- |
| VS Code toolbar      | Right-click → "Hide [action]" | Right-click → "Reset Menu"              |
| IntelliJ status bar  | Right-click → uncheck widget  | Right-click → see full widget list      |
| Word status bar      | Right-click → uncheck item    | Same right-click menu (all items shown) |
| Linear sidebar       | Right-click → "Hide [item]"   | Right-click → "Customize sidebar"       |
| macOS Finder toolbar | Cmd+drag to remove            | View > Customize Toolbar → modal sheet  |
| macOS menu bar       | Cmd+drag off bar              | System Settings > Control Center        |

The key insight: **Track A and Track B share the same entry point** (right-click or a settings surface), but Track A is immediate while Track B is deliberate. The right-click menu should offer both in a single menu — hide this item now, OR open the full management surface.

### 3. Drag-to-Reorder Patterns

Three distinct interaction models dominate:

**Model A — Direct drag (no mode required)**: Items are always draggable. A drag handle (`⠿` or `=` icon) appears on hover. Used by: Linear sidebar (drag-to-reorder within the sidebar list). The affordance signal is critical — without the handle appearing on hover, discoverability is near zero.

**Model B — Modifier key drag**: Hold Cmd/Ctrl while dragging to enter drag mode. Used by: macOS menu bar (Cmd+drag to reorder menu bar icons — releases drag by dropping), macOS Finder toolbar while in customize mode, Vivaldi browser toolbar (Ctrl/Cmd+drag the component). Requires knowledge of the modifier, so discoverability is lower but feels native and direct.

**Model C — Edit mode toggle**: A dedicated "customize" mode must be entered before dragging is available. Used by: macOS Finder toolbar (View > Customize Toolbar activates the modal), iOS home screen (long-press to enter jiggle mode). Higher friction, but signals "you're now in an editing context" — prevents accidental reorders.

For a desktop-web application, **Model A (drag handle on hover)** is the right default. Web apps cannot rely on OS-level modifier key behaviors, and users do not expect a separate "customize mode" for a status bar. The drag handle should be:

- Visible only on hover (to avoid visual clutter when not customizing)
- `cursor: grab` / `cursor: grabbing` CSS
- Accessible via keyboard (see Accessibility section)

### 4. How the Best Apps Handle Available-But-Hidden Items

The hardest UX problem: once a user hides an item, how do they find it again to re-enable it?

**Approach A — The full checklist (Word, IntelliJ)**: Right-clicking opens a menu that always shows ALL available items, whether visible or not. Hidden items appear unchecked. Users can re-enable them the same way they hid them. This is the simplest, most forgiving pattern — there is no state where an item becomes "lost."

**Approach B — The submenu of hidden items (VS Code status bar)**: The right-click menu on the status bar contains a submenu "Status Bar Items" that lists all hidden items. Clicking one re-enables it. VS Code combined this with explicit item names in 2021 (GitHub Issue #113757) so users know exactly what they're restoring.

**Approach C — The More/overflow menu (Linear, Figma, VS Code toolbar)**: Hidden items accumulate in a "..." or "More" overflow menu. Users discover re-enabling by clicking the overflow to see what's buried there. Risk: users may not look in the overflow menu to find previously hidden items. Mitigated by: VS Code's toolbar shows a "Reset Menu" option that restores everything at once.

**Approach D — Dedicated "Customize" panel (Vivaldi, macOS Finder)**: A separate UI (modal sheet or settings pane) shows two zones: "Active items in the bar" and "Available items (not currently shown)". Users drag between zones. macOS Finder's modal sheet is the gold standard of this pattern — it shows exactly what's in the toolbar and what's available, with a drag-and-drop interface, a "Show:" text/icon/both option, and a "Done" button.

**Best pattern for a developer tool status bar**: Combine Approach A (full checklist always visible in right-click menu) with Approach C (a "+" or gear icon at the end of the bar as a secondary entry point to the same checklist). The full checklist is the safety net; the end-of-bar icon is the discoverable affordance for new users.

### 5. VS Code Status Bar — Specific Implementation Details

VS Code's status bar is the closest direct reference for a developer-tool status bar.

**Layout**: Two zones — left (global workspace: branch name, sync status, errors/warnings, live share) and right (contextual: language mode, line/col, spaces, encoding, EOL, feedback). Items earn placement by relevance.

**Right-click behavior**: Right-clicking anywhere on the status bar opens a context menu titled "Status Bar Items" that contains a checklist of all registered status bar items (both from core VS Code and installed extensions). Each row shows:

- Item name (explicit label, not cryptic ID)
- Checkmark if visible
- Clicking toggles visibility immediately

The menu also includes at the bottom: "Hide Status Bar" (hides the entire bar) and is scoped to show items from extensions that have contributed to the status bar.

**The "closer to cursor" decision**: Benjamin Pasero (VS Code team) confirmed in Issue #113757 that the "Hide" option is at the bottom of the status bar context menu specifically because the menu opens _upward_ from the status bar — placing the most-used option (hide) physically closest to the cursor. This is a spatial reasoning decision, not an accident.

**Extension API**: Extensions contribute status bar items with a `StatusBarAlignment` (Left or Right) and a numeric `priority` that determines sort position within each zone. Higher priority = closer to center (for left items) or closer to center (for right items). This priority system is what makes extensible status bars manageable — items self-declare their relative importance.

**Toolbar actions (different from status bar)**: VS Code's panel and view toolbars (top-right of Search view, Explorer, etc.) support an even richer inline customization:

- Right-click any button → "Hide '[Button Name]'" — removes it from the bar
- Hidden buttons move to the "..." More Actions menu and remain accessible
- Right-click the toolbar area → "Reset Menu" restores all buttons to defaults
- This is richer than the status bar because the panel toolbars are higher real estate density

### 6. Figma UI3 Bottom Toolbar — Design Philosophy

Figma's Config 2024 redesign moved the toolbar from top to bottom. The core philosophy:

**"Contextual tools should be visible, not hidden"** — This is the community's exact pushback (Figma Forum thread "Bring the top bar back"). The counter-argument from Figma: moving to the bottom frees canvas space and the tools haven't disappeared, they're just repositioned.

**What Figma chose not to do**: No per-user customization of toolbar items. The toolbar is opinionated — Figma decides what's in it. This is a deliberate product decision: the toolbar is small (7-8 items), so no overflow needed, and customization would fragment the shared muscle memory among teams.

**What Figma did well**:

- The "Actions" button (Cmd+K) acts as a universal fallback for everything not in the toolbar — it's the progressive disclosure surface for all tools
- Tools adapt contextually to what's selected (no explicit customization needed because the toolbar changes based on context)
- A "More" menu appears when contextual tools exceed the bar's capacity

**The lesson for DorkOS**: Figma avoids the customization problem by keeping the toolbar small and opinionated. If your status bar has 5-7 items, customization is nice-to-have. If it has 15+, customization becomes essential.

### 7. Arc Browser — Sidebar as the Status Surface

Arc's philosophy is relevant at the conceptual level. Arc treats the sidebar as the primary workspace surface (tabs, spaces, bookmarks, recent) and the toolbar as minimal chrome.

**Arc sidebar customization**:

- Drag-to-reorder Spaces (groups of tabs) by dragging Space icons — introduced in 2024 with cross-device sync
- Hide sidebar entirely: Cmd+S or drag sidebar width to zero
- No granular item-level customization for the sidebar structure itself — Arc is opinionated about what the sidebar contains

**The toolbar**: Arc offers View > Show/Hide Toolbar to toggle the traditional browser toolbar. The toolbar itself is not customizable by users.

**What Arc does brilliantly**: Zero-chrome philosophy. Rather than giving users a pile of toolbar items to manage, Arc starts minimal and lets users add to the sidebar organically. The customization IS the workflow (dragging tabs to folders, creating spaces). Applying this to DorkOS: consider whether some "status bar items" should be hidden by default and surface only when relevant, rather than offering a pane of options.

### 8. macOS Menu Bar — The Cmd+Drag Standard

The macOS menu bar is the gold standard for a persistent horizontal strip of items, and its customization model is worth studying closely.

**Reorder**: Hold Cmd, then drag any menu bar icon to a new position. Drop to place. To remove an item, Cmd+drag it off the menu bar entirely (it disappears with a "poof" animation on older macOS, or simply removes).

**Affordance signal**: No special cursor or handle appears to indicate draggability. The Cmd+drag behavior is documented but not surfaced in the UI itself. This is **discoverable-by-accident or by reading docs** — a significant discoverability gap that Apple accepts in exchange for keeping the menu bar uncluttered.

**System Settings > Control Center**: Each menu bar item has an explicit "Show in Menu Bar / Show when Active / Don't show" three-state toggle. This is the deliberate, full-management version of the Cmd+drag shortcut.

**Non-movable items**: The Clock, Control Center, and Siri icons are fixed in position — no customization. This teaches a principle: **not all status bar items should be customizable**. Some items are structural and should be locked.

**The lesson**: For DorkOS, lock structural items (e.g., the session identity or main navigation trigger) and allow customization of informational widgets (Pulse status, token count, etc.).

### 9. Linear — Right-Click + Drag: The Modern Standard

Linear's December 2024 personalized sidebar is the most current and most relevant reference for a developer-focused tool sidebar/status bar.

**Three-layer customization**:

1. Right-click a specific item → context menu with "Hide [item]" and "Customize sidebar"
2. Drag-and-drop reordering — works in the default state, no edit mode required
3. Notifications display preference: "count" vs. "dot" — per-item meta-settings

**"More" menu for hidden items**: Items hidden from the sidebar are accessible via a "More" menu at the bottom of the sidebar. This prevents items from being permanently lost and provides a natural re-discovery mechanism.

**No modal, no separate settings page** for basic operations — hide and reorder happen inline. The "Customize sidebar" option opens a dedicated UI only when the user explicitly requests full control.

**What's excellent about Linear's approach**: The right-click entry point means customization is discoverable by anyone who right-clicks out of frustration or curiosity. The drag handle appears on hover. Together these cover both accidental discovery and intentional exploration.

### 10. Progressive Disclosure — Revealing Available Items

The core challenge: a user sees a status bar with 4 visible items. There are 8 more items available. How do they know those 8 items exist?

**Pattern A — End-of-bar "+" button**: A small `+` icon at the trailing edge of the status bar, visible either always or on hover of the bar. Clicking opens a panel listing all available items not currently shown. Used by: iOS widget screen (in editing mode), many dashboard tools. High discoverability. Risk: the "+" is ambiguous — "add a new item" or "add an existing hidden item"?

**Pattern B — Right-click reveals full list**: The right-click context menu always shows ALL items (visible and hidden), making discovery a side effect of the customize gesture. Used by: Word, IntelliJ. Zero additional UI required. Lower discoverability for first-time users who don't think to right-click.

**Pattern C — Gear/settings icon**: A settings gear at the end of the bar opens a flyout or inline panel with toggle switches for each available item. Used by: many dashboard apps. High discoverability but adds permanent visual weight to the bar.

**Pattern D — "N more available" affordance**: A ghost chip at the end of the bar reads "3 more items available →" or shows a subtle indicator. Clicking expands the management interface. This is the most educational approach — it explicitly teaches users that more exists without requiring them to discover it by accident.

**Recommended for DorkOS**: Pattern B (right-click full list) as the primary, Pattern D (subtle ghost affordance on first use or on hover of the trailing edge) as a one-time educational nudge. After the user has configured the bar at least once, the ghost affordance can be suppressed.

### 11. Toolbar Overflow Patterns

When more items exist than can fit in the available width:

**Priority-based overflow (PatternFly, Material Design)**: Items have a declared priority. When the bar is too narrow, lowest-priority items collapse first into an overflow "..." menu. The rule: never collapse more than 2-3 items before giving users a way to access them. PatternFly's guidance: surface max 2-3 actions in the toolbar; everything else in overflow.

**The "..." / kebab menu**: The universally understood overflow affordance. VS Code uses this extensively in panel toolbars. Clicking "..." exposes all hidden toolbar actions. Items moved here remain fully functional — they're just not at zero-click reach.

**Responsive collapse sequence (VS Code toolbar panels)**: The sequence is predictable: the rightmost items collapse first (they're "secondary"), the leftmost items collapse last (they're "primary"). Users learn which actions are more or less prominent based on their collapse position.

**For a fixed-width status bar** (not a responsive layout): The overflow pattern matters less. Instead, you should **limit the total number of items** to what fits. The VS Code UX guideline states this explicitly: "Restrict to one icon per item; limit total items contributed." If items are going to exceed the bar, use a "More" overflow chip at the trailing edge that drops down to show the rest.

### 12. Delightful Micro-Interactions

The difference between "functional" and "world-class" customization UX:

**Drag reorder animation**: When an item is dragged and dropped, surrounding items should animate to their new positions with a short transition (~250ms, ease-out). Without animation, users miss what changed (change blindness). With animation, the reorder is satisfying and visually confirmatory.

**Exit animation for hidden items**: When an item is hidden via right-click, it should slide out (or fade out with a gentle scale) rather than vanishing instantly. The exit animation communicates "this happened" — it's not just gone, it visibly left. VS Code's panel toolbar items collapse toward the "..." More button, which is an excellent spatial metaphor.

**Ghost item affordance**: Before the user has filled the bar to capacity, ghost/placeholder items at the trailing edge with dashed borders suggest "you could add something here." This is used in iOS widget editing and some dashboard UIs. Psychologically, empty slots invite filling — it drives engagement with the customization surface.

**Hover state escalation**: A three-stage hover approach for status bar items:

- Default: minimal, just the item
- Hover: drag handle appears + subtle highlight
- Right-click: context menu with item-specific actions
  This progression avoids cluttering the default view while surfacing full control on interaction.

**Undo support**: The most delightful feature VS Code has in its toolbar customization: "Reset Menu" is always available. For a status bar, a persistent "Undo last change" affordance (or a "Reset to defaults" link in the right-click menu) reduces fear of experimentation. Users will try things if they know they can undo.

---

## Detailed Analysis

### The Right-Click Context Menu: Exact Structure

Based on cross-referencing VS Code, IntelliJ, Word, and Linear, the ideal right-click context menu for a status bar item should follow this structure:

```
[Item Name]              ← non-interactive label for what was right-clicked
──────────────────────
[Item-specific actions]  ← if the item has clickable functions (e.g., "Copy branch name")
──────────────────────
Hide "[Item Name]"       ← hides this specific item
──────────────────────
Customize status bar →   ← opens the full management surface
```

Key principles:

- The item name as a label at the top prevents confusion about what action applies to what item
- Item-specific actions appear before meta-management actions (hide/customize) — they're more contextually relevant
- "Hide" is labeled with the specific item name ("Hide 'Pulse Status'", not just "Hide") — VS Code explicitly fixed this after Issue #113757 complaints
- The full management surface is always one level away, not multiple levels

### The Full Management Surface: Structure

When the user selects "Customize status bar", the surface should show:

```
┌─────────────────────────────────────────────┐
│  Status Bar Items                           │
├─────────────────────────────────────────────┤
│  Visible                                    │
│  ─────────────────────────────              │
│  ⠿  ◉ Pulse Status                         │ ← drag handle + toggle
│  ⠿  ◉ Relay Status                         │
│  ⠿  ◉ Mesh Status                          │
│                                             │
│  Hidden                                     │
│  ─────────────────────────────              │
│     ○ Token Count                           │ ← no drag handle (hidden)
│     ○ Working Directory                     │
│     ○ Model Name                            │
│                                             │
│              Reset to defaults   Done       │
└─────────────────────────────────────────────┘
```

The visible items have drag handles and are reorderable. Hidden items have no handle — they can only be toggled on. Toggling a hidden item on moves it to the Visible section (optionally with a slide-in animation) and gives it a handle for reordering.

### Accessibility Requirements

For WCAG 2.1 AA compliance and genuinely accessible customization:

**Keyboard reorder pattern (ARIA APG)**:

- Each draggable item gets a "drag handle" button (`role="button"` or a dedicated button element)
- When focus is on the handle and Space/Enter is pressed, the item enters "grabbed" state (`aria-grabbed="true"` — deprecated in ARIA 1.1, but still widely supported; prefer `aria-pressed` on the button)
- Arrow Up/Down (for vertical lists) moves the item one position; Escape cancels
- On drop/confirmation, an `aria-live="assertive"` region announces: "[Item name] moved to position [N] of [total]"

**ARIA roles for the status bar**:

- The status bar container: `role="toolbar"` with `aria-label="Status bar"`
- Items: `role="button"` (if clickable) with appropriate `aria-label`
- Right-click menu: `role="menu"` with `role="menuitem"` for each entry
- Toggle items in the checklist: `role="menuitemcheckbox"` with `aria-checked="true/false"`

**Keyboard navigation**:

- Tab: enters the toolbar
- Left/Right arrows: move between toolbar items (ARIA toolbar pattern)
- Context menu key (or Shift+F10): opens the right-click menu without a mouse
- Escape: closes menus, cancels drag operations

**The "hidden from toolbar ≠ hidden from keyboard"** principle: Items hidden from the status bar should still be discoverable via keyboard through the management interface or keyboard shortcut. VS Code's approach: hidden items live in the "..." More Actions menu which is keyboard-accessible.

### Vivaldi Browser — The Richest Web Toolbar Customization

Vivaldi (built on Chromium) offers the most comprehensive browser toolbar customization and is worth detailed study as a direct web app reference:

**Three access paths** to the toolbar editor:

1. Right-click any component → "Customize Toolbar"
2. Menu > View > Customize Toolbar
3. Settings > Appearance > Window Appearance

**While the editor is open**:

- A dropdown at the top selects which toolbar to edit (Address Bar, Status Bar, Panels Toolbar, etc.)
- Available components are displayed in a panel below the toolbar
- Drag a component from the panel to the toolbar to add it (insertion indicator shows placement)
- Drag a component off the toolbar while the editor is open to remove it
- To move an existing component: hold Ctrl/Cmd and drag it to the new position

**Reset options**: Right-click a component → "Reset Toolbar To Default" OR a reset button in the editor itself. This dual-path reset is excellent — users can reset a single component or the whole toolbar.

**What Vivaldi does that few others do**: It exposes WHICH toolbar is being edited (via the dropdown). This is critical for applications with multiple toolbar zones (like DorkOS's potential left-side and right-side of the status bar) — users need to understand which zone they're configuring.

---

## Synthesis: Recommended Pattern for DorkOS Status Bar

Based on all research, the ideal inline management system for DorkOS's status bar has these layers:

### Layer 1 — Right-Click Context Menu (Primary)

Right-clicking any status bar item opens a context menu:

```
[Item label]
─────────────
[Item action if applicable]
─────────────
Hide "Pulse Status"
─────────────
Customize status bar...
Reset to defaults
```

Right-clicking the bar background (not on an item) opens the same menu but without item-specific sections — just "Customize status bar..." and "Reset to defaults".

### Layer 2 — Inline Drag-to-Reorder

All visible items that support reordering display a drag handle icon on hover (`⠿`, 12px, `text-muted-foreground/40`). Drag handle appears at 150ms hover delay (not instant, to avoid visual noise when the cursor passes over). Drag-and-drop reorders within the visible zone. Animation: surrounding items animate to new positions at 250ms ease-out. The dragged item snaps to its new position.

### Layer 3 — Trailing-Edge "+" / Settings Affordance

A `⊕` or gear icon (`text-muted-foreground/30`, only visible on bar hover) at the trailing edge of the bar. Clicking opens the full management surface (as an inline flyout panel anchored to the bar, not a modal dialog). For first-time users only, a tooltip or ghost chip reads "Configure status bar" to aid discovery.

### Layer 4 — Full Management Flyout

An inline flyout panel (not a modal — avoid disrupting context) anchored to the status bar, showing:

- **Visible items** (with drag handles, toggle switch)
- **Available items** (no drag handles until toggled on, toggle switch)
- **Reset to defaults** link
- **Done / close** button

The flyout uses a clean list layout, not a complex settings page.

### Non-customizable items

Some items should be locked: the primary identity chip (agent name, session indicator), and any structural items that represent DorkOS's core value proposition. These should be visually distinct in the management surface (lock icon, greyed-out toggle).

---

## Sources & Evidence

- "Right-click on any action and select its Hide command... Hidden actions are moved to the ... More Actions menu and can be invoked from there. To restore an action to the toolbar, right-click the toolbar button area and select the Reset Menu command." — [VS Code Custom Layout Documentation](https://code.visualstudio.com/docs/configure/custom-layout)
- "The menu opens from the bottom to the top in the status bar, it felt more natural to have the 'Hide' entry closer to the mouse" — [VS Code Issue #113757](https://github.com/microsoft/vscode/issues/113757) (Benjamin Pasero, VS Code team, closed January 2021)
- "Right-click the status bar to select the widgets that you want to show or hide. Status Bar Widgets are located in the right part of the status bar." — [JetBrains IntelliJ IDEA User Interface Documentation](https://www.jetbrains.com/help/idea/guided-tour-around-the-user-interface.html)
- "Right-clicking on the Word Status Bar lets you show/hide parts of the bottom row... the selected options will have a checkmark beside them" — [Office Watch: All About the Word Status Bar](https://office-watch.com/2026/word-status-bar-features/)
- "Right-click on a specific item to update it or select Customize sidebar to show all options. You can also drag & drop to reorder items." — [Linear Changelog: Personalized sidebar](https://linear.app/changelog/2024-12-18-personalized-sidebar) (December 2024)
- "Items are placed into two groups: Primary (left) and Secondary (right)... Restrict to one icon per item unless essential; Limit total items contributed to avoid clutter" — [VS Code Status Bar UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/status-bar)
- "Hold down the CMD key and drag and drop the icon to the position where you want it to live" — [Macworld: How to rearrange macOS menu bar items](https://www.macworld.com/article/1447511/rearrange-macos-menu-bar-items.html)
- "You can drag icons into the window's Toolbar from the sheet... drag items out and you can rearrange items... reset the entire Toolbar to its default set by dragging the set at the bottom of the Toolbar sheet" — [Apple Support: Customize Finder toolbar](https://support.apple.com/guide/mac-help/customize-the-finder-toolbar-on-mac-mchlp3011/mac)
- "Hold down the Ctrl / ⌘ key and drag the component to the new location" — [Vivaldi: Customize toolbars](https://help.vivaldi.com/desktop/appearance-customization/edit-toolbars/)
- "Animating items when they change position helps users visualize the reordering that occurs... a duration of 0.25 seconds was found to be most appropriate for moving an item one spot" — [Designing a reorderable list component, Darin Senneff](https://www.darins.page/articles/designing-a-reorderable-list-component)
- "Avoid having more than 3 actions fully displayed within a toolbar. Be selective about which actions to surface." — [PatternFly Overflow Menu Design Guidelines](https://www.patternfly.org/components/overflow-menu/design-guidelines/)
- "Due to the absence of supported ARIA attributes, Dragon Drop utilizes live regions to convey the information needed for all users to reorder a list." — [4 Major Patterns for Accessible Drag and Drop, Salesforce UX / Medium](https://medium.com/salesforce-ux/4-major-patterns-for-accessible-drag-and-drop-1d43f64ebf09)
- "Left Arrow and Right Arrow should be used to navigate between controls within a horizontal toolbar" — [ARIA APG Toolbar Pattern, W3C WAI](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- Arc sidebar: "reorder your Spaces by clicking and dragging a Space icon from the bottom of your Sidebar" — [Arc for macOS Release Notes 2024-2026](https://resources.arc.net/hc/en-us/articles/20498293324823-Arc-for-macOS-2024-2026-Release-Notes)
- Figma UI3: "The Actions menu provides access to all of Figma's AI tools, productivity actions, plugins, widgets, and components" — [Figma Help: Navigating UI3](https://help.figma.com/hc/en-us/articles/23954856027159-Navigating-UI3)
- "Some buttons to apply a mask, create a component, or perform a boolean operation might be found in the More menu" — [Figma Forum: Bring the top bar back](https://forum.figma.com/suggest-a-feature-11/bring-the-top-bar-back-contextual-tools-should-be-visible-not-hidden-24663)

---

## Research Gaps & Limitations

- No direct access to Figma's toolbar customization source code or internal UX specification — descriptions are based on published help docs and community forum threads
- Arc's toolbar customization is minimal by design; no item-level granular control exists, making it less directly applicable as a reference for a multi-item status bar
- No visual mockup evidence obtained (screen recordings, Figma community files) — all descriptions are text-based from docs and community discussions
- IntelliJ's status bar right-click behavior was confirmed by documentation but not visually verified; the exact menu layout may differ slightly from what's described
- The Linear sidebar customization was launched December 18, 2024 — behavior may have been refined since then

---

## Contradictions & Disputes

- **Hover vs. always-visible customization affordances**: NN/g argues hover-revealed controls are inaccessible and frustrating on touch devices; macOS Finder accepts this tradeoff for desktop-only chrome. For DorkOS (a desktop web app primarily), hover-reveal is acceptable IF keyboard alternatives exist.
- **Figma's opinionated toolbar vs. VS Code's customizable one**: Figma deliberately chose NO per-user toolbar customization, arguing that shared muscle memory matters more than personal preference. VS Code chose full customization. For a developer tool with many possible status sources (Pulse, Relay, Mesh, session info, model info, CWD, etc.), VS Code's model is more appropriate — the items are not universally needed by all users.
- **Drag-to-reorder discoverability**: The modifier-key drag pattern (Cmd+drag on macOS) is powerful but has near-zero discoverability for new users. The drag-handle-on-hover pattern has higher discoverability but adds visual noise. Linear chose the drag-handle approach; macOS menu bar chose modifier-key. For a web app, drag-handle-on-hover wins.
- **Modal vs. inline management surface**: macOS Finder uses a modal sheet; VS Code and Linear use inline surfaces. Modals provide more focused editing but break flow. For a status bar that's always visible, an inline flyout anchored to the bar is more appropriate than a modal.

---

## Contradictions & Disputes

None of the research sources directly contradict each other on core principles. The main tension is between "opinionated toolbars" (Figma, Arc) and "fully customizable toolbars" (VS Code, IntelliJ, Vivaldi). That tension resolves based on user persona: power developers expect and benefit from customization; designers using a shared tool benefit from a common baseline.

---

## Search Methodology

- Searches performed: 18
- Most productive search terms: `VS Code "status bar" right-click "hide" inline visibility management`, `Linear personalized sidebar customization drag reorder 2024 December`, `IntelliJ IDEA status bar right-click customize widgets hide show`, `Microsoft Word right-click status bar checkmark toggle items`, `macOS Finder toolbar customize modal sheet drag items`, `Vivaldi browser toolbar customization drag handle`
- Primary information sources: VS Code GitHub Issues, VS Code documentation, Linear changelog, JetBrains documentation, Vivaldi help center, Apple Support, macOS coverage from Macworld/Apple Insider, W3C WAI ARIA APG patterns, Figma help center and community forums, PatternFly design guidelines
