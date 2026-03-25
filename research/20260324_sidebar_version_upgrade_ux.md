---
title: 'Sidebar Version Display & Upgrade Notification UX Patterns'
date: 2026-03-24
type: external-best-practices
status: active
tags: [sidebar, version-display, upgrade-notification, ux, developer-tools, electron, desktop-apps]
searches_performed: 0
sources_count: 2
---

# Sidebar Version Display & Upgrade Notification UX Patterns

**Date**: 2026-03-24
**Mode**: Focused Investigation (synthesized from prior research)
**Objective**: How do popular desktop/web apps show version info and upgrade notifications in sidebars? What is the right pattern for DorkOS's sidebar footer?

> **Note**: This report synthesizes findings from two prior deep research reports:
>
> - `research/20260227_update_notification_ux_patterns.md` — per-app analysis of update notification patterns (22 searches, 30+ sources)
> - `research/20260310_dev_version_display_upgrade_ux.md` — dev-mode version handling (18 searches, 28 sources)
>
> No new searches were needed. Read those reports for full sourcing.

---

## Research Summary

The gold standard for sidebar upgrade notifications is Arc Browser's collapsed-pill-that-expands-on-hover at the sidebar bottom — non-interrupting, always accessible, and respectful of screen real estate. Combined with VS Code's peripheral status-area version display and Raycast's two-tier silent-patch/announced-feature model, a clear DorkOS pattern emerges. The critical anti-patterns are repeating dismissed notifications, occupying permanent sidebar space with a full-height card, and showing false upgrade prompts in dev mode.

---

## App-by-App Breakdown

### Arc Browser — Closest Match

**The gold standard reference for DorkOS.**

- **Location**: Bottom of the sidebar
- **Default state**: A small collapsed pill/indicator — low signal, always visible, never disruptive
- **On hover**: Pill expands with gradient button and brief version info
- **On click "See What's New"**: Opens release notes in-app (built with Arc's own Easel feature)
- **Post-update**: "What's New" summary banner appears in same sidebar location, also collapsed by default
- **Styling note**: "styled to better blend with your sidebar" — does not fight the nav visually

Arc's approach is the direct model for DorkOS: sidebar bottom, collapsed by default, expands on hover, in-app release notes.

### VS Code

- **Location**: Bottom-left status bar (persistent) + bottom-right toast (actionable moment)
- **Default state**: Version visible in status bar; bell icon in bottom-left shows badge count for pending notifications
- **Update ready**: Non-blocking toast in bottom-right — "Restart to apply update" with Restart button and dismiss X
- **Post-update**: Auto-opens release notes as a rich HTML tab in the editor
- **Lesson**: Separate the persistent signal (status bar / sidebar footer) from the actionable notification (toast / card)

### Slack

- **Location**: Badge on the help (?) icon in the toolbar
- **Detail**: User clicks help icon → sees update card → "Restart Slack" option
- **No interruption**: Upgrade never appears in the primary message list or sidebar nav
- **Lesson**: Slack chose the most peripheral surface (help icon), which makes it easy to miss. For a dev tool you can afford slightly more prominence while staying non-disruptive.

### Linear

- **Location**: Collaboration notifications live in a sidebar inbox with a red badge count
- **App version updates**: Invisible (web-app architecture); changelog is pull-based via Help menu
- **Major releases**: One-time full-screen welcome modal on first login (reserved for significant overhauls only)
- **Lesson**: The sidebar badge model works for notifications. For CLI tool version upgrades, something more explicit is warranted since the version number matters to developers.

### Raycast

- **Model**: Fully silent auto-update — no "upgrade available" notification, period
- **Post-update**: On next launch, a dedicated release notes window appears automatically
- **Two-tier system**: Silent for patches (nothing shown), announced for minor/major (release notes window)
- **Dismissibility**: Once dismissed, never reappears for that version
- **Lesson**: The two-tier system (silent patches, announced features) is the right urgency model. A patch update does not deserve the same sidebar real estate as a major release.

### GitHub Desktop — The Anti-Pattern

- **Updates**: Install silently on restart with no visible notification at all
- **Discovery**: Users must navigate to Help → About to see if an update is pending
- **Post-update**: No "what's new" experience
- **Outcome**: Long-standing GitHub issues (#3410, #5465, #20095) requesting visible notification
- **Lesson**: Invisible updates with no post-update acknowledgment erode user trust and make debugging version-related behavior changes impossible.

### Obsidian

- **Location**: Settings gear icon gets a dot badge when plugin or app updates are pending
- **Detail**: Settings → Updates panel shows all pending updates
- **Sidebar**: Reserved for vault navigation — no upgrade cards inline
- **Lesson**: The gear/settings icon badge is a clean signal layer for a developer tool that does not want to clutter the primary navigation sidebar.

### Cursor

- **Location**: Status bar at bottom shows current version on hover over the remote indicator
- **Updates**: Electron auto-update mechanism with a toast notification
- **Changelog**: Pull-based, announced via their changelog page
- **Lesson**: For an AI dev tool, the version in the status bar / sidebar footer is expected and welcome — developers want to know what version they are running.

### Figma, Notion

Both are pure web apps where application version updates are invisible. Their sidebar notification patterns cover collaboration only (mentions, assignments). Not directly applicable to DorkOS's version display requirement.

---

## Common Patterns Identified

### The Universal Three-Layer Structure

Every well-regarded app uses progressive disclosure:

1. **Layer 1 — Always visible, low signal**: A dot, badge, or small text in a peripheral location (status bar, sidebar footer). User is not interrupted.
2. **Layer 2 — One click away**: A card or popover with version delta, 2–3 sentence summary of what changed, clear CTA.
3. **Layer 3 — Optional**: Full release notes, changelog link — only on explicit user request.

### Where the Version Number Lives

- **Status bar / sidebar footer** is the near-universal persistent location
- **Settings → About** is the secondary location (every app has this; not sufficient alone for dev tools)
- When displayed in sidebar footer: muted, small text — `v1.2.3` in secondary/muted weight
- Never displayed prominently in the primary navigation area

### What Upgrade Cards Look Like

From Arc, VS Code, and Raycast:

- **Compact**: Does not span the full sidebar width or take up multiple rows by default
- **Version delta**: `v1.2.3 → v1.4.0` format is universal and expected
- **Single primary CTA**: "Update Now", "Restart to Apply", or "See What's New"
- **Secondary action**: Dismiss or full changelog link
- **Entrance**: Subtle — no attention-grabbing animation; it is there when you look for it

### Dismissibility Rules

- All well-designed systems make dismissal permanent for a given version
- Once dismissed for "v1.3.0", the card does not reappear until "v1.4.0"
- VS Code's historical bug (#48927) where this was not respected became a notorious complaint

### Urgency Tiers

| Update Type          | Recommended Pattern                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Patch (bug fix)      | Silent, no notification; or tiny muted dot only                                                                   |
| Minor (new features) | Sidebar pill/card — collapsed by default, passive                                                                 |
| Major (significant)  | Sidebar card + one-time post-update "What's New" summary on first launch                                          |
| Security             | Amber/red dot, card auto-expands, explicit "contains security fixes" copy, not dismissible without acknowledgment |

### Attention Indicators

- **Small colored dot** next to version number: most common low-signal indicator
- **Badge count**: works but easy to miss (Slack's approach)
- **`↑` arrow glyph**: common in developer tools as a terse upgrade signal
- **Pulsing/animated dots**: reserved for security-level urgency; creates noise fatigue if overused

---

## Anti-Patterns to Avoid

**1. Repeated notifications for the same version.**
If a user dismisses "v1.3.0 available", it must stay dismissed until v1.4.0. This is the most commonly reported complaint across VS Code, Slack, and other apps.

**2. Upgrade card that takes permanent sidebar space.**
A full-height card visible at all times competes with navigation and trains users to ignore it through over-familiarity. Use collapsed-by-default (Arc's pill model).

**3. Showing "upgrade available" in dev mode.**
When running from source with `version: "0.0.0"`, every published release looks like an upgrade. Show a `DEV` badge instead and suppress the upgrade card entirely. See `research/20260310_dev_version_display_upgrade_ux.md` for the full implementation pattern.

**4. Opening release notes in an external browser tab.**
Context is broken, user rarely returns. Open release notes inline (panel, drawer, or popover within the sidebar) or as a dedicated view within the app.

**5. Blocking work with a modal.**
Only justified for security patches that make running the old version unsafe.

**6. Invisible updates with no post-update summary.**
GitHub Desktop's failure mode — users never know what changed, cannot correlate behavior changes with versions.

**7. Notification fatigue from short re-surface intervals.**
The 24-hour TTL from `update-notifier` is the industry standard. Do not re-surface the upgrade card every session. Do not show it again for a dismissed version until the next version.

**8. Upgrade notification before command output in CLI.**
Can corrupt script parsing and confuses users running commands in pipes. Always end-of-output.

---

## Specific Recommendation for DorkOS

### Static Version Display (No Upgrade Available)

Place the version at the very bottom of the sidebar footer, below all navigation items. Style as muted, secondary-weight text:

```
v1.2.3
```

In dev mode, replace with an amber-tinted badge (no upgrade dot):

```
[DEV]  v0.0.0-dev
```

On hover: tooltip showing git SHA and build date if available. This follows the VS Code / Cursor status-bar convention adapted to a sidebar footer.

### Upgrade Available State — The Collapsed Pill Model

Adapt Arc's collapsed-pill-that-expands-on-hover for the sidebar footer:

**Collapsed (default state):**
A single row at the bottom of the sidebar footer. Current version in muted text, plus a small colored dot or `↑` glyph to signal an available update. No additional text; the dot is the signal. Total height: one row, same as the static version display.

**Expanded / on-click (detail state):**
A card animates open above the footer row (anchored to bottom, expands upward) showing:

- Version delta: `v1.2.3 → v1.4.0`
- 1–2 sentence highlight of what changed (from release API or GitHub releases)
- Primary CTA: "Update" (copies `dorkos update` to clipboard or shows the update command)
- Secondary: "See release notes" (opens changelog inline — a panel or drawer)
- Dismiss X — permanent for this version, stored in localStorage or a config file

**Urgency differentiation:**

- **Patch**: dot is `text-muted-foreground` gray, no animation, no auto-expand
- **Minor**: dot is brand accent color, no animation, no auto-expand
- **Major**: dot is more prominent (slightly larger), one-time post-update "What's New" card auto-shown on first launch after update
- **Security**: amber/red dot, card auto-expands without hover, explicit "Contains security fixes" copy, requires acknowledgment before dismiss

### Post-Update "What's New"

On first launch after a version change: auto-expand the card with "You're now on v1.4.0" header and 2–3 key changes summarized. Dismiss collapses permanently. This addresses the GitHub Desktop anti-pattern.

### Dev Mode Handling

Per `research/20260310_dev_version_display_upgrade_ux.md`:

- Server exposes `isDevMode: true` in version API response when running from source
- Client renders `DEV` badge with no upgrade dot and no upgrade card
- npm registry fetch skipped entirely (not just the UI — skip the network request)
- Test the upgrade flow with `DORKOS_VERSION_OVERRIDE=0.0.1` env var override

### CLI Layer

Separate from the sidebar UI, the CLI follows the `update-notifier` convention:

- End-of-output styled box with `current → latest` and the exact update command
- 24-hour TTL cache
- Skipped in CI / non-TTY contexts
- Skipped when `isDevBuild()` returns true (see the dev-mode research)

---

## Research Gaps & Limitations

- First-hand screenshots were not captured for this synthesis (the underlying reports relied on documentation, changelogs, and GitHub issues rather than direct screenshot analysis)
- Cursor's exact sidebar footer treatment for version display was not confirmed via direct inspection
- 1Password's sidebar version handling (listed as a research topic) was not in the prior research; it is a consumer password manager with different UX constraints and likely not the right reference point for a developer tool

---

## Sources

All sourcing is inherited from the two prior reports:

- `research/20260227_update_notification_ux_patterns.md` (30+ sources)
- `research/20260310_dev_version_display_upgrade_ux.md` (28 sources)

Key primary sources from those reports relevant to this synthesis:

- [Arc for macOS Release Notes (2024–2026)](https://resources.arc.net/hc/en-us/articles/20498293324823-Arc-for-macOS-2024-2026-Release-Notes)
- [VS Code UX Guidelines: Status Bar](https://code.visualstudio.com/api/ux-guidelines/status-bar)
- [VS Code UX Guidelines: Notifications](https://code.visualstudio.com/api/ux-guidelines/notifications)
- [Raycast v1.21.0 - An update about updates](https://www.raycast.com/changelog/macos/1-21-0)
- [Update the Slack Desktop App](https://slack.com/help/articles/360048367814-Update-the-Slack-desktop-app)
- [GitHub Desktop Issue: Ability to NOT auto-update #20095](https://github.com/desktop/desktop/issues/20095)
- [Calm Technology](https://calmtech.com/)
- [Progressive Disclosure — Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/)
