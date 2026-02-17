import Link from 'next/link'

interface HeroProps {
  label?: string
  taglineLine1: string
  taglineLine2: string
  subhead: string
  bylineText: string
  bylineHref: string
}

export function Hero({
  label = 'Independent Studio',
  taglineLine1,
  taglineLine2,
  subhead,
  bylineText,
  bylineHref,
}: HeroProps) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6">
      {/* Graph paper background - small + large grid with vertical fade */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(139, 90, 43, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(139, 90, 43, 0.08) 1px, transparent 1px),
            linear-gradient(to right, rgba(139, 90, 43, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(139, 90, 43, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px, 20px 20px, 100px 100px, 100px 100px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 15%, rgba(0,0,0,1) 30%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.5) 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 15%, rgba(0,0,0,1) 30%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.5) 85%, transparent 100%)',
        }}
      />

      {/* Soft radial glow behind text - creates subtle "spotlight" effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, var(--color-cream-primary) 0%, var(--color-cream-primary) 15%, transparent 65%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto">
        {/* Label */}
        <p className="font-mono text-2xs tracking-[0.2em] uppercase text-warm-gray-light mb-12">
          {label}
        </p>

        {/* Tagline */}
        <h1
          className="font-bold text-charcoal mb-10 tracking-[-0.04em]"
          style={{
            fontSize: 'clamp(48px, 8vw, 96px)',
            lineHeight: 0.9,
          }}
        >
          {taglineLine1}
          <br />
          <span className="text-brand-orange">{taglineLine2}</span>
        </h1>

        {/* Subhead */}
        <p className="text-warm-gray text-lg font-light leading-[1.7] max-w-[400px] mx-auto mb-8">
          {subhead}
        </p>

        {/* Byline with blinking cursor */}
        <Link
          href={bylineHref}
          className="inline-flex items-center font-mono text-button tracking-[0.1em] text-brand-orange hover:text-brand-green transition-smooth"
          target="_blank"
          rel="noopener noreferrer"
        >
          {bylineText}
          <span className="cursor-blink" aria-hidden="true" />
        </Link>
      </div>

      {/* Subtle scan lines overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.02) 2px, rgba(0, 0, 0, 0.02) 4px)',
        }}
      />
    </section>
  )
}
