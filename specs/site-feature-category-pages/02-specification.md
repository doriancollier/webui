---
slug: site-feature-category-pages
number: 148
created: 2026-03-21
status: draft
---

# Site Feature Category Pages

**Slug:** site-feature-category-pages
**Author:** Claude Code
**Date:** 2026-03-21
**Status:** Draft

---

## 1. Overview

Add statically generated category landing pages at `/features/category/{category}` (e.g. `/features/category/chat`, `/features/category/scheduling`) that list all features belonging to a given category with full detail — name, tagline, description, benefits, status badge, product badge, and screenshot if present.

The feature catalog already exists (`/features` index + `/features/[slug]` detail pages). This spec adds the category dimension: pages that group all features of a given type for SEO, deep linking, and AI discoverability.

---

## 2. Background / Problem Statement

The existing feature catalog allows browsing by product (`?product=console`) but has no category-oriented entry point. Potential users searching for "agent scheduling tool" or "AI agent messaging" have no landing page that groups all scheduling or messaging features together.

Category pages fill this gap by:

- Providing category-keyed URLs for SEO targeting
- Grouping related features with full detail for informed discovery
- Adding structured `CollectionPage` JSON-LD for AI search indexing

**Critical route constraint:** `/features/[category]/page.tsx` cannot coexist with the existing `/features/[slug]/page.tsx` at the same URL level — Next.js throws a build error when two dynamic segments share the same parent. The solution is a static `category/` subfolder prefix, yielding `/features/category/{category}`.

---

## 3. Goals

- Add 8 statically generated pages, one per `FeatureCategory` value
- Full-detail layout per feature: name, badges, tagline, description, benefits list, screenshot or branded CSS placeholder
- SEO-complete: `generateMetadata`, canonical URL, `BreadcrumbList` + `CollectionPage` JSON-LD
- Category pages appear in `/sitemap.xml` at priority 0.6
- `/llms.txt` gains a `## Feature Categories` section with grouped feature listings
- 3 specific features gain `media` fields with placeholder screenshot paths
- Placeholder PNG files created in `apps/site/public/features/`
- Zero changes to existing `/features` and `/features/[slug]` routes

---

## 4. Non-Goals

- Per-category OG images (`opengraph-image.tsx`) — fall through to site-level OG for now
- Navigation changes (MarketingNav links, category links on `/features` tab strip)
- Actual product screenshots — paths are added to data, real images come later
- MDX content layer per category
- Middleware URL rewrites to serve `/features/chat` instead of `/features/category/chat`

---

## 5. Technical Dependencies

| Dependency                    | Version         | Notes                                                                                                  |
| ----------------------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| Next.js                       | 16 (App Router) | `generateStaticParams`, `generateMetadata`, `notFound`                                                 |
| `lucide-react`                | existing        | `ArrowLeft`, `CheckCircle`, `MessageSquare`, `Calendar`, `Mail`, `Plug`, `Search`, `Network`, `Server` |
| `next/link`                   | —               | Client-side navigation                                                                                 |
| `@/layers/features/marketing` | —               | `features`, `CATEGORY_LABELS`, `PRODUCT_LABELS`, `FeatureCategory`                                     |
| `@/config/site`               | —               | `siteConfig.url`, `siteConfig.name`                                                                    |

No new dependencies required.

---

## 6. Detailed Design

### 6.1 Route Structure

```
apps/site/src/app/(marketing)/features/
  page.tsx                                   # /features (unchanged)
  [slug]/
    page.tsx                                 # /features/[slug] (unchanged)
    opengraph-image.tsx                      # (unchanged)
  category/
    [category]/
      page.tsx                               # /features/category/[category] (NEW)
```

### 6.2 `category/[category]/page.tsx` — Full Implementation

```typescript
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  MessageSquare,
  Calendar,
  Mail,
  Plug,
  Search,
  Network,
  Server,
  Bot,
} from 'lucide-react';
import {
  features,
  CATEGORY_LABELS,
  PRODUCT_LABELS,
  type FeatureCategory,
  type FeatureStatus,
} from '@/layers/features/marketing';
import { siteConfig } from '@/config/site';

export function generateStaticParams() {
  return (Object.keys(CATEGORY_LABELS) as FeatureCategory[]).map((category) => ({ category }));
}

export async function generateMetadata(props: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const category = params.category as FeatureCategory;
  const label = CATEGORY_LABELS[category];
  if (!label) notFound();

  const categoryFeatures = features.filter((f) => f.category === category);
  const description = `DorkOS ${label.toLowerCase()} capabilities: ${categoryFeatures.map((f) => f.name).join(', ')}.`;

  return {
    title: `${label} Features — DorkOS`,
    description,
    openGraph: {
      title: `${label} Features — DorkOS`,
      description,
      url: `/features/category/${category}`,
      siteName: siteConfig.name,
      type: 'website',
    },
    alternates: {
      canonical: `/features/category/${category}`,
    },
  };
}

export default async function FeatureCategoryPage(props: {
  params: Promise<{ category: string }>;
}) {
  const params = await props.params;
  const category = params.category as FeatureCategory;
  const label = CATEGORY_LABELS[category];
  if (!label) notFound();

  const categoryFeatures = features.filter((f) => f.category === category);
  const description = `DorkOS ${label.toLowerCase()} capabilities: ${categoryFeatures.map((f) => f.name).join(', ')}.`;

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
      { '@type': 'ListItem', position: 2, name: 'Features', item: `${siteConfig.url}/features` },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${label} Features`,
        item: `${siteConfig.url}/features/category/${category}`,
      },
    ],
  };

  // CollectionPage JSON-LD
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${label} Features — DorkOS`,
    description,
    url: `${siteConfig.url}/features/category/${category}`,
    hasPart: categoryFeatures.map((f) => ({
      '@type': 'SoftwareApplication',
      name: f.name,
      description: f.description,
      applicationCategory: 'DeveloperApplication',
      featureList: f.benefits,
    })),
  };

  const CategoryIcon = CATEGORY_ICONS[category];

  return (
    <div className="mx-auto max-w-6xl px-6 pt-32 pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionJsonLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* Back link */}
      <Link
        href="/features"
        className="text-2xs text-warm-gray-light hover:text-brand-orange transition-smooth mb-8 inline-flex items-center gap-1 font-mono tracking-[0.04em]"
      >
        <ArrowLeft size={12} /> Features
      </Link>

      {/* Page header */}
      <div className="mb-16">
        <h1 className="text-charcoal font-mono text-4xl font-bold tracking-tight">
          {label} Features
        </h1>
        <p className="text-warm-gray-light mt-3 font-mono text-sm">
          All DorkOS {label.toLowerCase()} capabilities
        </p>
      </div>

      {/* Feature rows */}
      <div className="divide-warm-gray-light/10 divide-y">
        {categoryFeatures.map((feature, index) => (
          <div
            key={feature.slug}
            className={`grid grid-cols-1 gap-12 py-16 lg:grid-cols-2 ${index === 0 ? 'pt-0' : ''}`}
          >
            {/* Text column */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="text-warm-gray-light border-warm-gray-light/30 rounded-full border px-2.5 py-0.5 font-mono text-xs">
                  {PRODUCT_LABELS[feature.product]}
                </span>
                <StatusBadge status={feature.status} />
              </div>

              <h2 className="text-charcoal font-mono text-2xl font-bold tracking-tight">
                {feature.name}
              </h2>
              <p className="text-warm-gray mt-2 text-lg leading-relaxed">{feature.tagline}</p>
              <p className="text-warm-gray-light mt-3 text-sm leading-relaxed">
                {feature.description}
              </p>

              {feature.benefits.length > 0 && (
                <ul className="mt-6 space-y-2.5">
                  {feature.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2.5">
                      <CheckCircle
                        size={14}
                        className="text-brand-orange mt-0.5 shrink-0"
                        strokeWidth={2}
                      />
                      <span className="text-warm-gray text-sm">{benefit}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-4">
                {feature.docsUrl && (
                  <Link
                    href={feature.docsUrl}
                    className="text-charcoal hover:text-brand-orange transition-smooth inline-flex items-center gap-1.5 font-mono text-sm font-medium"
                  >
                    Read the docs <ExternalLink size={12} />
                  </Link>
                )}
                <Link
                  href={`/features/${feature.slug}`}
                  className="text-warm-gray-light hover:text-charcoal transition-smooth inline-flex items-center gap-1 font-mono text-sm"
                >
                  View details <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            {/* Media column */}
            <div>
              {feature.media?.screenshot ? (
                <figure>
                  <img
                    src={feature.media.screenshot}
                    alt={feature.media.alt ?? `${feature.name} screenshot`}
                    className="border-warm-gray-light/20 w-full rounded-lg border shadow-sm"
                  />
                </figure>
              ) : (
                <div
                  className="flex h-64 w-full flex-col items-center justify-center rounded-lg lg:h-full lg:min-h-[240px]"
                  style={{
                    background: '#1a1a1a',
                    backgroundImage:
                      'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                >
                  <CategoryIcon size={32} className="text-warm-gray-light/40 mb-3" />
                  <span className="text-warm-gray-light/50 font-mono text-xs tracking-[0.08em] uppercase">
                    {PRODUCT_LABELS[feature.product]}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Category → icon mapping
const CATEGORY_ICONS: Record<FeatureCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  chat: MessageSquare,
  'agent-control': Bot,
  scheduling: Calendar,
  messaging: Mail,
  integration: Plug,
  discovery: Search,
  visualization: Network,
  infrastructure: Server,
};

const STATUS_STYLES: Record<FeatureStatus, string> = {
  ga: 'bg-emerald-100/60 text-emerald-900',
  beta: 'bg-amber-100/60 text-amber-900',
  'coming-soon': 'bg-warm-gray/10 text-warm-gray-light',
};

const STATUS_LABELS: Record<FeatureStatus, string> = {
  ga: 'Available',
  beta: 'Beta',
  'coming-soon': 'Coming Soon',
};

function StatusBadge({ status }: { status: FeatureStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 font-mono text-xs ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
```

**Note on line count:** The page component is ~180 lines. The `CATEGORY_ICONS`, `STATUS_STYLES`, `STATUS_LABELS`, and `StatusBadge` are small and tightly coupled to this page — no extraction needed. If `StatusBadge` is needed elsewhere in the future, move it to a shared location then.

### 6.3 Placeholder Images — `features.ts` changes

Add `media` entries to exactly 3 features:

```typescript
// pulse-scheduler: add media field
{
  slug: 'pulse-scheduler',
  // ... existing fields ...
  media: {
    screenshot: '/features/pulse-scheduler.png',
    alt: 'Pulse Scheduler — visual cron builder with run history panel',
  },
}

// relay-message-bus: add media field
{
  slug: 'relay-message-bus',
  // ... existing fields ...
  media: {
    screenshot: '/features/relay-message-bus.png',
    alt: 'Relay Message Bus — activity feed showing inter-agent message routing',
  },
}

// mesh-topology: add media field
{
  slug: 'mesh-topology',
  // ... existing fields ...
  media: {
    screenshot: '/features/mesh-topology.png',
    alt: 'Mesh Topology Graph — interactive force-directed graph of agents and adapters',
  },
}
```

### 6.4 Placeholder PNG Files

Create three placeholder image files in `apps/site/public/features/`. These are 1600×900 SVG files saved with `.png` filenames (Next.js serves them as static assets regardless of format; browsers render SVG content served with the correct MIME type, but for true PNG placeholders use the inline SVG approach described below).

**Preferred approach:** Create minimal SVG files at the PNG paths. Each file is a 1600×900 SVG with:

- Background: `#E8E3D8` (cream, matching the site palette)
- Centered text: feature name in `#2C2C2C` (charcoal)
- Font: monospace

Example `apps/site/public/features/pulse-scheduler.png`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#E8E3D8"/>
  <text x="800" y="450" text-anchor="middle" dominant-baseline="middle"
        font-family="monospace" font-size="32" fill="#2C2C2C" opacity="0.5">
    Pulse Scheduler
  </text>
</svg>
```

Create equivalents for `relay-message-bus.png` and `mesh-topology.png`.

### 6.5 Sitemap — `sitemap.ts` changes

Add category pages at priority 0.6, alongside the existing `featurePages`:

```typescript
import { features, CATEGORY_LABELS, type FeatureCategory } from '@/layers/features/marketing';

// ... existing code ...

const featureCategoryPages: MetadataRoute.Sitemap = (
  Object.keys(CATEGORY_LABELS) as FeatureCategory[]
).map((category) => ({
  url: `${BASE_URL}/features/category/${category}`,
  changeFrequency: 'monthly' as const,
  priority: 0.6,
}));

return [
  ...staticPages,
  ...featureCatalogPage,
  ...featurePages,
  ...featureCategoryPages, // add here
  ...docPages,
  ...blogPages,
];
```

### 6.6 `llms.txt` — `route.ts` changes

Add a `buildFeatureCategoriesSection()` function and include it in the output:

```typescript
function buildFeatureCategoriesSection(): string {
  return (Object.keys(CATEGORY_LABELS) as FeatureCategory[])
    .map((cat) => {
      const label = CATEGORY_LABELS[cat];
      const catFeatures = features.filter((f) => f.category === cat);
      const lines = catFeatures.map((f) => `- ${f.name}: ${f.tagline}`);
      return `### ${label}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}
```

Add the import for `FeatureCategory` and `CATEGORY_LABELS` at the top of the file (they are already available via `features.ts` barrel):

```typescript
import {
  features,
  CATEGORY_LABELS,
  type FeatureCategory,
} from '@/layers/features/marketing/lib/features';
```

Include in the template string after `## Features`:

```
## Features

${buildFeaturesSection()}

## Feature Categories

${buildFeatureCategoriesSection()}
```

---

## 7. Data Flow

```
features.ts (source of truth)
  ↓
category/[category]/page.tsx
  ├── features.filter(f => f.category === category) → rendered rows
  ├── generateStaticParams → 8 static routes
  └── generateMetadata → title, description, canonical, OG

sitemap.ts
  └── CATEGORY_LABELS keys → 8 entries at priority 0.6

llms.txt/route.ts
  └── CATEGORY_LABELS × features.filter → grouped text section
```

---

## 8. User Experience

### Page Header

```
← Features

Chat Features
All DorkOS chat capabilities
```

### Feature Row (with screenshot)

```
┌──────────────────────────────────┬──────────────────────────────┐
│ [Console] [Available]            │                              │
│ Chat Interface                   │    [screenshot]              │
│ A web UI for every agent session │                              │
│ Stop SSH-ing into terminal...    │                              │
│ ✓ Live streaming output          │                              │
│ ✓ Persistent session history     │                              │
│ ✓ Tool call cards                │                              │
│ Read the docs ↗   View details → │                              │
└──────────────────────────────────┴──────────────────────────────┘
```

### Feature Row (without screenshot — branded CSS block)

```
┌──────────────────────────────────┬──────────────────────────────┐
│ [Console] [Available]            │ ·  ·  ·  ·  ·  ·  ·  ·  ·  │
│ File Uploads                     │   ·  ·  ·  ·  ·  ·  ·  ·   │
│ Drop files into the chat...      │       📤                     │
│ ✓ Drag-and-drop or click         │     CONSOLE                  │
│ ✓ Files appear inline            │ ·  ·  ·  ·  ·  ·  ·  ·  ·  │
│ Read the docs ↗   View details → │                              │
└──────────────────────────────────┴──────────────────────────────┘
```

The branded CSS block uses:

- `background: #1a1a1a` with `radial-gradient` dot grid
- `PRODUCT_LABELS[feature.product]` as uppercase label
- Category icon from `CATEGORY_ICONS` at 40% opacity

### 404 for Unknown Categories

`/features/category/nonexistent` → `notFound()` → Next.js 404 page

---

## 9. SEO Requirements

### `generateStaticParams`

All 8 `FeatureCategory` keys, generated at build time:

```typescript
export function generateStaticParams() {
  return (Object.keys(CATEGORY_LABELS) as FeatureCategory[]).map((category) => ({ category }));
}
```

### `generateMetadata`

- **Title:** `${CATEGORY_LABELS[category]} Features — DorkOS`
- **Description:** `DorkOS ${label.toLowerCase()} capabilities: ${features.map(f => f.name).join(', ')}.`
- **Canonical:** `/features/category/${category}`
- **OG title/description/url:** same as above
- **404:** `notFound()` for any unrecognized category value

### JSON-LD Scripts

Two inline `<script type="application/ld+json">` tags:

1. **BreadcrumbList** — `Home > Features > {Category} Features`
2. **CollectionPage** — with `hasPart: SoftwareApplication[]` array (one per feature in category)

Use `CollectionPage` (not `ItemList` or `WebPage`) — semantically correct for a curated product category, and better recognized by AI search indexers.

### Sitemap Priority Hierarchy

| Page type                       | Priority |
| ------------------------------- | -------- |
| `/features/{slug}`              | 0.8      |
| `/features`                     | 0.7      |
| `/features/category/{category}` | 0.6      |

---

## 10. Testing Strategy

### Unit / Component Tests

**`category-page.test.tsx`** (if adding tests — see note below):

```typescript
// Purpose: Verify category page renders all features for a given category
// and 404s for unknown categories.

describe('FeatureCategoryPage', () => {
  it('renders all features for the chat category', async () => {
    // Render with params.category = 'chat'
    // Assert: 'Chat Interface' and 'File Uploads' both present
    // Assert: h1 contains 'Chat Features'
  });

  it('calls notFound() for an unknown category', async () => {
    // Render with params.category = 'nonexistent'
    // Assert: notFound was called
  });

  it('renders branded CSS block for features without screenshots', async () => {
    // Render chat category — no features have screenshots in base data
    // Assert: dot-grid placeholder present
  });

  it('renders screenshot img for features with media.screenshot', async () => {
    // Render scheduling category — pulse-scheduler has screenshot
    // Assert: img with src='/features/pulse-scheduler.png' present
  });
});
```

**Note:** The `/features/[slug]` page has no dedicated unit tests (it's a thin server component). The same applies here. A quick TypeScript compile + visual check in the browser is the primary validation path for this spec. Tests are optional.

### Integration Check (Manual)

After implementation, verify:

- `pnpm typecheck` passes (zero errors)
- `pnpm lint` passes (zero warnings)
- `pnpm build` in `apps/site` succeeds (8 category pages rendered)
- `/features/category/chat` renders 2 feature rows
- `/features/category/scheduling` shows Pulse Scheduler with its placeholder image
- `/features/category/integration` renders 3 features (Slack, Telegram, MCP Server)
- `/features/category/nonexistent` returns 404
- `/sitemap.xml` contains 8 `/features/category/` entries
- `/llms.txt` contains `## Feature Categories` section

---

## 11. Performance Considerations

- All 8 routes are **statically generated** — zero server-side rendering cost
- Placeholder SVG files are ~300 bytes each — negligible
- No new client JS — the category page is a pure RSC with no `'use client'` directives
- The `buildFeatureCategoriesSection()` in `llms.txt` runs at build time (static export)

---

## 12. Security Considerations

- No user input handled — category is validated against `CATEGORY_LABELS` keys; unknown values hit `notFound()`
- JSON-LD uses `.replace(/</g, '\\u003c')` to prevent XSS (matches existing pattern in `[slug]/page.tsx`)
- Placeholder files are static SVGs served from `/public` — no execution surface

---

## 13. Implementation Phases

### Phase 1: Data Changes

1. Add `media` fields to `pulse-scheduler`, `relay-message-bus`, `mesh-topology` in `features.ts`
2. Create `apps/site/public/features/` directory
3. Create 3 placeholder SVG files at `.png` paths

### Phase 2: New Route

4. Create `apps/site/src/app/(marketing)/features/category/[category]/page.tsx`

### Phase 3: SEO Plumbing

5. Update `apps/site/src/app/sitemap.ts` — add `featureCategoryPages`
6. Update `apps/site/src/app/llms.txt/route.ts` — add `buildFeatureCategoriesSection()`

### Phase 4: Validation

7. `pnpm typecheck && pnpm lint` — zero errors
8. `pnpm build --filter=@dorkos/site` — all 8 routes rendered
9. Manual browser check of representative pages

---

## 14. Open Questions

None — all decisions resolved in ideation phase.

---

## 15. Related ADRs

- None directly applicable. The existing feature catalog patterns (see `[slug]/page.tsx`) are the architectural reference.

---

## 16. Acceptance Criteria

- [ ] `/features/category/chat` renders 2 features (Chat Interface, File Uploads) with full detail layout
- [ ] `/features/category/scheduling` renders Pulse Scheduler with its placeholder screenshot image
- [ ] `/features/category/integration` renders 3 features (Slack Adapter, Telegram Adapter, MCP Server)
- [ ] All 8 category values have statically generated routes
- [ ] Unknown categories (e.g. `/features/category/nonexistent`) return 404
- [ ] Each page has: `<title>`, meta description, canonical URL, BreadcrumbList JSON-LD, CollectionPage JSON-LD
- [ ] Category pages appear in `/sitemap.xml` at priority 0.6
- [ ] `/llms.txt` has a `## Feature Categories` section with features grouped by category
- [ ] Features with `media.screenshot` show the `<img>` tag; features without show the branded CSS block
- [ ] `pulse-scheduler`, `relay-message-bus`, `mesh-topology` have `media` fields added in `features.ts`
- [ ] Placeholder files exist at `apps/site/public/features/pulse-scheduler.png`, `relay-message-bus.png`, `mesh-topology.png`
- [ ] TypeScript compiles cleanly (`pnpm typecheck` passes)
- [ ] No lint errors (`pnpm lint` passes)
- [ ] Existing `/features/[slug]` and `/features` routes are completely unchanged

---

## 17. References

- [`apps/site/src/app/(marketing)/features/[slug]/page.tsx`](<../../apps/site/src/app/(marketing)/features/%5Bslug%5D/page.tsx>) — layout and JSON-LD reference
- [`apps/site/src/layers/features/marketing/lib/features.ts`](../../apps/site/src/layers/features/marketing/lib/features.ts) — data model
- [`apps/site/src/app/sitemap.ts`](../../apps/site/src/app/sitemap.ts) — sitemap pattern
- [`apps/site/src/app/llms.txt/route.ts`](../../apps/site/src/app/llms.txt/route.ts) — llms.txt pattern
- [Next.js `generateStaticParams` docs](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
- [Schema.org `CollectionPage`](https://schema.org/CollectionPage)
