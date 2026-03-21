# Task Breakdown: Site Feature Category Pages

Generated: 2026-03-21
Source: specs/site-feature-category-pages/02-specification.md
Last Decompose: 2026-03-21

## Overview

Add statically generated category landing pages at `/features/category/{category}` (8 pages, one per `FeatureCategory` value). Each page lists all features belonging to that category with full detail — name, badges, tagline, description, benefits, status badge, product badge, and screenshot or branded CSS placeholder. The work also adds `media` fields to 3 features, creates placeholder SVG image files, updates the sitemap, and adds a `## Feature Categories` section to `/llms.txt`.

The feature catalog already exists (`/features` index + `/features/[slug]` detail pages). This work adds only the category dimension. The route uses a static `category/` subfolder prefix to avoid a Next.js build error from two dynamic segments (`[slug]` and `[category]`) sharing the same parent.

---

## Phase 1: Data Changes

### Task 1.1: Add media fields to pulse-scheduler, relay-message-bus, and mesh-topology in features.ts

**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.2

**Technical Requirements**:

- File: `apps/site/src/layers/features/marketing/lib/features.ts`
- The `Feature` interface already has `media?: { screenshot?: string; demoUrl?: string; alt?: string; }` — no type changes needed
- Add `media` entries to exactly 3 features; all other 10 features remain unchanged

**Implementation Steps**:

1. Locate `pulse-scheduler` (PULSE section). Add after `docsUrl`, before `relatedFeatures`:

```typescript
  media: {
    screenshot: '/features/pulse-scheduler.png',
    alt: 'Pulse Scheduler — visual cron builder with run history panel',
  },
```

2. Locate `relay-message-bus` (RELAY section). Add after `docsUrl`, before `relatedFeatures`:

```typescript
  media: {
    screenshot: '/features/relay-message-bus.png',
    alt: 'Relay Message Bus — activity feed showing inter-agent message routing',
  },
```

3. Locate `mesh-topology` (MESH section). Add after `docsUrl`, before `relatedFeatures`:

```typescript
  media: {
    screenshot: '/features/mesh-topology.png',
    alt: 'Mesh Topology Graph — interactive force-directed graph of agents and adapters',
  },
```

**Acceptance Criteria**:

- [ ] `pulse-scheduler` has `media.screenshot === '/features/pulse-scheduler.png'` and `media.alt` set
- [ ] `relay-message-bus` has `media.screenshot === '/features/relay-message-bus.png'` and `media.alt` set
- [ ] `mesh-topology` has `media.screenshot === '/features/mesh-topology.png'` and `media.alt` set
- [ ] All other 10 features remain unchanged
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero warnings

---

### Task 1.2: Create placeholder SVG files at PNG paths in apps/site/public/features/

**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1

**Technical Requirements**:

- Create `apps/site/public/features/` directory (does not currently exist)
- Three placeholder files: `pulse-scheduler.png`, `relay-message-bus.png`, `mesh-topology.png`
- SVG content served with `.png` filenames — Next.js serves them as static assets from `/public`
- Each file: 1600×900 SVG, background `#E8E3D8` (cream), centered monospace text in `#2C2C2C` at 50% opacity

**Implementation Steps**:

1. Create `apps/site/public/features/pulse-scheduler.png`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#E8E3D8"/>
  <text x="800" y="450" text-anchor="middle" dominant-baseline="middle"
        font-family="monospace" font-size="32" fill="#2C2C2C" opacity="0.5">
    Pulse Scheduler
  </text>
</svg>
```

2. Create `apps/site/public/features/relay-message-bus.png`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#E8E3D8"/>
  <text x="800" y="450" text-anchor="middle" dominant-baseline="middle"
        font-family="monospace" font-size="32" fill="#2C2C2C" opacity="0.5">
    Relay Message Bus
  </text>
</svg>
```

3. Create `apps/site/public/features/mesh-topology.png`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#E8E3D8"/>
  <text x="800" y="450" text-anchor="middle" dominant-baseline="middle"
        font-family="monospace" font-size="32" fill="#2C2C2C" opacity="0.5">
    Mesh Topology Graph
  </text>
</svg>
```

**Acceptance Criteria**:

- [ ] `apps/site/public/features/` directory exists
- [ ] `pulse-scheduler.png`, `relay-message-bus.png`, `mesh-topology.png` all exist in that directory
- [ ] Each file is valid SVG content at 1600×900
- [ ] Files are ~300 bytes each (minimal)
- [ ] Next.js serves them as static assets at `/features/pulse-scheduler.png` etc.

---

## Phase 2: New Route

### Task 2.1: Create the category/[category]/page.tsx route for feature category landing pages

**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: None

**Technical Requirements**:

- New file: `apps/site/src/app/(marketing)/features/category/[category]/page.tsx`
- The `category/` subdirectory is a static folder (not dynamic) — required to avoid Next.js conflict with `[slug]/`
- Statically generates all 8 routes via `generateStaticParams`
- `generateMetadata` produces title, description, canonical URL, OG tags; calls `notFound()` for unknown categories
- Page component: two-column grid per feature (text left, media right), `BreadcrumbList` + `CollectionPage` JSON-LD
- No `'use client'` directives — pure RSC
- Branded CSS placeholder for features without `media.screenshot`
- Imports from `@/layers/features/marketing` barrel (not internal paths)

**Implementation Steps**:

1. Create directory: `apps/site/src/app/(marketing)/features/category/[category]/`

2. Create `page.tsx` with full implementation:

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

**Key notes**:

- `CATEGORY_ICONS`, `STATUS_STYLES`, `STATUS_LABELS`, `StatusBadge` are tightly coupled to this page — do NOT extract until needed elsewhere
- Both JSON-LD scripts use `.replace(/</g, '\\u003c')` to prevent XSS — matches the existing pattern in `[slug]/page.tsx`
- `CollectionPage` JSON-LD type (not `ItemList` or `WebPage`) — better recognized by AI search indexers

**Acceptance Criteria**:

- [ ] File exists at `apps/site/src/app/(marketing)/features/category/[category]/page.tsx`
- [ ] `/features/category/chat` renders h1 `Chat Features` with rows for Chat Interface and File Uploads
- [ ] `/features/category/scheduling` renders Pulse Scheduler row with `<img src="/features/pulse-scheduler.png">`
- [ ] `/features/category/integration` renders 3 rows: Slack Adapter, Telegram Adapter, MCP Server
- [ ] `/features/category/nonexistent` returns 404
- [ ] All 8 categories have statically generated routes
- [ ] Each page has title tag, meta description, canonical URL, BreadcrumbList JSON-LD, CollectionPage JSON-LD
- [ ] Features without `media.screenshot` show the dark dot-grid branded CSS block
- [ ] Features with `media.screenshot` show `<figure><img /></figure>`
- [ ] Existing `/features/[slug]` and `/features` routes are completely unchanged
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero warnings

---

## Phase 3: SEO Plumbing

### Task 3.1: Add category pages to sitemap.ts at priority 0.6

**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.1
**Can run parallel with**: Task 3.2

**Technical Requirements**:

- File: `apps/site/src/app/sitemap.ts`
- Add `CATEGORY_LABELS` and `FeatureCategory` to existing import from `@/layers/features/marketing`
- Add `featureCategoryPages` array built from `Object.keys(CATEGORY_LABELS)`
- Priority 0.6, changeFrequency `monthly`, spread into return array between `featurePages` and `docPages`

**Implementation Steps**:

1. Update the import at the top of `sitemap.ts`:

```typescript
import { features, CATEGORY_LABELS, type FeatureCategory } from '@/layers/features/marketing';
```

2. Add this variable after the `featurePages` declaration:

```typescript
const featureCategoryPages: MetadataRoute.Sitemap = (
  Object.keys(CATEGORY_LABELS) as FeatureCategory[]
).map((category) => ({
  url: `${BASE_URL}/features/category/${category}`,
  changeFrequency: 'monthly' as const,
  priority: 0.6,
}));
```

3. Update the return statement:

```typescript
return [
  ...staticPages,
  ...featureCatalogPage,
  ...featurePages,
  ...featureCategoryPages,
  ...docPages,
  ...blogPages,
];
```

**Sitemap Priority Hierarchy**:

- `/features/{slug}` → 0.8
- `/features` → 0.7
- `/features/category/{category}` → 0.6 (new)

**Acceptance Criteria**:

- [ ] `sitemap.ts` imports `CATEGORY_LABELS` and `FeatureCategory` from `@/layers/features/marketing`
- [ ] `featureCategoryPages` produces exactly 8 entries
- [ ] All 8 entries use correct URL format and have `priority: 0.6`
- [ ] Return statement includes `featureCategoryPages` between `featurePages` and `docPages`
- [ ] `/sitemap.xml` contains 8 entries matching `/features/category/` pattern
- [ ] `pnpm typecheck` and `pnpm lint` pass

---

### Task 3.2: Add Feature Categories section to llms.txt route handler

**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.1
**Can run parallel with**: Task 3.1

**Technical Requirements**:

- File: `apps/site/src/app/llms.txt/route.ts`
- Update existing `features` import to also include `CATEGORY_LABELS` and `FeatureCategory`
- Add `buildFeatureCategoriesSection()` function after `buildFeaturesSection()`
- Add `## Feature Categories` section to the template string between `## Features` and `## Documentation`

**Implementation Steps**:

1. Update the import:

```typescript
import {
  features,
  CATEGORY_LABELS,
  type FeatureCategory,
} from '@/layers/features/marketing/lib/features';
```

2. Add after `buildFeaturesSection()`:

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

3. Update the template string in `GET()` — change the `## Features` / `## Documentation` section to:

```
## Features

${buildFeaturesSection()}

## Feature Categories

${buildFeatureCategoriesSection()}

## Documentation
```

**Example output** for the `chat` category group:

```
### Chat
- Chat Interface: A web UI for every agent session, with streaming output in real time
- File Uploads: Drop files into the chat — agents read them as context
```

**Acceptance Criteria**:

- [ ] `route.ts` imports `CATEGORY_LABELS` and `FeatureCategory`
- [ ] `buildFeatureCategoriesSection()` is added after `buildFeaturesSection()`
- [ ] Function groups features by category with `### {label}` headings and `- {name}: {tagline}` lines
- [ ] `## Feature Categories` section appears between `## Features` and `## Documentation` in the template
- [ ] `/llms.txt` contains a `## Feature Categories` section with all 8 category groups
- [ ] `pnpm typecheck` and `pnpm lint` pass

---

## Phase 4: Validation

### Task 4.1: Validate typecheck, lint, build, and manual browser checks

**Size**: Small
**Priority**: High
**Dependencies**: Task 3.1, Task 3.2
**Can run parallel with**: None

**Validation Steps**:

1. `pnpm typecheck` — expect zero errors
2. `pnpm lint` — expect zero warnings and errors
3. `pnpm build --filter=@dorkos/site` — expect 8 category pages in build output
4. Manual browser checks:
   - `/features/category/chat` — 2 feature rows (Chat Interface, File Uploads)
   - `/features/category/scheduling` — Pulse Scheduler with placeholder screenshot image
   - `/features/category/integration` — 3 rows: Slack Adapter, Telegram Adapter, MCP Server
   - `/features/category/messaging` — Relay Message Bus with placeholder screenshot image
   - `/features/category/visualization` — Mesh Topology Graph with placeholder screenshot image
   - `/features/category/nonexistent` — Next.js 404 page
   - `/sitemap.xml` — 8 entries at `/features/category/{category}` with priority 0.6
   - `/llms.txt` — `## Feature Categories` section present with 8 category groups
   - `/features` and `/features/pulse-scheduler` — unaffected by changes

**Full Acceptance Criteria**:

- [ ] `/features/category/chat` renders Chat Interface and File Uploads with full detail layout
- [ ] `/features/category/scheduling` renders Pulse Scheduler with its placeholder screenshot image
- [ ] `/features/category/integration` renders 3 features (Slack Adapter, Telegram Adapter, MCP Server)
- [ ] All 8 category values have statically generated routes
- [ ] Unknown categories return 404
- [ ] Each page has title tag, meta description, canonical URL, BreadcrumbList JSON-LD, CollectionPage JSON-LD
- [ ] Category pages appear in `/sitemap.xml` at priority 0.6
- [ ] `/llms.txt` has a `## Feature Categories` section with features grouped by category
- [ ] Features with `media.screenshot` show `<img>`; features without show the branded CSS block
- [ ] `pulse-scheduler`, `relay-message-bus`, `mesh-topology` have `media` fields in `features.ts`
- [ ] Placeholder SVG files exist at `apps/site/public/features/{name}.png`
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero warnings
- [ ] Existing `/features/[slug]` and `/features` routes are completely unchanged

---

## Dependency Graph

```
1.1 (media fields) ──┐
                      ├──► 2.1 (category route) ──► 3.1 (sitemap) ──┐
1.2 (placeholder     ┘                          ──► 3.2 (llms.txt) ──┴──► 4.1 (validation)
    images)
```

Tasks 1.1 and 1.2 can run in parallel. Tasks 3.1 and 3.2 can run in parallel. All other tasks are sequential.

## Parallel Opportunities

- **1.1 and 1.2** can run simultaneously — both are data/asset changes with no dependencies
- **3.1 and 3.2** can run simultaneously — both are SEO plumbing tasks that depend only on 2.1

## Critical Path

1.1 → 2.1 → 3.1 → 4.1 (or 1.1 → 2.1 → 3.2 → 4.1)

The longest path is 4 tasks. With parallelism, the minimum wall-clock phases are:

- Phase 1 (1.1 + 1.2 in parallel)
- Phase 2 (2.1)
- Phase 3 (3.1 + 3.2 in parallel)
- Phase 4 (4.1)
