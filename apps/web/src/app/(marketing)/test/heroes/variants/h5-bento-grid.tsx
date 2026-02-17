'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { REVEAL, STAGGER } from '@/layers/features/marketing/lib/motion-variants'

interface HeroProps {
  headline: string
  subhead: string
  ctaText: string
  ctaHref: string
}

// ─── Shared cell wrapper ──────────────────────────────────────────────────────

/**
 * Shared bento cell wrapper — cream background, warm border, spring lift on hover.
 */
function BentoCell({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      variants={REVEAL}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`bg-cream-white rounded-xl border border-[var(--border-warm)] overflow-hidden ${className}`}
    >
      {children}
    </motion.div>
  )
}

// ─── Cell 1: Headline ─────────────────────────────────────────────────────────

function HeadlineCell({
  headline,
  subhead,
  ctaHref,
}: Pick<HeroProps, 'headline' | 'subhead' | 'ctaHref'>) {
  return (
    <BentoCell className="col-span-1 md:col-span-1 lg:col-span-2 p-8 md:p-10 flex flex-col justify-between min-h-[280px]">
      <div>
        <span className="font-mono text-2xs tracking-[0.2em] uppercase text-warm-gray-light block mb-6">
          Open Source · MIT Licensed
        </span>
        <h1
          className="font-bold text-charcoal tracking-[-0.04em] leading-[1.0] mb-6"
          style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
        >
          {headline}
        </h1>
        <p className="text-warm-gray text-sm leading-[1.75] max-w-[400px] mb-8">
          {subhead}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-brand-orange text-cream-white font-mono text-button tracking-[0.08em] rounded-lg hover:bg-[#C94E00] transition-colors"
        >
          Get Started
        </Link>
        <Link
          href="/docs/getting-started/quickstart"
          className="inline-flex items-center justify-center px-5 py-2.5 border border-[var(--border-warm)] text-warm-gray font-mono text-button tracking-[0.08em] rounded-lg hover:border-brand-orange hover:text-brand-orange transition-colors"
        >
          Read the Docs →
        </Link>
      </div>
    </BentoCell>
  )
}

// ─── Cell 2: Phone mockup ─────────────────────────────────────────────────────

/** Simulated phone UI row shown inside the phone shell. */
function PhoneUiRow({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 border-b border-[rgba(139,90,43,0.08)] last:border-0 ${dim ? 'opacity-40' : ''}`}>
      <span className="font-mono text-3xs text-warm-gray-light tracking-wider">{label}</span>
      <span className="font-mono text-3xs text-brand-orange">{value}</span>
    </div>
  )
}

function DeviceMockupCell() {
  return (
    <BentoCell className="p-6 flex flex-col items-center justify-center min-h-[280px]">
      <span className="font-mono text-2xs tracking-[0.15em] uppercase text-warm-gray-light mb-4">
        Mobile
      </span>
      {/* Phone shell */}
      <div
        className="relative w-[120px] h-[220px] rounded-[22px] border-[3px] border-charcoal bg-cream-secondary shadow-lg flex flex-col overflow-hidden"
        aria-hidden="true"
      >
        {/* Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-charcoal rounded-full" />
        {/* Screen content */}
        <div className="flex-1 mt-6 px-2 pt-2 flex flex-col gap-0.5">
          <PhoneUiRow label="SESSION" value="ACTIVE" />
          <PhoneUiRow label="AGENT" value="claude-3" />
          <PhoneUiRow label="TASKS" value="4 / 7" />
          <PhoneUiRow label="PULSE" value="ON" />
          <PhoneUiRow label="UPTIME" value="6h 12m" dim />
        </div>
        {/* Home bar */}
        <div className="h-4 flex items-center justify-center pb-1">
          <div className="w-8 h-0.5 bg-charcoal/30 rounded-full" />
        </div>
      </div>
      <p className="font-mono text-3xs text-warm-gray-light mt-4 tracking-wider text-center">
        Access from anywhere
      </p>
    </BentoCell>
  )
}

// ─── Cell 3: Stats ────────────────────────────────────────────────────────────

interface StatItem {
  value: string
  label: string
}

const STATS: StatItem[] = [
  { value: '6', label: 'Modules' },
  { value: 'MIT', label: 'Licensed' },
  { value: '100%', label: 'Open Source' },
  { value: '24/7', label: 'Always On' },
]

function StatBadge({ value, label }: StatItem) {
  return (
    <div className="flex flex-col items-center justify-center p-3 bg-cream-secondary rounded-lg gap-1">
      <span className="font-mono font-bold text-brand-orange tracking-[-0.02em] leading-none" style={{ fontSize: 'clamp(20px, 2.5vw, 28px)' }}>
        {value}
      </span>
      <span className="font-mono text-3xs tracking-[0.12em] uppercase text-warm-gray-light">
        {label}
      </span>
    </div>
  )
}

function StatsCell() {
  return (
    <BentoCell className="p-6 flex flex-col justify-between min-h-[280px]">
      <span className="font-mono text-2xs tracking-[0.15em] uppercase text-warm-gray-light">
        By the numbers
      </span>
      <div className="grid grid-cols-2 gap-2 mt-4">
        {STATS.map((stat) => (
          <StatBadge key={stat.label} {...stat} />
        ))}
      </div>
    </BentoCell>
  )
}

// ─── Cell 4: Terminal install ─────────────────────────────────────────────────

function TerminalCell({ ctaText }: { ctaText: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(ctaText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <BentoCell className="p-6 flex flex-col justify-between min-h-[160px]">
      {/* Terminal header bar */}
      <div className="flex items-center gap-1.5 mb-4">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
        <span className="font-mono text-3xs text-warm-gray-light ml-2 tracking-wider">
          terminal
        </span>
      </div>
      {/* Command line */}
      <div className="flex-1 bg-cream-secondary rounded-lg px-4 py-3 flex items-center gap-2">
        <span className="font-mono text-button text-brand-orange select-none" aria-hidden="true">$</span>
        <span className="font-mono text-button text-charcoal flex-1 tracking-tight">{ctaText}</span>
      </div>
      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        className="mt-3 self-end font-mono text-3xs tracking-[0.12em] uppercase text-warm-gray-light hover:text-brand-orange transition-colors cursor-pointer"
        aria-label="Copy install command"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </BentoCell>
  )
}

// ─── Cell 5: Product screenshot ───────────────────────────────────────────────

function ScreenshotCell() {
  return (
    <BentoCell className="col-span-1 md:col-span-2 lg:col-span-3 overflow-hidden">
      <div className="relative w-full aspect-[16/10] bg-cream-secondary">
        <Image
          src="/images/dorkos-screenshot.png"
          alt="DorkOS console"
          width={1280}
          height={800}
          className="w-full h-full object-cover object-top"
          priority={false}
        />
        {/* Bottom label */}
        <div className="absolute bottom-3 left-4">
          <span className="font-mono text-3xs tracking-[0.15em] uppercase text-warm-gray-light bg-cream-white/80 backdrop-blur-sm px-2 py-1 rounded">
            DorkOS Console
          </span>
        </div>
      </div>
    </BentoCell>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

/**
 * HeroV5 — Bento grid hero with headline, device mockup, stats, terminal, and screenshot cells.
 *
 * Desktop: 4-column, 2-row grid.
 * Tablet:  2-column adaptive layout.
 * Mobile:  single column stack.
 */
export function HeroV5({ headline, subhead, ctaText, ctaHref }: HeroProps) {
  return (
    <section className="bg-cream-primary px-4 py-12 md:px-8 md:py-16">
      {/*
        Desktop grid (lg+): 4 columns, 2 explicit rows.
          Row 1: [headline (2col)] [phone (1col)] [stats (1col)]
          Row 2: [terminal (1col)] [screenshot (3col)]

        Tablet grid (md): 3 columns.
          Row 1: [headline (2col)] [phone (1col)]
          Row 2: [terminal (1col)] [stats (2col)]
          Row 3: [screenshot (3col)]

        Mobile: single column, natural order.
      */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-7xl mx-auto"
        initial="hidden"
        animate="visible"
        variants={STAGGER}
      >
        {/* Cell 1 — Headline (2 cols on lg, 2 cols on md, full on mobile) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          <HeadlineCell
            headline={headline}
            subhead={subhead}
            ctaHref={ctaHref}
          />
        </div>

        {/* Cell 2 — Phone mockup (1 col always) */}
        <div className="col-span-1">
          <DeviceMockupCell />
        </div>

        {/* Cell 3 — Stats (1 col on lg, full row on md via order trick, 1 col on mobile) */}
        <div className="col-span-1 md:col-span-1 lg:col-span-1">
          <StatsCell />
        </div>

        {/* Cell 4 — Terminal (1 col always) */}
        <div className="col-span-1">
          <TerminalCell ctaText={ctaText} />
        </div>

        {/* Cell 5 — Screenshot (3 cols on lg, full width on md, full on mobile) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <ScreenshotCell />
        </div>
      </motion.div>
    </section>
  )
}
