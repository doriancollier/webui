---
title: 'Feature Category Pages — Research Report'
date: 2026-03-20
type: implementation
status: active
tags: [features, category-pages, seo, nextjs, app-router, json-ld, placeholder-images, routing]
feature_slug: site-feature-category-pages
searches_performed: 8
sources_count: 20
---

# Feature Category Pages — Research Report

**Feature slug**: `site-feature-category-pages`
**Date**: 2026-03-20
**Scope**: `apps/site/src/app/(marketing)/features/` — adding `/features/[category]` pages to the existing feature catalog

---

## Context: What Already Exists

This research builds directly on `research/20260320_site_feature_catalog.md`. The feature system is already fully implemented:

- **`/features/page.tsx`** — catalog index with `?product=` server-side filter tabs (console, pulse, relay, mesh, core)
- **`/features/[slug]/page.tsx`** — individual feature pages with full JSON-LD, OG metadata, `generateStaticParams`, benefits bullets, screenshot, related features
- **`/features/[slug]/opengraph-image.tsx`** — per-feature OG image
- **`apps/site/src/layers/features/marketing/lib/features.ts`** — the `Feature` interface with `category: FeatureCategory` (8 values: chat, agent-control, scheduling, messaging, integration, discovery, visualization, infrastructure)
- **`FeatureProduct`** (5 values: console, pulse, relay, mesh, core) — already drives the existing `/features` tab filter

The new work is specifically: `/features/[category]/page.tsx` — category-level landing pages (e.g. `/features/scheduling`, `/features/messaging`) that list all features in that category with full detail.

---

## Research Summary

The category page task introduces one non-trivial routing challenge (disambiguating `[category]` from the existing `[slug]` dynamic segment at the same level) and three design decisions (layout for mixed image/no-image feature lists, SEO metadata strategy for a collection page, and placeholder images). All three have clear, low-complexity solutions. The route conflict is the most important issue to resolve correctly — the answer is a **static-segment override**: place category slugs in the `features.ts` `CATEGORY_LABELS` map and use `generateStaticParams` + `notFound()` guards in both dynamic routes to ensure they never conflict.

---

## Key Findings

### 1. Route Conflict Analysis — `[slug]` vs `[category]` at the Same Level

**The core problem**: Next.js App Router does not allow two different dynamic segment files (`[slug]` and `[category]`) in the same directory. They are filesystem siblings and would conflict immediately at build time with a "You cannot use different slug names for the same dynamic path" error.

**Why this matters for this feature**: The existing route is `features/[slug]/page.tsx`. The new route would need to be `features/[category]/page.tsx`. Same parent directory. Both dynamic. This is a hard routing conflict.

**Solution options (in order of recommendation):**

**Option A: Static route segments for categories (RECOMMENDED)**

The category values are a closed, known set: `chat`, `agent-control`, `scheduling`, `messaging`, `integration`, `discovery`, `visualization`, `infrastructure`. These are all defined in `CATEGORY_LABELS` in `features.ts`. Because the categories are known at build time, they can be made into static route segments by **nesting them under a disambiguating segment**.

Recommended structure:

```
features/
  page.tsx               # /features (index — already exists)
  [slug]/
    page.tsx             # /features/[slug] (already exists)
    opengraph-image.tsx  # (already exists)
  category/
    [category]/
      page.tsx           # /features/category/[category]
```

This is the cleanest, zero-conflict approach. The tradeoff is that the URL becomes `/features/category/scheduling` instead of `/features/scheduling`. For a category page, this URL is descriptively accurate and SEO-reasonable — "scheduling" is a subcategory of "features", and `category/` makes the hierarchy explicit.

**Option B: Single dynamic segment with internal routing logic**

Keep one `[slug]/page.tsx` and detect at runtime whether the slug is a category slug or a feature slug:

```ts
// In features/[slug]/page.tsx
const CATEGORY_SLUGS = Object.keys(CATEGORY_LABELS) as FeatureCategory[];
const isCategory = CATEGORY_SLUGS.includes(params.slug as FeatureCategory);
if (isCategory) return <CategoryPage category={params.slug as FeatureCategory} />;
const feature = features.find(f => f.slug === params.slug);
if (!feature) notFound();
return <FeaturePage feature={feature} />;
```

This works but has serious downsides:

- Renders two conceptually different pages from the same route file (violates single responsibility)
- `generateStaticParams` must return both feature slugs AND category slugs — produces an awkward union
- `generateMetadata` must handle both cases — duplicates logic
- Cannot have separate `opengraph-image.tsx` per page type at the route level
- The file will exceed the 300-line file size limit immediately

**Option C: Explicit static routes for each category**

Create `features/scheduling/page.tsx`, `features/messaging/page.tsx`, etc. as static files.

This avoids routing complexity entirely but doesn't scale — adding a new category requires a new file. With 8 categories and potential additions, this is brittle.

**Option D: Middleware rewrite**

Use Next.js `next.config.ts` rewrites to route `/features/scheduling` → `/features/category/scheduling`. This gives clean URLs with Option A's disambiguation, at the cost of added complexity in `next.config.ts`.

**Verdict: Option A (nested `category/[category]/`) is the recommended approach.** It is explicit, conflict-free, and follows Next.js routing conventions. The URL `/features/category/scheduling` is not ideal but is acceptable — it can be iterated to shorter URLs later with rewrites if the product team decides it matters.

**On `generateStaticParams`**: The category pages should use `generateStaticParams` to pre-render all 8 category pages at build time:

```ts
export function generateStaticParams() {
  return (Object.keys(CATEGORY_LABELS) as FeatureCategory[]).map((category) => ({ category }));
}
```

### 2. Layout Options for Category Pages

**The design challenge**: A category page lists 2-6 features. Some features have `media.screenshot`, most do not. The layout must handle both gracefully without making text-only features look broken or sparse.

#### Layout Option A: Stacked full-width feature cards (RECOMMENDED)

Each feature gets a full-width horizontal card: left side = name + tagline + description + benefits bullets; right side = screenshot if present, or a subtle branded placeholder block if not.

```
┌─────────────────────────────────────────────────────┐
│ [Badge: Scheduling]   [Badge: GA]                    │
│ Pulse Scheduler                                       │
│ Schedule agents to run on any cron...                │
│ ✓ Visual cron builder       [screenshot or pattern]  │
│ ✓ Preset gallery                                     │
│ ✓ Run history                                        │
│ → Read the docs                                      │
└─────────────────────────────────────────────────────┘
```

- **Pros**: Generous space for each feature, image absence is handled gracefully by the right-side slot rendering a decorative placeholder (brand pattern, icon, or colored block), directly mirrors what users see if they click through to the individual feature page
- **Cons**: Tall page for many features, though 2-6 features per category is acceptable
- **Complexity**: Low — this is essentially the existing `[slug]/page.tsx` layout adapted into a list
- **Maintenance**: Low — data-driven from `features.ts`

#### Layout Option B: 2-column card grid (same as `/features` index)

Uses the existing `FeatureCard` component in a 2 or 3-column grid.

- **Pros**: Visually consistent with the index page, zero new components needed
- **Cons**: Cards are compact — truncate description, hide benefits; category page's whole value is _showing full detail_, so compressing content defeats the purpose; images in some cards but not others creates visual imbalance in a grid
- **Complexity**: Trivially low (reuse `FeatureCard`)
- **Maintenance**: Zero

#### Layout Option C: Alternating left/right image layout

Feature 1: text left, image right. Feature 2: text right, image left. Etc.

- **Pros**: Visual rhythm, breaks monotony for long lists, used by Stripe/Linear for feature deep-dives
- **Cons**: Awkward when features have no image (empty right side on alternating rows with no images); over-engineered for 2-6 features; requires index-tracking in the render
- **Complexity**: Medium — requires tracking even/odd index in render, responsive layout changes
- **Maintenance**: Medium

**Verdict: Option A (stacked full-width cards) is recommended.** It gives each feature sufficient real estate to display all fields (name, tagline, description, benefits, status, screenshot), handles the mixed image/no-image situation cleanly via a right-side placeholder slot, and doesn't require new complex layout logic. For the screenshot placeholder, use a branded decorative block (CSS background with a dot-grid pattern matching the site's grid aesthetic) rather than an external image service — this is zero-dependency and works in SSR.

### 3. SEO for Category Pages

#### `generateMetadata`

Follow the exact pattern already in `[slug]/page.tsx` but scoped to the category:

```ts
export async function generateMetadata(props: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const category = params.category as FeatureCategory;
  if (!CATEGORY_LABELS[category]) notFound();

  const categoryFeatures = features.filter((f) => f.category === category);
  const label = CATEGORY_LABELS[category];

  return {
    title: `${label} Features — DorkOS`,
    description: `DorkOS ${label.toLowerCase()} capabilities: ${categoryFeatures.map((f) => f.name).join(', ')}.`,
    openGraph: {
      title: `${label} Features — DorkOS`,
      description: `All DorkOS ${label.toLowerCase()} features in one place.`,
      url: `/features/category/${category}`,
      siteName: siteConfig.name,
      type: 'website',
    },
    alternates: { canonical: `/features/category/${category}` },
  };
}
```

The description auto-generates from feature names — concise, accurate, includes the actual feature names for long-tail keyword matching.

#### JSON-LD Schema Recommendation

Two schemas, following the exact pattern already in `[slug]/page.tsx`:

**1. `BreadcrumbList`** — 3-level: Home > Features > [Category Label]

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://dorkos.ai" },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Features",
      "item": "https://dorkos.ai/features"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Scheduling",
      "item": "https://dorkos.ai/features/category/scheduling"
    }
  ]
}
```

**2. `CollectionPage`** — the most appropriate schema type for a page that aggregates multiple items of the same type. This is more semantically accurate than `WebPage` for a category landing page.

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Scheduling Features — DorkOS",
  "description": "All DorkOS scheduling capabilities...",
  "url": "https://dorkos.ai/features/category/scheduling",
  "hasPart": [
    {
      "@type": "SoftwareApplication",
      "name": "DorkOS — Pulse Scheduler",
      "description": "...",
      "url": "https://dorkos.ai/features/pulse-scheduler"
    }
  ]
}
```

`CollectionPage` with `hasPart` array makes each feature a named part of the collection — this is both semantically accurate and potentially useful for AI retrieval (AI assistants can extract "what features are in the scheduling category" from this schema).

Do NOT use `ItemList` with `ListItem` — `ItemList` is designed for ordered rankings (search results, top-10 lists). `CollectionPage` + `hasPart` is the correct schema for a curated product category.

#### OG Image Strategy

Two options:

1. **Reuse `[slug]/opengraph-image.tsx` pattern** — create `features/category/[category]/opengraph-image.tsx` showing the category name ("Scheduling") + count ("3 Features") + brand styling. This is the right long-term approach.
2. **Fall through to the root OG image** — acceptable for the initial implementation, since category pages are not shared as frequently as individual feature pages.

Recommended: Start with option 2 (no `opengraph-image.tsx` for category pages initially). The category pages are discovery/navigation pages — they are less likely to be direct share targets than individual feature pages. Add dedicated OG images in a follow-up if analytics show category page social sharing is meaningful.

#### Sitemap Priority

Category pages should sit at `priority: 0.6` — same as blog posts. They are secondary navigation pages, not primary product content. The individual feature pages at `0.8` are higher priority. The `/features` catalog index at `0.7` is slightly higher than category pages since it's the primary entry point.

Add to `sitemap.ts`:

```ts
const categoryPages: MetadataRoute.Sitemap = (
  Object.keys(CATEGORY_LABELS) as FeatureCategory[]
).map((category) => ({
  url: `${BASE_URL}/features/category/${category}`,
  lastModified: new Date(),
  changeFrequency: 'monthly' as const,
  priority: 0.6,
}));
```

#### llms.txt Integration

The existing `llms.txt/route.ts` uses a `buildCapabilitiesSection()` function. Category pages should be added to the `buildFeaturesSection()` (when it is created per `research/20260320_site_feature_catalog.md`). Each category should have its own sub-list under the Features section, linking to both the category URL and the individual feature URLs.

### 4. Placeholder Image Strategy

#### The Situation

Three features in `features.ts` have `media.screenshot` defined (looking at the existing data — currently none do). The task requires adding 2-3 placeholder screenshots to the feature data so the category page design can be validated with real image rendering.

#### Options Analysis

**Option A: External placeholder services (picsum.photos, placeholder.com)**

`picsum.photos` provides random or seeded photo placeholders. `placeholder.com` provides labeled solid-color images.

- For `next/image`, external URLs require `remotePatterns` config in `next.config.ts`
- Current `next.config.ts` has no `images.remotePatterns` — would need to be added
- `picsum.photos` uses `fastly.picsum.photos` as the actual CDN hostname

Required `next.config.ts` addition:

```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'fastly.picsum.photos' },
    { protocol: 'https', hostname: 'picsum.photos' },
  ],
},
```

However: the feature pages currently use a plain `<img>` tag (not `next/image`) for screenshots:

```tsx
<img
  src={feature.media.screenshot}
  alt={feature.media.alt ?? `${feature.name} screenshot`}
  className="border-warm-gray-light/20 w-full rounded-lg border shadow-sm"
/>
```

With plain `<img>` tags, external URLs work without any config changes. No domain allowlisting needed.

**Option B: Public directory placeholder images (RECOMMENDED)**

Add 2-3 placeholder PNG files to `apps/site/public/features/` — e.g., `pulse-placeholder.png`, `relay-placeholder.png`, `mesh-placeholder.png`. These can be simple gray/branded rectangles generated via any tool.

- No config changes needed
- Works with both `<img>` and `next/image`
- Portable — works offline, no external dependency
- Can be replaced by real screenshots with zero data changes (same path)

**Option C: SVG data URLs inline in `features.ts`**

Encode a simple SVG as a data URL directly in the `screenshot` field:

```ts
screenshot: 'data:image/svg+xml,...';
```

- No files needed
- Works without config changes
- The data URL is ugly in source code and adds noise to `features.ts`
- SVG data URLs do NOT work with `next/image` (throws error)
- With the current `<img>` tag: works fine, but ugly

**Option D: Branded CSS placeholder block (no image at all)**

In the category page layout, when `feature.media?.screenshot` is undefined, render a branded decorative block in the right slot (dot-grid pattern, category icon, or colored pattern). This is the cleanest option for the layout — no external dependency, no placeholder file noise, and honestly better-looking than a gray rectangle.

For the requirement of "add 2-3 placeholder images to the feature data": combine Options B and D. Add 2-3 real public directory paths to the data (for features where a screenshot is eventually planned), and use the branded CSS block for features with no screenshot. This gives the category page design a realistic test with actual `<img>` rendering on some features, while gracefully handling the majority.

**Verdict: Use public directory placeholders for the 2-3 data entries + branded CSS block for missing images.**

Specifically: add placeholder paths to `pulse-scheduler`, `relay-message-bus`, and `mesh-agent-discovery` in `features.ts`:

```ts
media: {
  screenshot: '/features/pulse-scheduler.png',
  alt: 'Pulse Scheduler dashboard showing active schedules and run history',
},
```

Then add simple placeholder PNG files to `apps/site/public/features/`. A 1600x900 (16:9 aspect) gray rectangle with "Pulse Scheduler" text is sufficient for development.

---

## Detailed Analysis

### Category Page Data Model

The existing `FeatureCategory` type in `features.ts` already covers the full category taxonomy. The category page needs to:

1. Look up all features where `feature.category === category`
2. Sort them by `sortOrder` within the category (same logic as the index page)
3. Render the full detail view for each

The categories with the most features are:

- `agent-control`: tool-approval, question-prompts (2 features)
- `chat`: chat-interface, file-uploads (2 features)
- `integration`: slack-adapter, telegram-adapter, mcp-server (3 features)
- `infrastructure`: cli, tunnel (2 features)

Single-feature categories:

- `scheduling`: pulse-scheduler (1 feature)
- `messaging`: relay-message-bus (1 feature)
- `discovery`: mesh-agent-discovery (1 feature)
- `visualization`: mesh-topology (1 feature)

Categories with only 1 feature are borderline useful as standalone pages. However, they are still valid for SEO (a page for `/features/category/scheduling` can rank for "AI agent scheduling" queries). The layout handles single-feature categories gracefully — the stacked card layout with 1 item is perfectly readable.

### Should Category Pages Link From `/features` Index?

Currently the `/features` index uses `?product=` query params for filtering (server-rendered). The category pages are a separate URL structure (`/features/category/[category]`). These are complementary, not competing:

- Product tabs (`?product=pulse`) = "show me features of the Pulse subsystem"
- Category pages (`/features/category/scheduling`) = "show me scheduling features across all products"

The category pages are better suited for direct SEO entry points (users searching "DorkOS scheduling features") than for primary navigation within the site. They don't need prominent links from the `/features` index — the index already serves navigation. The category pages are SEO entry points that lead users to individual feature pages.

If a cross-link is desired, a subtle "View all [category] features" link on each individual feature page (pointing to `/features/category/[feature.category]`) would be the right integration.

### Route Priority: Static Segments Win Over Dynamic

One important Next.js routing behavior: **static route segments take priority over dynamic segments**. If a URL path segment exactly matches a static folder name, Next.js will route to the static folder first.

This means: even if there were a feature slug named `category` (which there isn't and should never be), the `category/[category]/` subfolder would take priority over `[slug]/page.tsx`. This is an additional safety net for Option A.

More relevantly: if a feature slug matched a category slug (e.g., a feature named `scheduling`), there would be a conflict in Option B (single `[slug]` file) but not in Option A (separate `category/` subfolder). This is another argument for Option A.

### Category Pages vs Product Pages

The existing `/features?product=pulse` filter is purely for navigation within the index — it's not a separate URL and doesn't generate a standalone page at `/features/pulse`. The new category pages at `/features/category/[category]` are standalone pages. This raises the question: should there also be `/features/product/[product]` pages?

For this feature, the scope is **category pages only** (per the task brief). Product pages could be added separately. However, product pages and category pages serve different SEO purposes:

- Product pages (`/features/product/pulse`) = "what does Pulse do?" — better served by the existing homepage SubsystemsSection or future individual product landing pages
- Category pages (`/features/category/scheduling`) = "what scheduling features does DorkOS have?" — what this feature is building

---

## Route Structure Recommendation

```
apps/site/src/app/(marketing)/
  features/
    page.tsx                        # /features (catalog index — already exists)
    category/
      [category]/
        page.tsx                    # /features/category/scheduling (NEW)
        opengraph-image.tsx         # optional — can defer
    [slug]/
      page.tsx                      # /features/[slug] (already exists)
      opengraph-image.tsx           # already exists
```

No changes to any existing files needed. No routing conflicts. Clean separation.

---

## Layout Recommendation for Category Pages

```
/features/category/scheduling
──────────────────────────────

[Back arrow] Features / Scheduling

h1: Scheduling Features
subtitle: Features in the Scheduling category

────────────────────────────────────────────────────────
[Scheduling] [Available]
Pulse Scheduler
Schedule agents to run on any cron — they work while you don't.

Stop manually triggering agent runs. Pulse lets you schedule any   [screenshot or
agent on any cron expression, with a visual builder, preset         branded block]
gallery, and full run history.

✓ Visual cron builder with natural-language preview
✓ Preset gallery for common patterns
✓ Run history with status, duration, and output
✓ Timezone-aware scheduling

→ View feature  → Read the docs
────────────────────────────────────────────────────────
```

The right-side slot:

- When `feature.media?.screenshot` is defined: render `<img>` with rounded corners and border, same styles as `[slug]/page.tsx`
- When undefined: render a branded placeholder block — CSS background with the site's dot-grid pattern and the feature's category icon (from lucide-react, which is already a dependency)

---

## Potential Solutions Summary

### Layout

**1. Stacked full-width feature cards (RECOMMENDED)**

- Description: Each feature is a horizontal card occupying full width. Left = text (name, tagline, description, benefits, CTA). Right = screenshot or branded CSS placeholder.
- Pros: Full detail visible without clicking, graceful handling of mixed image/no-image, directly parallels the individual feature page experience
- Cons: Long page for categories with many features (max ~3-4 features per category here, so acceptable)
- Complexity: Low
- Maintenance: Low (data-driven)

**2. Card grid (same as index)**

- Description: Reuse the existing `FeatureCard` component in a 2-column grid.
- Pros: Zero new code, perfectly consistent with index page
- Cons: Cards truncate description and hide benefits — defeats the purpose of a "full detail" category page
- Complexity: Zero
- Maintenance: Zero

**3. Alternating left/right image layout**

- Description: Odd features have image right, even features have image left.
- Pros: Visual dynamism, professional SaaS aesthetic
- Cons: Awkward with sparse data (most features lack screenshots), over-engineered for 1-4 features per category
- Complexity: Medium
- Maintenance: Medium

### Route Conflict

**Recommended: Option A — `features/category/[category]/page.tsx`**

Nesting category pages under a static `category/` segment completely eliminates any conflict with the existing `[slug]` dynamic segment. The URL `/features/category/scheduling` is clear and SEO-valid. No changes to existing files. No routing complexity.

### Placeholder Images

**Recommended: Public directory placeholders + branded CSS block**

Add 3 placeholder PNG files to `apps/site/public/features/` (for pulse-scheduler, relay-message-bus, mesh-agent-discovery). Use a branded CSS block (dot-grid pattern) for features with no `media.screenshot`. This gives realistic image rendering on 3 features while handling the majority gracefully.

---

## Recommendation

**Recommended Layout**: Stacked full-width feature cards
**Recommended Route Strategy**: `features/category/[category]/page.tsx` (Option A — separate static `category/` subfolder)
**Recommended Placeholder**: Public directory PNGs for 3 features + branded CSS block for absent screenshots
**JSON-LD Schema**: `CollectionPage` + `hasPart: SoftwareApplication[]` + `BreadcrumbList`

**Rationale**: The route conflict is the highest-risk issue — Option A resolves it with zero complexity and no changes to existing code. The stacked card layout is the only option that fulfills the brief's requirement for "full detail" (name, tagline, description, benefits, status, media) without truncation. The public directory placeholder approach is the simplest path that (a) gives realistic image rendering for testing, (b) requires no config changes, (c) degrades gracefully to a branded CSS block for features without screenshots, and (d) allows real screenshots to be swapped in simply by replacing the file at the same public path.

---

## Implementation Checklist

1. **Add 3 placeholder screenshots to `features.ts`** — add `media: { screenshot: '/features/pulse-scheduler.png', alt: '...' }` to pulse-scheduler, relay-message-bus, and mesh-agent-discovery
2. **Add placeholder PNG files** to `apps/site/public/features/` (1600x900 or 16:9 ratio)
3. **Create `apps/site/src/app/(marketing)/features/category/[category]/page.tsx`** with:
   - `generateStaticParams` from `CATEGORY_LABELS` keys
   - `generateMetadata` with title/description/OG/canonical
   - `CollectionPage` + `BreadcrumbList` JSON-LD
   - Stacked feature cards using the feature data
4. **Add category pages to `sitemap.ts`** at priority 0.6
5. **Add `notFound()` guard** in category page for unknown category slugs (defensive validation against `CATEGORY_LABELS`)

---

## Sources & Evidence

- Existing research: `research/20260320_site_feature_catalog.md` (feature catalog architecture, data model, SEO patterns)
- Existing research: `research/20260228_og_seo_ai_readability_overhaul.md` (JSON-LD patterns, OG metadata, sitemap strategy)
- [Next.js Dynamic Routes docs](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes)
- [Next.js generateMetadata API reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js JSON-LD guide](https://nextjs.org/docs/app/guides/json-ld)
- [Next.js images remotePatterns config](https://nextjs.org/docs/app/api-reference/config/next-config-js/images)
- [Schema.org CollectionPage](https://schema.org/CollectionPage)
- [Schema.org hasPart](https://schema.org/hasPart)
- [Next.js route group static segment priority discussion](https://github.com/vercel/next.js/discussions/37171)
- [Dynamic route conflict issue — vercel/next.js #9130](https://github.com/vercel/next.js/issues/9130)
- [Multiple dynamic routes at same path — vercel/next.js discussion #21595](https://github.com/vercel/next.js/discussions/21595)
- Codebase: `apps/site/src/app/(marketing)/features/page.tsx`
- Codebase: `apps/site/src/app/(marketing)/features/[slug]/page.tsx`
- Codebase: `apps/site/src/app/(marketing)/features/[slug]/opengraph-image.tsx`
- Codebase: `apps/site/src/layers/features/marketing/lib/features.ts`
- Codebase: `apps/site/next.config.ts`
- [SaaS features page design examples — SaasLandingPage.com](https://saaslandingpage.com/features/)
- [SaaS product page best practices — BlenDB2B](https://www.blendb2b.com/blog/saas-product-page-design-7-best-practices-with-examples)
- [Next.js Image component with external domains — DEV Community](https://dev.to/joodi/allow-all-domains-for-images-in-nextjs-hpj)
- [Handling external images in Next.js — Medium](https://medium.com/@andipyk/handling-external-images-in-next-js-remotepatterns-vs-domains-versions-15-3-vs-12-3-06e9c0fe6409)

---

## Research Gaps

- **Exact `next.config.ts` version impact**: The current `next.config.ts` uses `withMDX` wrapper from Fumadocs — the `images.remotePatterns` addition would need to be inside the `nextConfig` object before `withMDX` is applied. This is standard Next.js behavior but worth double-checking.
- **Category page link integration**: Whether to add "View all [category] features" cross-links from individual feature pages (`[slug]/page.tsx`) to the new category pages was not specified in the task brief. This is a navigation design decision for the implementer.
- **OG image for category pages**: No explicit OG image template for category pages was designed. The fallthrough to root OG image is the recommended starting point.

---

## Search Methodology

- Searches performed: 8
- Key terms: "Next.js dynamic route conflict slug category same level App Router", "SaaS feature category page alternating layout hero stacked cards", "placeholder image services Next.js Image component external domains", "Next.js App Router route group static segment vs dynamic segment priority", "Next.js generateMetadata dynamic category pages JSON-LD CollectionPage"
- Primary sources: Next.js official docs, GitHub vercel/next.js issues/discussions, existing DorkOS codebase (authoritative for patterns), existing research files
- Codebase files reviewed: `features/page.tsx`, `features/[slug]/page.tsx`, `features/[slug]/opengraph-image.tsx`, `features.ts`, `next.config.ts`, `index.ts` (marketing barrel)
