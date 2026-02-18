'use client'

import { Suspense, lazy, type ComponentType } from 'react'

function lazyLogo(
  loader: () => Promise<{ [key: string]: ComponentType }>,
  exportName: string
) {
  return lazy(() =>
    loader()
      .then((mod) => ({ default: mod[exportName] }))
      .catch(() => ({
        default: () => (
          <div className="flex items-center justify-center h-32 text-warm-gray font-mono text-sm">
            Loading...
          </div>
        ),
      }))
  )
}

const variants = [
  { id: 1, title: 'Stencil Block', description: 'Heavy stencil-cut letterforms with industrial gaps.', Component: lazyLogo(() => import('./variants/l01-stencil-block'), 'Logo01') },
  { id: 2, title: 'Pixel Grid', description: 'Pixel-art style on a visible grid. Retro computing aesthetic.', Component: lazyLogo(() => import('./variants/l02-pixel-grid'), 'Logo02') },
  { id: 3, title: 'Isometric Stack', description: '3D isometric letterforms with depth and shadow.', Component: lazyLogo(() => import('./variants/l03-isometric'), 'Logo03') },
  { id: 4, title: 'Circuit Trace', description: 'PCB trace paths forming the letters with solder pad terminals.', Component: lazyLogo(() => import('./variants/l04-circuit'), 'Logo04') },
  { id: 5, title: 'Brutalist Slab', description: 'Oversized, unapologetic slab type. Raw concrete energy.', Component: lazyLogo(() => import('./variants/l05-brutalist'), 'Logo05') },
  { id: 6, title: 'Terminal Cursor', description: 'Monospace terminal type with a blinking block cursor.', Component: lazyLogo(() => import('./variants/l06-terminal'), 'Logo06') },
  { id: 7, title: 'Glitch Slice', description: 'Clean type with horizontal slice displacements.', Component: lazyLogo(() => import('./variants/l07-glitch'), 'Logo07') },
  { id: 8, title: 'Maze Paths', description: 'Letters formed from maze-like right-angle corridors.', Component: lazyLogo(() => import('./variants/l08-maze'), 'Logo08') },
  { id: 9, title: 'Stacked Bars', description: 'Letters built from horizontal bars at varying widths.', Component: lazyLogo(() => import('./variants/l09-bars'), 'Logo09') },
  { id: 10, title: 'Diamond Cut', description: 'Angular faceted letterforms with diagonal cuts.', Component: lazyLogo(() => import('./variants/l10-diamond'), 'Logo10') },
  { id: 11, title: 'Dot Matrix', description: 'LED dot-matrix display style with rounded squares.', Component: lazyLogo(() => import('./variants/l11-dotmatrix'), 'Logo11') },
  { id: 12, title: 'Negative Space', description: 'Letters revealed through cuts in a solid black rectangle.', Component: lazyLogo(() => import('./variants/l12-negative'), 'Logo12') },
  { id: 13, title: 'Modular Grid', description: 'Letters composed of square modules on a strict grid.', Component: lazyLogo(() => import('./variants/l13-modular'), 'Logo13') },
  { id: 14, title: 'Sharp Angles', description: 'Ultra-angular with 45-degree cuts on every corner.', Component: lazyLogo(() => import('./variants/l14-angles'), 'Logo14') },
  { id: 15, title: 'Inline Split', description: 'Bold type with a horizontal inline channel through each letter.', Component: lazyLogo(() => import('./variants/l15-inline'), 'Logo15') },
  { id: 16, title: 'Tetromino', description: 'Letters built from Tetris-like block arrangements.', Component: lazyLogo(() => import('./variants/l16-tetromino'), 'Logo16') },
  { id: 17, title: 'Crosshatch', description: 'Letters filled with architectural crosshatch patterns.', Component: lazyLogo(() => import('./variants/l17-crosshatch'), 'Logo17') },
  { id: 18, title: 'Layered Offset', description: 'Multiple offset copies creating depth and motion.', Component: lazyLogo(() => import('./variants/l18-offset'), 'Logo18') },
  { id: 19, title: 'Monolith', description: 'Single continuous path forming all letters. One stroke, no breaks.', Component: lazyLogo(() => import('./variants/l19-monolith'), 'Logo19') },
  { id: 20, title: 'Fragmented', description: 'Letters broken into geometric shards with small gaps between.', Component: lazyLogo(() => import('./variants/l20-fragmented'), 'Logo20') },
]

function LogoFallback() {
  return (
    <div className="flex items-center justify-center h-32 text-warm-gray font-mono text-sm animate-pulse">
      Loading logo...
    </div>
  )
}

export default function LogoTestPage() {
  return (
    <div className="min-h-screen bg-cream-primary">
      {/* Header */}
      <div className="py-16 px-8 text-center">
        <span className="font-mono text-2xs tracking-[0.15em] uppercase text-brand-orange block mb-4">
          Exploration
        </span>
        <h1 className="text-charcoal text-[40px] md:text-[56px] font-semibold tracking-[-0.04em] leading-[1.0] mb-6">
          Logo Variants
        </h1>
        <p className="text-warm-gray text-base leading-[1.7] max-w-xl mx-auto">
          Twenty vector logo concepts for DorkOS. Solid black, blocky and angular.
          Text options: DORK, DorkOS, or DOS.
        </p>
      </div>

      {/* Logo grid — 2 columns on desktop, 1 on mobile */}
      <div className="max-w-6xl mx-auto px-8 pb-32 grid grid-cols-1 md:grid-cols-2 gap-12">
        {variants.map((v) => (
          <section key={v.id} className="scroll-mt-8">
            {/* Variant label */}
            <div className="mb-4 flex items-baseline gap-3">
              <span className="font-mono text-3xs tracking-[0.15em] uppercase text-brand-orange">
                L{String(v.id).padStart(2, '0')}
              </span>
              <h2 className="text-charcoal text-[18px] font-semibold tracking-[-0.02em]">
                {v.title}
              </h2>
            </div>
            <p className="text-warm-gray text-sm leading-[1.7] mb-4">
              {v.description}
            </p>

            {/* Logo container */}
            <div className="rounded-xl border border-[var(--border-warm)] overflow-hidden bg-cream-white p-8 flex items-center justify-center min-h-[200px]">
              <Suspense fallback={<LogoFallback />}>
                <v.Component />
              </Suspense>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
