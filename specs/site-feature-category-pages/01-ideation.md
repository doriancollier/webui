---
slug: site-feature-category-pages
number: 148
created: 2026-03-21
status: ideation
---

# Site Feature Category Pages

**Slug:** site-feature-category-pages
**Author:** Claude Code
**Date:** 2026-03-21
**Branch:** preflight/site-feature-category-pages

---

## 1) Intent & Assumptions

- **Task brief:** Add a new set of pages at `/features/category/{category}` that list all features belonging to a given category with full detail — name, tagline, description, benefits, status badge, and screenshot if present. SEO-optimized with `generateMetadata`, JSON-LD, sitemap, and `llms.txt`. Add placeholder images (media field entries) to 2-3 existing features so the image layout renders.

- **Assumptions:**
  - Routes follow the `category/` subfolder prefix: `/features/category/chat`, `/features/category/scheduling`, etc. (see Decisions)
  - `FeatureCategory` (not `FeatureProduct`) drives the route segments — 8 values: `chat`, `agent-control`, `scheduling`, `messaging`, `integration`, `discovery`, `visualization`, `infrastructure`
  - Placeholder images are added to features in `features.ts` pointing to `/features/pulse-scheduler.png`-style paths; the actual image files can be blank/placeholder PNGs in `apps/site/public/features/`
  - Features without a screenshot render a branded CSS block in the image slot
  - No changes to existing `/features/[slug]/page.tsx` or `/features/page.tsx` routes
  - Category pages are statically generated (`generateStaticParams`)
  - OG images fall through to site-level OG for now (no per-category `opengraph-image.tsx`)

- **Out of scope:**
  - Actual product screenshots (paths are added to data, real images come later)
  - Per-category OG images (follow-up if analytics warrant it)
  - Navigation changes (MarketingNav links, category links on `/features` tab strip)
  - MDX content layer per category

---

## 2) Pre-reading Log

- `apps/site/src/layers/features/marketing/lib/features.ts`: Feature data model — 14 features across 5 products and 8 categories. `Feature` interface has `media?: { screenshot?: string; demoUrl?: string; alt?: string }`. All 8 FeatureCategory values: `chat`, `agent-control`, `scheduling`, `messaging`, `integration`, `discovery`, `visualization`, `infrastructure`.

- `apps/site/src/app/(marketing)/features/page.tsx`: Catalog index, filters by `?product=` query param, renders `FeatureCard` grid. No category filtering today. Good reference for how `PRODUCT_LABELS`/`CATEGORY_LABELS` are consumed.

- `apps/site/src/app/(marketing)/features/[slug]/page.tsx`: Gold standard reference — `generateStaticParams`, `generateMetadata`, two JSON-LD scripts (BreadcrumbList + SoftwareApplication), full layout with product/category/status badges, h1, tagline, description, benefits list with CheckCircle icons, screenshot section, docsUrl link, relatedFeatures links. This is the visual and structural template for the category page layout.

- `apps/site/src/app/(marketing)/features/[slug]/opengraph-image.tsx`: Per-feature OG image via `ImageResponse`. Cream background, charcoal text, monospace font. Pattern to follow if per-category OG images are added later.

- `apps/site/src/app/sitemap.ts`: Feature entries added as `features.map(f => ({ url: ..., priority: 0.8 }))` plus a separate catalog entry at 0.7. Category pages slot in at 0.6.

- `apps/site/src/app/llms.txt/route.ts`: Features section uses `features.map(f => ...)` helper. Category section would add a grouped block.

- `apps/site/src/layers/features/marketing/ui/FeatureCard.tsx`: Compact card — name, tagline, badges, "Learn more" CTA. Re-usable on category pages as a secondary CTA but not as the primary layout.

- `apps/site/next.config.ts`: No `images.remotePatterns` configured. Existing feature pages use plain `<img>` tags (not `next/image`). No config change needed for placeholders.

- `apps/site/src/config/site.ts`: `siteConfig.url` and `siteConfig.name` used in metadata and JSON-LD.

---

## 3) Codebase Map

**Primary Components/Modules:**

- `apps/site/src/app/(marketing)/features/category/[category]/page.tsx` — **NEW**: Category landing page, `generateStaticParams` over all 8 `FeatureCategory` values, `generateMetadata`, full feature list layout
- `apps/site/src/layers/features/marketing/lib/features.ts` — **MODIFY**: Add `media` entries (screenshot path + alt) to 3 features
- `apps/site/src/app/sitemap.ts` — **MODIFY**: Add category page entries at priority 0.6
- `apps/site/src/app/llms.txt/route.ts` — **MODIFY**: Add "Feature Categories" section listing categories with their feature names

**Shared Dependencies:**

- `CATEGORY_LABELS`, `PRODUCT_LABELS`, `features`, `FeatureCategory` from `@/layers/features/marketing`
- `siteConfig` from `@/config/site`
- `notFound` from `next/navigation`
- `Metadata` from `next`
- `lucide-react` icons: `ArrowLeft`, `ArrowRight`, `CheckCircle`, `ExternalLink` (already used on `[slug]/page.tsx`)
- `Link` from `next/link`

**Data Flow:**
`features.ts` (source) → `category/[category]/page.tsx` (filters by category, renders list) → `sitemap.ts` (URL entries at 0.6) → `llms.txt` (category groupings)

**Feature Category Values:**

```typescript
'chat' |
  'agent-control' |
  'scheduling' |
  'messaging' |
  'integration' |
  'discovery' |
  'visualization' |
  'infrastructure';
```

**Feature counts per category (current catalog):**

- `chat`: 2 (Chat Interface, File Uploads)
- `agent-control`: 2 (Tool Approval, Question Prompts)
- `scheduling`: 1 (Pulse Scheduler)
- `messaging`: 1 (Relay Message Bus)
- `integration`: 3 (Slack Adapter, Telegram Adapter, MCP Server)
- `discovery`: 1 (Agent Discovery)
- `visualization`: 1 (Mesh Topology Graph)
- `infrastructure`: 2 (CLI, Remote Tunnel)

**Feature flags/config:** None

**Potential Blast Radius:**

- Direct: 1 new file (`category/[category]/page.tsx`), 3 modified files (`features.ts`, `sitemap.ts`, `llms.txt/route.ts`)
- Indirect: No existing components need changes; `FeatureCard` is optionally re-usable but not required
- Tests: Existing `features.test.ts` passes unchanged. New test file for category page `generateStaticParams` coverage optional.

---

## 4) Root Cause Analysis

Not applicable — this is a new feature, not a bug fix.

---

## 5) Research

### Route Conflict — Critical Finding

You cannot have both `features/[slug]/page.tsx` and `features/[category]/page.tsx` as sibling dynamic routes. Next.js throws "You cannot use different slug names for the same dynamic path" at build time. Three approaches exist:

1. **`features/category/[category]/page.tsx`** (RECOMMENDED) — Static `category/` subfolder prefix eliminates conflict entirely. Zero existing-file changes. Slightly different URL from the brief (`/features/category/chat`).
2. **Single `[slug]/page.tsx` detects both types** — Achieves `/features/chat` URLs. One file handles categories and features by inspecting whether the segment is a FeatureCategory. More complex, single-responsibility concern.
3. **Middleware rewrite** — `/features/chat` externally maps to `/features/category/chat` internally via `next.config.ts` rewrite rules. Achieves desired URLs with clean code separation.

### Layout Options

1. **Stacked full-width feature rows** (RECOMMENDED) — Full-width horizontal section per feature. Left: name, tagline, description, benefits, status badge, CTA. Right: screenshot or branded CSS block. Directly mirrors the existing `[slug]/page.tsx` experience but in a list. Best for "full detail" requirement.
2. **Feature card grid** — Reuses existing `FeatureCard`. No new code but truncates description/benefits — defeats the purpose of a category deep-dive page.
3. **Alternating left/right layout** — Visual dynamism; breaks down when most features in a category have no screenshot.

### SEO

- **JSON-LD schema:** `BreadcrumbList` (Home > Features > Category) + `CollectionPage` with `hasPart: SoftwareApplication[]`. `CollectionPage` is semantically correct for a curated category listing. Do not use `ItemList` (ranking-oriented) or plain `WebPage`.
- **`generateStaticParams`:** Over all 8 `CATEGORY_LABELS` keys — known at build time.
- **Sitemap priority:** `0.6` (below individual features at `0.8` and catalog index at `0.7`)
- **Canonical:** `/features/category/{category}`
- **OG image:** Fall through to site-level OG initially. Add per-category `opengraph-image.tsx` as a follow-up.

### Placeholder Images

- **Recommended:** Add `media` entries to 3 features in `features.ts` pointing to `/features/pulse-scheduler.png` etc. Create actual placeholder PNG files in `apps/site/public/features/`. No config changes — existing pages use plain `<img>` tags.
- **For features without screenshots:** Branded CSS block — dot-grid background, category icon from lucide-react, product name label. Degrades gracefully when real screenshots are swapped in.

### Recommendation

- **Route:** `/features/category/[category]/page.tsx` (Option 1 — zero risk, zero existing-file changes)
- **Layout:** Stacked full-width feature rows (aligns with "full detail" requirement)
- **Placeholder:** Local PNG files + branded CSS fallback block

---

## 6) Decisions

| #   | Decision                                    | Choice                                                                  | Rationale                                                                                                                                    |
| --- | ------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | URL structure for category pages            | `/features/category/{category}` prefix                                  | Eliminates Next.js dynamic segment conflict with existing `[slug]` route. Zero changes to existing routes. User confirmed this approach.     |
| 2   | Image slot for features without screenshots | Branded CSS block (dot-grid background + category icon + product label) | No external requests, no config changes, degrades gracefully when real screenshots are added. Zero complexity. User confirmed this approach. |
