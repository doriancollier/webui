# Status Bar Inline Management — Ideation

**Date:** 2026-03-24
**Status:** Active
**Slug:** status-bar-inline-management

## Problem

Status bar item visibility is currently managed exclusively through the Settings dialog (Status Bar tab). Users must navigate away from their workflow to toggle items on/off. There's no way to discover what items are available or customize the bar without opening Settings.

## Opportunity

Add inline management directly to the status bar so users can hide/show items in context, without leaving their current view. This is a standard pattern in world-class developer tools (VS Code, IntelliJ, Linear) and creates a more intuitive, delightful customization experience.

## Research

Extensive UX research documented in `research/20260324_status_bar_inline_management_ux.md` covering VS Code, IntelliJ, Figma, Arc, Linear, macOS, Vivaldi, and accessibility patterns.

Key insight: The gold standard is right-click context menus as primary entry point, but web users don't expect right-click. A visible left-click affordance (trailing configure icon) is the right primary path for a web app, with right-click as a power-user bonus.

## Key Decisions

1. **Scope: Hide/show only** — No drag-to-reorder. Item order is fixed.
2. **Primary entry point: Trailing configure icon** — `SlidersHorizontal` icon at end of status line, always visible, opens a popover with toggle list.
3. **Secondary entry point: Right-click context menu** — Power user shortcut on each item. "Hide [item]", "Configure status bar...", "Reset to defaults".
4. **Popover design: Grouped toggle list** — Reuses existing `SettingRow` + `Switch` components. Items grouped by category (Session Info, Controls, System). Always-visible subtitle descriptions.
5. **Mobile: Sheet instead of popover** — Same content, bottom drawer container on small screens.
6. **Settings dialog: Kept as-is** — Both entry points share the same Zustand store, always in sync.
7. **Data-driven item registry** — Single array defining all items (key, label, description, group, icon) replaces hardcoded item composition.
