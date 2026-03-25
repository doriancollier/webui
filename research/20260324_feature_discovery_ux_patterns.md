---
title: 'Feature Discovery & In-Product Education UX Patterns'
date: 2026-03-24
type: external-best-practices
status: active
tags:
  [
    feature-discovery,
    feature-adoption,
    ux-patterns,
    in-product-education,
    progressive-disclosure,
    contextual-promotion,
    saas,
    developer-tools,
  ]
searches_performed: 28
sources_count: 45
---

## Research Summary

Across ten best-in-class platforms — Linear, Slack, Notion, Raycast, Arc, GitHub, Vercel, Stripe, Figma, and 1Password — feature discovery after initial setup converges on a clear hierarchy: **passive, always-accessible mechanisms outperform intrusive, push-based ones** for developer and power-user audiences. The most effective pattern is the "pull + light nudge" combination: a persistent but unobtrusive entry point (a gift icon, a sidebar item, a "What's New" link) paired with a single contextually-timed notification at the moment a feature becomes relevant. The industry data confirms what the design community knows intuitively: pop-up modals see 15–25% CTA click rates while irrelevant announcements are ignored by 80%+ of users. For DorkOS specifically — serving Kai (runs 10+ agents/week) and Priya (staff engineer, flow-obsessed) — the high-trust patterns from Linear, Vercel, and Stripe's design system are the strongest models.

---

## Key Findings

1. **The dominant pattern is "passive discovery with active opt-in."** Airtable's permanent nav item, HelpScout's dropdown, Linear's changelog with login notification: these all share the same philosophy — information waits for users rather than demanding attention. This directly contradicts the impulse to use modals.

2. **Contextual triggering is the decisive variable.** The same announcement can be effective or annoying based purely on timing. Stripe shows payment feature education only on the payments page. Notion triggers tooltips "exactly when the user can experience the new feature." Slack showed its Huddles modal when users entered a channel where Huddles would be useful.

3. **Developer tools specifically reject forced tours.** Vercel's design philosophy is self-explanatory interfaces. Raycast uses search-driven discovery with zero push-based announcements. GitHub's `?` shortcut modal is entirely user-triggered. Stripe's design system explicitly forbids promotional content in empty states.

4. **Engagement vs. dismiss data:** Good modal CTAs run 15–25%. Banners see 2–5%. 81% of users ignore irrelevant messages. Context-triggered announcements see 60% higher adoption. Linear achieves 60% monthly changelog engagement vs. industry average of 10–15%.

5. **The dismissal UX matters as much as the trigger.** Permanent dismissal is expected for one-time callouts. "Learn more later" options reduce anxiety. Non-dismissible promotions (like 1Password's passkey banner) generate user frustration and support tickets requesting removal.

6. **Empty states are the highest-trust moment for education.** Vercel's design system codifies four empty state types (Blank Slate, Informational, Educational, Guide) for exactly this reason. Empty states are educationally dense because the user has zero task-in-progress — maximum cognitive availability.

---

## Platform-by-Platform Analysis

### Linear

**Mechanisms used:** In-app login notification (push, one-time per feature) + external changelog at `linear.app/changelog` + email newsletter + social.

**Where it appears:** A notification appears at login when new features have shipped. The changelog is accessible from the Help section in the bottom sidebar.

**How triggered:** Login-based — when you sign in after a new feature has shipped, you see a notification. The changelog itself is always-accessible and user-initiated.

**CTA pattern:** "See what's new" language. Changelog entries use benefit-driven language ("Your dashboard now loads 2x faster") rather than feature-first language ("Dashboard performance improvements"). GIF/video demonstration embedded in each entry.

**Dismissal:** One-time notification; no snooze needed — it doesn't reappear after you've seen it.

**Visual treatment:** The notification is a non-blocking callout, not a full-screen modal. The changelog page itself uses a clean editorial layout with strong visual hierarchy and embedded media.

**Why it works:** Linear's changelog achieves 60% monthly user engagement versus the industry average of 10–15%. Their co-founder attributes this to treating each changelog entry as a product announcement — visual, benefit-led, human-authored — not a commit log. The multi-channel distribution (in-app + email + social) means users encounter updates in the context most convenient for them.

**Key quote:** "For users, it shows the product is getting better. For investors, it shows progress." — Karri Saarinen, Linear co-founder.

---

### Slack

**Mechanisms used:** Multi-step spotlit modal for major UI changes + pulsing hotspot + sidebar gift icon for changelog + in-app survey for personalization.

**Where it appears:** For major launches (like the UI redesign), a spotlit modal appears at app open. Ongoing feature announcements use the gift/what's-new icon in the left sidebar. Pulsing hotspots appear directly adjacent to newly-added UI elements.

**How triggered:** State-based for major announcements (one-time per major release). Hotspots are feature-adjacent (appear next to the new UI element). Gift icon is always-accessible.

**CTA pattern:** "Let's Go" initiates the guided tour from the modal. The tour can be relaunched from the help center at any time, so there's no anxiety about missing it.

**Dismissal:** Modal has explicit "skip" or can be completed. The guided tour is relaunchable, removing pressure to absorb everything immediately.

**Visual treatment:** The spotlit modal uses a simple headline ("A simpler, more organized Slack") + single image + CTA. Pulsing hotspots are animated blue dots that draw the eye without blocking interaction.

**Why it works:** Slack's 35% higher retention among Workflow Builder users vs. basic messaging users led them to prioritize Workflow Builder in their education flow. The "perfectly timed modal" + hotspot combination for Huddles converted a sidebar icon into a daily habit for millions of users.

**Pattern to study:** Slack's in-app surveys (e.g., "Do you work with people outside your company?") personalize which features to surface next. This turns feature discovery into a conversation rather than a broadcast.

---

### Notion

**Mechanisms used:** Contextual feature announcement tooltip (multi-step, formatted) + dedicated "What's New" page + changelog accessible from `?` help icon.

**Where it appears:** Tooltips appear precisely where the new feature is accessible — triggered when a user navigates to the relevant section for the first time after the feature ships.

**How triggered:** Context-dependent and state-based. The tooltip appears "exactly when the user can experience the new feature" — not on login, not on a timer.

**CTA pattern:** The tooltip is signed by a real person ("David from Notion") at the top, creating a personal feel. Content uses emojis and formatted text to break up length. Two-step structure: (1) what the feature is in one sentence, (2) how to use it.

**Dismissal:** Standard tooltip dismissal (click elsewhere or X).

**Visual treatment:** Black/white palette with strong box shadowing to make the tooltip visible against the editor canvas. The personal attribution ("David from Notion") is the distinctive element — it reads as a message from a colleague, not a system alert.

**Why it works:** The contextual trigger is the key — users encountering the tooltip while in the feature area are already in the right mental model. Notion also demonstrates that long-form tooltip copy can work when properly formatted and humanized.

---

### Raycast

**Mechanisms used:** Search-driven discovery (primary mechanism) + external changelog at `raycast.com/changelog` + "Raycast Wrapped" annual usage recap + email/community newsletter.

**Where it appears:** Raycast's primary in-product philosophy is that discovery happens through use, not announcement. The extension Store is search-driven with no algorithmic curation or "New" badges. Extensions surface through the search interface.

**How triggered:** Entirely user-initiated. Raycast does not push in-app notifications about new features. Updates are deployed "seamlessly" without disrupting users, and release notes are published to the external changelog.

**CTA pattern:** The changelog uses visual, benefit-led entries. "Raycast Wrapped" (annual) provides personalized usage insights (launches, extensions used, AI usage stats) that retroactively surface features users haven't discovered.

**Dismissal:** No dismissal needed — nothing is pushed.

**Visual treatment:** The in-app experience is intentionally clean of announcements. All feature education is pull-based.

**Why this is notable:** Raycast is the strongest example of the "self-explanatory product" philosophy. Four years in, users still report discovering new Raycast capabilities — but through exploration, not prompts. This aligns with their power-user audience that actively resists tutorial-style education.

**Tension to note:** The cost of zero push announcements is that features can go undiscovered. Raycast accepts this tradeoff because their audience (developers who read changelogs) finds pull-based discovery respectful.

---

### Arc Browser

**Mechanisms used:** Weekly release notes as in-product Easel (interactive canvas document) + email + one-time "banner" for specific major behaviors (e.g., Auto Archive activation notice).

**Where it appears:** The release notes are accessible from within the Arc sidebar via "See What's New" — they open as an Easel (Arc's canvas/whiteboard feature), meaning they're an actual interactive web document, not a separate page.

**How triggered:** New release notes appear weekly on Thursdays. The "See What's New" entry point is persistent in the sidebar. For behavior-changing features (like Auto Archive), a one-time in-product banner appears to inform the user what changed.

**CTA pattern:** Arc's release notes are intentionally "scrappy, unpolished, and loveable" — featuring quirky fonts, hand-drawn arrows, emojis, retro icons, and casual language. Each entry attributes the feature to a named team member ("Seb made this for you"). This removes the corporate distance from feature announcements entirely.

**Dismissal:** The weekly notes don't need dismissal — they're a document you navigate to. The one-time banner for behavior changes (Auto Archive) is shown once and not repeated.

**Visual treatment:** Arc's release notes are visually distinct from typical changelogs by being full interactive Easels — you can embed video, add links, and make them feel like designed documents rather than commit logs. The personal attribution to team members is the brand signature.

**Why it works:** Arc built community loyalty through this "build in public" approach. Users looked forward to Thursday release notes as content, not product notifications. During the private beta, Arc also did 1:1 Zoom onboarding sessions to ensure users understood the novel browser model — showing investment in education during high-stakes moments.

---

### GitHub

**Mechanisms used:** `?` keyboard shortcut for a context-aware shortcuts modal + GitHub Changelog blog (`github.blog/changelog`) + `Cmd+K` command palette with inline feature hints + periodic banner notifications for significant platform changes.

**Where it appears:** The `?` shortcuts modal is context-aware per page — it shows only shortcuts relevant to your current view. Changelog is external. Banners appear in the global header for important account or compliance notifications.

**How triggered:** `?` is entirely user-initiated. Banners are state-based (triggered by account conditions or new significant features like Copilot availability). The command palette always shows shortcuts inline.

**CTA pattern:** GitHub's changelogs use clear, category-tagged entries ("copilot", "actions", "security") so users can filter by relevance. Copilot now surfaces in the user's github.com dashboard (in public preview) with a contextual widget.

**Dismissal:** The `?` modal closes on Escape or outside-click. Banners for account issues are non-dismissible until resolved; informational banners can be dismissed.

**Visual treatment:** GitHub's in-product design is deliberately low-prominence for feature promotion. The philosophy is "discoverability through navigation" — new features appear in the nav where they belong, without sparkle effects.

**Notable pattern:** GitHub's command palette (`Cmd+K`) is the richest discoverability surface. Every action shows its keyboard shortcut inline, teaching power users contextually as they use the product. GitHub also uses a "Preview" label (replacing "Alpha"/"Beta") for unreleased features to signal state clearly.

---

### Vercel

**Mechanisms used:** Four-tier empty state design system (Blank Slate, Informational, Educational, Guide) + external changelog at `vercel.com/changelog` + toolbar for local dev feature flagging.

**Where it appears:** Empty states appear throughout the dashboard wherever no data exists yet — Vercel treats these moments as educational opportunities. The changelog is external. The Vercel Toolbar appears in local development environments to surface feature flags.

**How triggered:** Empty states are structural — they appear when conditions are empty. Educational empty states launch contextual onboarding flows. Guide states provide starter content for hands-on learning. The changelog is always-accessible.

**CTA pattern:** Vercel's design system specifies that informational empty states must explain "the actions you can take on this screen, as well as why it's valuable" — pairing an explanation with a primary action button and documentation links. The philosophy: show over tell, functional over decorative.

**Dismissal:** Empty states are replaced by real content as the user acts — no explicit dismiss needed.

**Visual treatment:** Vercel follows their broader design philosophy of "respecting developer time." The dashboard redesign explicitly avoided heavy onboarding in favor of intuitive interfaces that don't require explanation. Feature education is embedded in the structure rather than layered on top of it.

**Key design system quote:** Four empty state types:

- **Blank Slate**: Basic first-run experience.
- **Informational**: Alternative first-use with inline CTAs and documentation links.
- **Educational**: Launches a contextual onboarding flow for deeper understanding.
- **Guide**: Starter content for learning by tinkering.

**Why this is notable for DorkOS:** Vercel serves the exact same audience (developers who dismiss "another wrapper") with the same design philosophy (self-explanatory interfaces, respect developer time). Their empty state taxonomy is directly applicable.

---

### Stripe Dashboard

**Mechanisms used:** Contextual notification banners for required actions + developer-focused empty state patterns with contextual deep-links + activity hub for notifications + external changelog + Stripe Apps design system that explicitly bans promotional content in app views.

**Where it appears:** The notification banner component renders at the top of connected account views for risk interventions and compliance actions. The activity hub shows notifications about payouts, disputes, and setting changes. Empty states link directly to the relevant dashboard page.

**How triggered:** State-based. The notification banner appears only when there is a required action (risk intervention, compliance requirement). Stripe Radar's redesigned dashboard fraud workspace surfaces a centralized view only when relevant.

**CTA pattern:** Stripe's notification banners are strictly functional — they communicate required actions, not feature education. Stripe's design guidelines for third-party apps explicitly state: "All content, including images, need to be functional and purposeful, helping your user with the job they're trying to achieve. It's not the space to promote your own app or do marketing."

**Dismissal:** Action-required banners are non-dismissible (they require action). Informational notifications can be dismissed.

**Visual treatment:** Minimal. Stripe's dashboard design philosophy: show key metrics first (revenue, payments, customers), keep everything contextual, reduce drop-off by linking directly to relevant sections.

**Why this is notable:** Stripe's explicit ban on promotional content in their app platform is the strongest statement in this research about the line between feature education and marketing. For a payments product trusted with financial data, pushing features erodes trust. Their focus on "contextual views reduce drop-off" directly validates the contextual trigger principle.

---

### Figma

**Mechanisms used:** Dedicated `figma.com/whats-new` and `figma.com/release-notes` external pages + "Finger Tips" shortcuts panel (non-blocking, gamified) + Config conference for major feature launches + monthly Release Notes livestreams (debut October 2024) + "What's New" entry in bottom-right `?` help panel.

**Where it appears:** The "Finger Tips" keyboard shortcuts panel sits at the bottom of the canvas (non-blocking). Release notes are external. The `?` help button in the bottom-right provides always-accessible entry to shortcuts and release notes.

**How triggered:** The `?` help button is always accessible. The "Finger Tips" panel opens via `Ctrl+Shift+?`. Major feature discovery happens through Config (annual conference) + monthly livestreams + social media.

**CTA pattern:** Figma uses gamification in the shortcuts panel — it highlights shortcuts you've already used, and listens to your keyboard in real time to reinforce learning. Release notes use a badge system to tag features by type and add visual richness.

**Dismissal:** The "Finger Tips" panel is a toggle — open when you want it, out of the way otherwise. Release notes are entirely pull-based.

**Visual treatment:** Figma's release notes page uses a sophisticated grid layout with categorical headers, feature titles, badge system, and rich text. The monthly Release Notes livestreams are the most innovative format — treating changelogs as live events creates appointment viewing for power users.

**Why it works:** Figma ships 180+ releases per year. Their external release notes infrastructure (dedicated page, categorized, badge-tagged, multilingual) is built for scale. The Finger Tips panel's gamification ("these are shortcuts you haven't used yet") is the most sophisticated ongoing feature discovery mechanism in this group.

---

### 1Password

**Mechanisms used:** Watchtower system for security-driven feature education + purple banner in the browser extension for high-priority alerts + "Passkeys Available" section in Watchtower sidebar + contextual prompts during autofill.

**Where it appears:** Watchtower alerts appear as banners throughout 1Password (app and extension). The browser extension shows a prominent purple banner that occupies ~20% of visible screen. The Watchtower section in the sidebar shows a "Passkeys available" list for sites that support passkeys but don't have one saved.

**How triggered:** Security-state-based. The Watchtower banner appears when 1Password detects a breach, reused password, or passkey-eligible site without a passkey saved. The passkey prompt appears during autofill when a site supports passkeys.

**CTA pattern:** "Use passkey" button in the Watchtower sidebar items. In-autofill prompt suggests upgrading to passkeys. The passkey banner in the browser extension uses purple as a high-attention color.

**Dismissal:** This is the most notable tension point in 1Password's pattern: the passkey Watchtower banner in the browser extension could only be dismissed by disabling ALL Watchtower alerts, not individual alert types. Users filed support tickets requesting granular control. This represents a failed dismissal UX.

**Visual treatment:** Purple for high-attention alerts. Watchtower items show an alert badge throughout the app.

**Why the failure matters:** The community discussion about the non-dismissible passkey banner is a case study in what happens when you conflate feature education with required-action notifications. Users trusted 1Password's alert system for genuine security issues. Using that same system for feature adoption (passkeys) degraded trust in the whole system. 1Password filed an internal feature request to add granular control.

---

## Synthesis: General Best Practices

### The Engagement vs. Dismissal Spectrum

Research establishes a clear spectrum from "never noticed" to "actively annoying":

```
← Less intrusive                                              More intrusive →

Changelog page   Sidebar item   New badge   Hotspot   Contextual   Timed modal   Blocking
(pull only)      (persistent)   (nav item)  (pulsing) tooltip      (popup)       modal
     ↑                                                    ↑
  Works for                                           Best ROI
  pull-only                                           zone for
  audiences                                           most users
```

Engagement data:

- Good modal CTAs: **15–25%** click-through
- Banners: **2–5%** click-through
- Contextual onboarding: up to **60% higher adoption**
- Irrelevant messages: ignored by **81%** of users
- Linear's changelog: **60% monthly engagement** vs. 10–15% industry average

### The Five Patterns That Work

**1. Passive Always-Accessible Entry Points**

A persistent "What's New," bell icon, or gift icon in the navigation provides feature discovery for users who want it, without demanding attention from users in the middle of a task. This is the lowest-friction mechanism and the highest-trust. Examples: Linear's sidebar link, Airtable's permanent nav item, Figma's `?` button, GitHub's `?` modal.

**2. Contextual Single-Shot Tooltips**

A tooltip or popover that appears exactly once, triggered when the user navigates to the area where the feature lives. Not on login, not on a timer — on context. Key rules: personalize the message (Notion's "David from Notion"), format for readability (emojis, bold, 2-step structure), allow immediate dismissal. This is the strongest mechanism for "we shipped something you'll use right here."

**3. Hotspots / Pulsing Beacons**

A small animated dot adjacent to a new UI element. Non-blocking, non-intrusive. Users interact at their own pace. Clicking expands a contextual tooltip. Best for: new menu items, new toolbar buttons, new nav entries. Works because it signals "something is here" without saying "you must look at this now." Examples: Slack's pulsing hotspot for Huddles.

**4. Enriched Empty States**

When a section has no data, the empty state is the highest-cognitive-availability moment a user will experience in that context. Vercel's design system explicitly encodes four types: Blank Slate, Informational, Educational, and Guide. The best empty states: explain what the section does, show the value proposition in one sentence, offer a direct CTA to create the first item, and link to documentation. This converts a potentially frustrating moment into a feature education moment.

**5. Changelog as Content Product**

Linear and Arc demonstrate that a changelog can be a genuine engagement driver if it's treated as a content product rather than a commit log. Key properties: visual (GIFs, screenshots, video), benefit-led ("loads 2x faster" not "performance improvements"), human-authored, personally attributed. Linear's 60% monthly engagement vs. 10–15% industry average is the clearest data point for this approach.

### The Three Anti-Patterns

**1. Blocking modal on login for feature announcements**

Interrupts the user's intent without context. They logged in to do something specific. They have zero frame of reference for why this feature matters right now. Even if they "engage," research shows it's mostly reflexive dismissal that trains users to dismiss everything. Reserved only for: breaking changes, critical security notices, required compliance actions.

**2. Non-dismissible or hard-to-dismiss promotions**

1Password's passkey banner (required disabling all Watchtower to dismiss) eroded trust in their security notification system. Any feature promotion that cannot be cleanly dismissed on first encounter will generate frustration among power users who notice the conflict between "promotional" and "actionable."

**3. Conflating feature education with required-action alerts**

The most damaging pattern: using the same visual language (banners, color, icons) for feature promotion as for required actions. Stripe's design guidelines explicitly prohibit this — their system reserves banners for risk and compliance. When feature education uses urgency signals, it degrades the urgency signal for everything.

### What Makes Users Engage vs. Dismiss

**Engage:**

- Triggered in the right context (user is already thinking about this domain)
- Benefit-first language ("now you can do X") not feature-first ("introducing Y")
- Personally attributed or personalized ("David from Notion," Slack survey-based personalization)
- Respectful of current task (non-blocking, easy to dismiss)
- Provides value even as a passive read (changelogs as content)
- Offers a direct activation path (one click to try the feature)

**Dismiss:**

- Irrelevant to current context
- Appears on login before any task context exists
- Uses urgency/color that signals "this requires action" when it doesn't
- Requires navigation away from current task to experience the feature
- Non-dismissible or requires settings to disable
- Jargon-heavy or feature-function framed ("we've added X to the Y system")

### The "4T Model" for Feature Discovery

A useful framework from the research: **Target, Trigger, Tell, Take action.**

1. **Target**: Who should see this? (segment by role, usage pattern, feature eligibility)
2. **Trigger**: When is the right moment? (context-based, not time-based)
3. **Tell**: What's the minimum message that creates understanding? (benefit-first, one sentence)
4. **Take action**: What's the direct path to try it? (one click, no navigation)

### Progressive Disclosure as a Permanent Philosophy

Progressive disclosure is not an onboarding state — it is a permanent information architecture decision. The research (and Nielsen Norman Group) establishes a practical limit: more than 2 levels of disclosure nesting creates usability problems because users get lost. For multi-module products, the top-level view must be scannable as a flat list, not a hierarchy.

**Practical implications:**

- Most valuable features visible in primary navigation (not buried in settings)
- Advanced features accessible through deliberate navigation (not accidental encounter)
- Help and "What's New" always 1 click away from any state
- No feature requires more than 3 clicks to reach from the dashboard

---

## Patterns Most Relevant for DorkOS

Given DorkOS's primary persona (Kai: expert developer who actively dismisses "chatbot wrappers") and secondary persona (Priya: staff engineer who loses 15 minutes of mental state to context switches), the following patterns from this research are most applicable:

**High applicability:**

- **Vercel's empty state taxonomy**: DorkOS has many "first-time use" surfaces (Pulse with no schedules, Relay with no adapters, Mesh with no agents). Each is an educational opportunity.
- **Linear's changelog strategy**: Treating the DorkOS changelog as a content product, not a commit log. Kai reads changelogs. Make them worth reading.
- **GitHub's `?` modal / Figma's `?` button**: A persistent help entry point accessible from every state, showing contextually relevant shortcuts and feature highlights.
- **Hotspot beacons on new nav items**: When a new feature ships as a new sidebar item or section, a single pulsing dot indicates newness without demanding attention.
- **Raycast's philosophy**: Zero push announcements in-product. All discovery is pull. This is the correct default for a power-user audience.

**Medium applicability:**

- **Notion's contextual tooltip**: For specific moments where a feature is new and the user is in the right context, a single multi-step tooltip (with personal attribution) can work. Use sparingly — maximum once per major feature, never on login.
- **Slack's hotspot + modal for major UI changes**: If DorkOS makes a structural UI change (new navigation, renamed concepts), a one-time spotlit modal on the NEXT app open (not on login if they just logged in to do something) with "Let me show you what changed" is acceptable.

**Low applicability:**

- Blocking modals
- Sidebar gift icons that accumulate unread badges
- Banners reusing the visual language of system alerts
- Any mechanism that interrupts Priya mid-flow

---

## Research Gaps

- **Linear's exact in-product notification UI** could not be confirmed from screenshots — the login notification behavior was described by third-party sources, not official documentation
- **Figma's in-product announcement mechanism** (beyond the external release notes page and `?` button) was difficult to pin down specifically from available sources
- **Arc browser** has shifted focus toward its successor product (Dia) in 2025; its feature education patterns may evolve significantly
- **Stripe's internal dashboard** (for Stripe employees using their own product) could not be accessed; research is based on the public-facing dashboard and design system docs
- **1Password's current state** of the passkey banner dismissal issue (whether granular control was shipped) was not confirmed

---

## Sources & Evidence

- [Linear Changelog Strategy Deep Dive](https://blog.getsimpledirect.com/linears-changelog-strategy-a-deep-dive-and-what-you-can-learn/) — 60% monthly engagement stat, in-app login notification, benefit-led language
- [Linear Changelog](https://linear.app/changelog) — format reference
- [Slack Redesign Product Update Tour – GoodUX/Appcues](https://goodux.appcues.com/blog/slack-redesign-product-update-tour) — spotlit modal, pulsing hotspot, "Let's Go" CTA, relaunchable tour
- [Slack's Product Strategy – ProductPlan](https://www.productplan.com/learn/slack-product-strategy/) — Workflow Builder 35% retention stat
- [Slack Feature Drops Blog](https://slack.com/blog/news/feature-drop) — feature drop cadence
- [Notion Feature Announcement Tooltip – UserOnboarding Academy](https://useronboarding.academy/user-onboarding-inspirations/notion-feature-announcement) — "David from Notion," 2-step tooltip, contextual trigger
- [Notion What's New](https://www.notion.com/releases) — release cadence
- [Raycast Changelog](https://www.raycast.com/changelog) — release note format
- [Raycast Manual – Store](https://manual.raycast.com/store) — search-driven discovery, no algorithmic curation
- [Raycast Wrapped 2025](https://www.raycast.com/changelog/macos/1-104-0) — annual usage recap pattern
- [Arc Browser Release Notes](https://resources.arc.net/hc/en-us/articles/20498293324823-Arc-for-macOS-2024-2026-Release-Notes) — Easel-based weekly notes
- [Arc's Build-In-Public Playbook – Strategy Breakdowns](https://strategybreakdowns.com/p/arc-release-notes) — Thursday cadence, personal attribution
- [ARC Browser Release Notes Review – Ducalis](https://hi.ducalis.io/changelog/examples/arc-broweser-release-notes-in-app) — non-breaking notifications, multi-channel distribution
- [How Arc Grows – How They Grow](https://www.howtheygrow.co/p/how-arc-grows) — "magic moments," 1:1 Zoom onboarding in beta, human attribution
- [GitHub Copilot Features](https://github.com/features/copilot/whats-new) — Copilot dashboard integration
- [GitHub Changelog](https://github.blog/changelog/) — changelog format and cadence
- [Vercel Empty State Design System](https://vercel.com/geist/empty-state) — four empty state types
- [Vercel Changelog](https://vercel.com/changelog) — external changelog structure
- [Vercel New Dashboard](https://vercel.com/try/new-dashboard) — self-explanatory philosophy
- [Stripe Apps Patterns – Empty State](https://docs.stripe.com/stripe-apps/patterns/empty-state) — contextual deep-links, no promotional content
- [Stripe Apps Design Guidelines](https://docs.stripe.com/stripe-apps/design) — ban on promotional content in app views
- [Stripe Dashboard Basics](https://docs.stripe.com/dashboard/basics) — activity hub, notification banners
- [Figma Release Notes](https://www.figma.com/release-notes/) — 180 releases/year, badge system
- [Figma What's New](https://www.figma.com/whats-new/) — dedicated page structure
- [Figma Keyboard Shortcuts (Finger Tips)](https://help.figma.com/hc/en-us/articles/360040328653) — non-blocking panel, gamification
- [1Password Watchtower – Passkey Banner Thread](https://www.1password.community/discussions/1password/disable-watchtower-banner-for-passkeys-in-the-browser-extension/54344) — purple banner, 20% screen space, failed dismissal UX
- [1Password Watchtower](https://support.1password.com/watchtower/) — feature education through security alerts
- [What In-App Announcements Get Wrong – LaunchNotes](https://www.launchnotes.com/blog/what-in-app-product-announcements-get-wrong) — dismiss fatigue, passive discovery superiority
- [Feature Discovery Patterns – UserGuiding](https://userguiding.com/blog/feature-discovery) — 4T model, mechanism taxonomy
- [Feature Adoption 101 – Userpilot](https://userpilot.com/blog/feature-adoption-101/) — four adoption funnel stages, engagement metrics
- [How to Use Feature Discovery – Userpilot](https://userpilot.com/blog/improve-feature-discovery-product-adoption/) — changelog/in-app pattern comparison
- [Hotspots in User Onboarding – Usetiful](https://blog.usetiful.com/2022/03/hotspots-and-their-purpose-in-user.html) — hotspot definition and best practice
- [Progressive Disclosure – Lollypop Design](https://lollypop.design/blog/2025/may/progressive-disclosure/) — permanence of disclosure philosophy
- [How to Increase SaaS Feature Adoption – Hopscotch](https://hopscotch.club/blog/how-to-increase-saas-feature-adoption) — contextual adoption, Slack Huddles case study
- [Feature Discovery & Adoption – StriveCloud](https://www.strivecloud.io/blog/feature-discovery-user-engagement) — behavior-triggered vs. generic announcement comparison
- [Feature Adoption Metrics – Userpilot](https://userpilot.com/blog/feature-adoption-metrics/) — 20-30% typical adoption stat, 60% contextual improvement
- [Design Interventions for Feature Discovery – Prakash Shukla / Medium](https://medium.com/shuklaprakash/design-interventions-to-enable-feature-discovery-a3c815c9b778) — Airtable nav item, HelpScout dropdown, Postmark email model
- [11 Inspiring Feature Announcement Examples – UserGuiding](https://userguiding.com/blog/new-feature-announcement-example) — multi-platform comparison

---

## Search Methodology

- Searches performed: 28
- Most productive search terms: "in-product education," "feature discovery UX patterns," "changelog strategy," "contextual onboarding," "hotspot beacon tooltip SaaS," platform-specific terms combined with "in-product announcement" and "dismissal"
- Primary source types: Product design blogs, official documentation, design system pages, UX analysis articles, community forum threads (for failure case studies)
- Key constraint: Several major platforms (Figma's exact in-product notification UI, Linear's login notification visual) were not directly documentable from public sources — patterns inferred from secondary analysis and third-party writeups
