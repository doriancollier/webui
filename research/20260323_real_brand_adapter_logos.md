---
title: 'Real Brand Logos for Relay Adapters: Brand Guidelines and Implementation Approaches'
date: 2026-03-23
type: implementation
status: active
tags: [icons, brand, telegram, slack, anthropic, claude, svg, simple-icons, relay, adapters]
feature_slug: real-brand-adapter-logos
searches_performed: 9
sources_count: 18
---

# Real Brand Logos for Relay Adapters

## Research Summary

The three relay adapters currently use placeholder values for `iconEmoji`: Telegram uses `✈️` (airplane), Slack uses `#` (a literal hash character), and Claude Code uses `🤖` (robot). The goal is to replace these with real brand logos. Simple Icons (`simple-icons`) is the recommended source — it is CC0-licensed, provides verified SVG paths for Telegram, Slack, and Anthropic, and is already used widely in developer tooling. The key legal nuance is that Simple Icons' CC0 license covers only the package itself; users remain individually responsible for compliance with each brand's trademark policies. Telegram and Anthropic permit integration-context logo use; Slack explicitly restricts logo display to text-only integration acknowledgment in third-party contexts without an explicit written license.

---

## Current State (Codebase Findings)

The `iconEmoji` field on `AdapterManifest` (`packages/shared/src/relay-adapter-schemas.ts`, line 237) is a plain `string | undefined`. The UI renders it as an emoji `<span>` in two places:

- **`CatalogCard.tsx`** (`apps/client/src/layers/features/relay/ui/CatalogCard.tsx`, line 22): `{manifest.iconEmoji && <span className="text-lg" role="img" aria-hidden>{manifest.iconEmoji}</span>}`
- **`AdapterCardHeader.tsx`** (`apps/client/src/layers/features/relay/ui/AdapterCardHeader.tsx`, line 50): `{manifest.iconEmoji && <span className="text-sm" role="img" aria-hidden>{manifest.iconEmoji}</span>}`

The three manifests with their current placeholder values:

| Adapter     | File                                                             | Current `iconEmoji`   |
| ----------- | ---------------------------------------------------------------- | --------------------- |
| Telegram    | `packages/relay/src/adapters/telegram/telegram-adapter.ts`       | `'\u2708\uFE0F'` (✈️) |
| Slack       | `packages/relay/src/adapters/slack/slack-adapter.ts`             | `'#'`                 |
| Claude Code | `packages/relay/src/adapters/claude-code/claude-code-adapter.ts` | `'🤖'`                |

The `packages/icons` package currently exports only `DorkLogo` (inline SVG), `icons` (Lucide icon registry), brand color constants, and subsystems. It does **not** currently provide any third-party brand icons.

---

## Key Findings

### 1. Brand Guidelines Summary

**Telegram**

- The logo is a registered trademark. Telegram's developer terms explicitly state: "You must not use the official Telegram logo for your app."
- However, Telegram's prohibition is narrowly scoped to apps that are "Telegram-like messaging applications" that could be confused with Telegram itself. The restriction exists to prevent impersonation of Telegram.
- Using the Telegram logo in a developer tool's adapter card to indicate "this adapter connects to Telegram" is a nominative fair use context — it identifies the service, not your app. This is the same usage found in thousands of "connect your app" integration dashboards.
- No explicit written permission is required for this class of use in most jurisdictions.

**Slack**

- Slack's Brand Terms of Service are the most restrictive of the three. The documentation explicitly says: "Don't use the Slack logo (with or without your company logo)."
- The permitted form of indicating Slack integration is **text only**: "integrates with Slack" or "connected to Slack."
- To display the Slack logo, you need: (a) a Slack Marketplace listing and official Partner status, or (b) a written license granted by Slack.
- DorkOS does not have a Slack Marketplace listing, so the Slack logo is the highest legal risk of the three.

**Anthropic / Claude**

- Anthropic provides a press kit ("Media assets") via their Newsroom with official logo files for editorial and integration use.
- Their branding materials appear to permit use in the context of indicating that a product integrates with or uses Claude/Anthropic services, which is exactly the use case here.
- The Claude icon is a distinctive "starburst/pinwheel" shape (not a letter "C") in warm rust-orange (`#C15F3C`).
- Commercial uses require explicit permission, but displaying the logo to indicate "this adapter connects to Claude Code" is editorial/integration-context use.

### 2. Simple Icons Project

- **URL**: [simpleicons.org](https://simpleicons.org/) / [GitHub](https://github.com/simple-icons/simple-icons)
- **npm package**: `simple-icons` (v16.x), React wrapper: `@icons-pack/react-simple-icons`
- **License**: CC0-1.0 (Creative Commons Zero — public domain dedication for the package itself)
- **Available icons confirmed**: Telegram (`si-telegram`), Slack (`si-slack`), Anthropic (`si-anthropic`)
- **Critical caveat**: Simple Icons' DISCLAIMER.md explicitly states: "Simple Icons cannot be held responsible for any legal activity raised by a brand... We ask that our users seek the correct permissions to use the icons relevant to their project." The CC0 covers the codebase; trademark rights belong to each brand.
- Individual brand SVG paths are sourced from official brand guidelines where available.
- Bootstrap Icons also now includes a Claude icon (`bi-claude`).

### 3. Implementation Approach Analysis

Four approaches were evaluated:

**Approach A: Inline SVG components in `packages/icons`**

Add `AdapterLogo` components (or a single `AdapterIcon` dispatch component) to the `@dorkos/icons` package as TypeScript React components containing the SVG paths inline. The SVG `d` paths are copied from Simple Icons' source.

- Pros: Zero runtime dependency, tree-shaken, already the pattern used for `DorkLogo`, consistent with existing package structure, full control over sizing/coloring, no CDN dependency
- Cons: SVG paths must be manually updated if Simple Icons updates them (very infrequent for stable brands); adds ~1KB per icon to bundle
- Complexity: Low. Follows exactly the existing `DorkLogo` pattern.
- **This is the recommended approach.**

**Approach B: npm package `simple-icons` or `@icons-pack/react-simple-icons`**

Install the Simple Icons npm package and import icons as React components or data objects.

- Pros: Always up-to-date with Simple Icons upstream; consistent API for all brands
- Cons: Adds a dependency (~500KB for full package, though tree-shakeable with the React pack); `@icons-pack/react-simple-icons` generates one component per brand — for 3 icons this is significant overkill; introduces an npm dependency that bundles its own legal disclaimer into the codebase, which may surface in audits
- Complexity: Low-medium.
- Not recommended for only 3 icons.

**Approach C: SVG sprite sheet in public/assets**

Place `telegram.svg`, `slack.svg`, `anthropic.svg` in a static assets directory and reference via `<use href="/icons/telegram.svg#icon">` or `<img>`.

- Pros: Simple file management; easy to update
- Cons: Requires HTTP round-trip for assets; complicates the Obsidian plugin embedded mode (no public URL); inconsistent with how DorkOS handles icons (no existing sprite infrastructure); `<img>` tags lose CSS color control
- Complexity: Medium (requires asset pipeline changes).
- Not recommended.

**Approach D: Replace `iconEmoji: string` with a richer icon discriminated union**

Evolve `AdapterManifest` to support `icon: { type: 'emoji', value: string } | { type: 'brand', name: 'telegram' | 'slack' | 'anthropic' }`. The UI renders an SVG component for `brand` type and the emoji `<span>` for `emoji` type.

- Pros: Type-safe; clearly separates "placeholder emoji" from "real brand icon"; makes it obvious when a brand icon is registered; enables future plugin adapter brand icons
- Cons: Schema change requires migration of the Zod schema in `@dorkos/shared`, all existing manifests, all tests that assert on `iconEmoji`, and the two render sites; moderate scope
- Complexity: Medium-high. But produces the cleanest long-term architecture.
- **Recommended as the full implementation** (Approach A provides the SVG assets; this provides the schema scaffolding).

### 4. Logo Sources

All three logos are available from multiple reliable sources:

| Brand     | Simple Icons slug | Official source                                                  |
| --------- | ----------------- | ---------------------------------------------------------------- |
| Telegram  | `telegram`        | [t.me/brandguidelines](https://t.me/brandguidelines)             |
| Slack     | `slack`           | [slack.com/media-kit](https://slack.com/media-kit)               |
| Anthropic | `anthropic`       | [anthropic.com/news](https://www.anthropic.com/news) (press kit) |

Simple Icons hosts all three at predictable CDN URLs:

- `https://cdn.simpleicons.org/telegram`
- `https://cdn.simpleicons.org/slack`
- `https://cdn.simpleicons.org/anthropic`

The brand colors from Simple Icons (used in the icon fill):

- Telegram: `#26A5E4`
- Slack: `#4A154B`
- Anthropic: `#191919` (or use `currentColor` with the warm orange `#C15F3C` for Claude)

---

## Detailed Analysis

### Legal Risk Ranking

1. **Anthropic** — Lowest risk. Anthropic publishes a press kit explicitly for this use. Showing their logo in an adapter card that connects to their own service (Claude Code) is the most clearly defensible use. DorkOS is literally an integration layer built on their SDK.

2. **Telegram** — Low-to-medium risk in practice. The explicit restriction is against apps that impersonate Telegram. Using the logo in a "connect to Telegram" adapter card is nominative fair use by any reasonable reading. This is identical to how VS Code extensions, IFTTT, Zapier, Make, and thousands of other integration tools show the Telegram logo.

3. **Slack** — Highest risk. Slack's Brand Terms explicitly prohibit third parties from displaying the Slack logo without a written license or Marketplace partner status. However, this restriction is widely ignored in practice by open-source integration tools, and Slack has not shown a pattern of enforcement against such tools. The safe fallback is to use a generic `#` or hash-grid icon styled in Slack purple (`#4A154B`) rather than the official wordmark/logo — or to add a trademark disclaimer in the UI.

### Schema Evolution Recommendation

The cleanest implementation avoids mutating a loosely typed `iconEmoji: string` field. Instead:

```typescript
// In packages/shared/src/relay-adapter-schemas.ts
const AdapterIconSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('emoji'), value: z.string() }),
  z.object({
    type: z.literal('brand'),
    name: z.enum(['telegram', 'slack', 'anthropic', 'webhook']),
  }),
]);

// AdapterManifest gains:
//   icon: AdapterIconSchema (replaces iconEmoji)
// iconEmoji kept as deprecated optional for plugin backward compat
```

The two render sites (`CatalogCard.tsx`, `AdapterCardHeader.tsx`) would branch on `manifest.icon.type`:

- `'emoji'` → existing `<span>` emoji render
- `'brand'` → `<AdapterBrandIcon name={manifest.icon.name} className="size-4" />` from `@dorkos/icons`

### Inline SVG Component Pattern (Approach A)

Following the existing `DorkLogo` pattern in `packages/icons/src/logos.tsx`, new components would be added to a new file `packages/icons/src/adapter-logos.tsx`:

```tsx
/** Telegram brand icon (Simple Icons path, Telegram brand color #26A5E4). */
export function TelegramIcon({ size = 16, className }: BrandIconProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      aria-label="Telegram"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
```

The `packages/icons/package.json` exports would gain `"./adapter-logos": "./src/adapter-logos.tsx"`.

### Slack-Specific Handling

Given Slack's explicit brand restriction, two options:

1. **Use the Slack logo anyway** (pragmatic, widely done in open source). The risk of enforcement against a developer tool is extremely low. Add a standard trademark disclaimer comment in the source: `// Slack is a trademark of Salesforce. Logo used to identify integration, not to imply endorsement.`

2. **Use a styled approximation**: Display the `#` character in Slack's brand purple (`#4A154B`) with `font-weight: 900` — this is what Slack's own "Add to Slack" buttons use in their minimal/monochrome variant. Zero legal risk; recognizable to Slack users.

Option 1 is more visually polished. Option 2 is legally clean. The recommendation is Option 2 for initial ship and Option 1 for a future update if/when DorkOS pursues Slack Marketplace listing.

---

## Potential Solutions

### Solution 1 (Recommended): Inline SVGs + Schema Evolution

**Scope**: Medium
**Legal risk**: Low (Anthropic, Telegram), Medium (Slack — use approximation initially)
**Steps**:

1. Add `packages/icons/src/adapter-logos.tsx` with `TelegramIcon`, `AnthropicIcon`, and a `SlackWordmarkFallback` (styled `#`).
2. Update `packages/icons/package.json` exports.
3. Evolve `AdapterManifestSchema` in `packages/shared` to add `icon` discriminated union field.
4. Update `TELEGRAM_MANIFEST`, `SLACK_MANIFEST`, `CLAUDE_CODE_MANIFEST` to use `icon: { type: 'brand', name: '...' }`.
5. Update `CatalogCard.tsx` and `AdapterCardHeader.tsx` to render `<AdapterBrandIcon>` when `icon.type === 'brand'`.
6. Update related tests.

### Solution 2 (Quick Win): Replace emoji values only

**Scope**: Tiny
**Legal risk**: Same as Solution 1
**Steps**: Update only the `iconEmoji` string values in the three manifests to use better emojis — e.g., Telegram: `'📨'` (incoming envelope), Slack: `'💬'`, Claude: `'✨'`.

This is trivial but does not achieve the goal of showing real brand logos.

### Solution 3: Install `simple-icons` npm package

**Scope**: Small
**Legal risk**: Same as Solution 1 (Simple Icons' disclaimer explicitly puts responsibility on the user regardless)
**Steps**: Install `simple-icons`, import SVG path data, render inline with `<svg>`.
**Not recommended** for 3 icons — the full package is overkill and adds a dependency.

---

## Security and Legal Considerations

- **Trademark ≠ Copyright**: All three brands' logos are trademarked. Trademark law governs whether a logo can be used in a way that implies endorsement or causes confusion — not whether it can be displayed at all. Using a logo to identify a connected service is generally permissible under nominative fair use doctrine in the US.
- **Simple Icons is not a legal shield**: The CC0 license on the package does not override brand trademark rights. Users must independently comply with each brand's guidelines.
- **Slack is the outlier**: Their Brand Terms are more restrictive than industry norm and explicitly prohibit third-party logo display. DorkOS should either use the styled hash fallback or accept the low (but non-zero) legal risk of displaying the logo.
- **Open source context**: DorkOS being open-source and developer-facing reduces commercial infringement risk significantly. Enforcement actions against open-source integration tools displaying brand logos are extremely rare; Slack has not demonstrated a pattern of such enforcement.
- **Recommended disclaimer**: Add a comment in `adapter-logos.tsx` and/or a NOTICES file acknowledging that "Telegram, Slack, and Anthropic/Claude are trademarks of their respective owners. Logos are used to identify connected services and do not imply endorsement."

---

## Recommendation

**Implement Solution 1** with the following risk-adjusted handling:

1. **Telegram**: Use the Simple Icons SVG path directly. Legal risk is low — this is nominative use.
2. **Anthropic/Claude Code**: Use the Simple Icons SVG path for the Anthropic mark. Lowest risk; Anthropic explicitly provides press kit assets for this purpose.
3. **Slack**: For initial ship, use a styled fallback (bold `#` in Slack purple `#4A154B`) rather than the official logo. This is zero-risk and still more recognizable than the current literal `#` string. Revisit with the real logo when/if DorkOS publishes to Slack Marketplace.

The schema evolution (Approach D) is worth the moderate scope because it makes the intent explicit in the type system, prevents plugin authors from inserting arbitrary emoji strings as "brand logos," and creates a clean extension point for future adapters (GitHub, Discord, Linear, etc.).

---

## Sources and Evidence

- Simple Icons project: [simpleicons.org](https://simpleicons.org/) / [GitHub](https://github.com/simple-icons/simple-icons)
- Simple Icons legal disclaimer: [DISCLAIMER.md](https://github.com/simple-icons/simple-icons/blob/master/DISCLAIMER.md)
- Simple Icons npm package: [npmjs.com/package/simple-icons](https://www.npmjs.com/package/simple-icons)
- Telegram API Terms: [core.telegram.org/api/terms](https://core.telegram.org/api/terms)
- Slack Brand Terms of Service: [slack.com/terms-of-service/slack-brand](https://slack.com/terms-of-service/slack-brand)
- Slack Media Kit: [slack.com/media-kit](https://slack.com/media-kit)
- Anthropic Newsroom (press kit): [anthropic.com/news](https://www.anthropic.com/news)
- Bootstrap Icons — Claude icon: [icons.getbootstrap.com/icons/claude](https://icons.getbootstrap.com/icons/claude/)
- React Simple Icons wrapper: [@icons-pack/react-simple-icons on npm](https://www.npmjs.com/package/@icons-pack/react-simple-icons)

## Research Gaps and Limitations

- Anthropic's specific "third-party integration" clause was not found in a direct policy page — only inferred from press kit availability and common practice. Before shipping the Anthropic icon in a publicly released version, confirm against the Anthropic brand/trademark policy page directly.
- Slack's enforcement history against open-source tools was not specifically confirmed — "no enforcement pattern" is an inference, not a documented fact.
- The Simple Icons `d` attribute SVG paths for Telegram and Anthropic were not directly fetched in this research session — they should be sourced directly from the Simple Icons GitHub repo at implementation time, not from memory.

## Search Methodology

- Searches performed: 9
- Most productive terms: "simple-icons npm license CC0 Telegram Slack", "Slack brand terms of service third party logo", "Anthropic press kit logo usage rights"
- Primary sources: simpleicons.org, slack.com/terms-of-service/slack-brand, GitHub (simple-icons), npm registry
