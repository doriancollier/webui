'use client'

import { motion } from 'motion/react'
import { subsystems } from '../lib/subsystems'
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants'

/** SVG micro-visualizations for each subsystem — abstract, functional, brand-native. */
const SUBSYSTEM_ICONS: Record<string, React.ReactNode> = {
  pulse: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {/* Timing bars — evenly-spaced, varying heights like a cron rhythm */}
      <rect x="2" y="16" width="3" height="8" rx="1" fill="#E85D04" opacity="0.7" />
      <rect x="7" y="10" width="3" height="14" rx="1" fill="#E85D04" opacity="0.85" />
      <rect x="12" y="14" width="3" height="10" rx="1" fill="#E85D04" opacity="0.6" />
      <rect x="17" y="8" width="3" height="16" rx="1" fill="#E85D04" opacity="0.9" />
      <rect x="22" y="12" width="3" height="12" rx="1" fill="#E85D04" opacity="0.75" />
    </svg>
  ),
  relay: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {/* Message path with inflection point */}
      <circle cx="4" cy="14" r="3" fill="#E85D04" opacity="0.8" />
      <path d="M7 14 L14 8 L21 14" stroke="#E85D04" strokeWidth="1.5" opacity="0.5" />
      <circle cx="24" cy="14" r="3" fill="#E85D04" opacity="0.8" />
    </svg>
  ),
  mesh: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {/* Three nodes forming a triangle with edges */}
      <line x1="14" y1="5" x2="5" y2="22" stroke="#E85D04" strokeWidth="1.2" opacity="0.4" />
      <line x1="14" y1="5" x2="23" y2="22" stroke="#E85D04" strokeWidth="1.2" opacity="0.4" />
      <line x1="5" y1="22" x2="23" y2="22" stroke="#E85D04" strokeWidth="1.2" opacity="0.4" />
      <circle cx="14" cy="5" r="3" fill="#E85D04" opacity="0.8" />
      <circle cx="5" cy="22" r="3" fill="#E85D04" opacity="0.8" />
      <circle cx="23" cy="22" r="3" fill="#E85D04" opacity="0.8" />
    </svg>
  ),
  wing: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {/* Stacked layers — persistent memory */}
      <rect x="4" y="6" width="20" height="4" rx="1.5" fill="#E85D04" opacity="0.4" />
      <rect x="4" y="12" width="20" height="4" rx="1.5" fill="#E85D04" opacity="0.6" />
      <rect x="4" y="18" width="20" height="4" rx="1.5" fill="#E85D04" opacity="0.8" />
    </svg>
  ),
  console: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {/* Terminal prompt */}
      <path d="M5 10 L11 14 L5 18" stroke="#E85D04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <line x1="14" y1="18" x2="23" y2="18" stroke="#E85D04" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  loop: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {/* Circular arrow — feedback loop */}
      <path d="M14 4 A10 10 0 1 1 4 14" stroke="#E85D04" strokeWidth="1.5" fill="none" opacity="0.6" />
      <polygon points="14,2 14,6 10,4" fill="#E85D04" opacity="0.8" />
    </svg>
  ),
}

/** Compact subsystems reference — gap on the left, module fix on the right. */
export function SubsystemsSection() {
  return (
    <section className="bg-cream-primary px-8 py-20">
      <motion.div
        className="mx-auto max-w-[720px]"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        <motion.span
          variants={REVEAL}
          className="text-2xs font-mono tracking-[0.2em] text-brand-orange mb-6 block text-center uppercase"
        >
          Subsystems
        </motion.span>

        <motion.p
          variants={REVEAL}
          className="text-[24px] md:text-[28px] font-medium text-charcoal tracking-[-0.02em] leading-[1.3] text-center mb-12"
        >
          Six reasons they run while you sleep.
        </motion.p>

        <motion.div variants={STAGGER} className="space-y-0">
          {subsystems.map((sub) => (
            <motion.div
              key={sub.id}
              variants={REVEAL}
              className="flex items-center gap-5 py-4"
              style={{ borderBottom: '1px solid rgba(139, 90, 43, 0.08)' }}
            >
              <span className="text-2xs text-warm-gray-light w-auto md:w-[120px] shrink-0 md:text-right font-mono tracking-[0.06em] hidden md:block">
                {sub.gap}
              </span>
              <div className="shrink-0 w-7 h-7 flex items-center justify-center">
                {SUBSYSTEM_ICONS[sub.id]}
              </div>
              <div className="flex-1">
                <span className="block text-2xs text-warm-gray-light font-mono tracking-[0.06em] mb-0.5 md:hidden">
                  {sub.gap}
                </span>
                <span className="text-brand-orange font-mono text-sm">{sub.name}</span>
                {sub.status === 'coming-soon' && (
                  <span className="text-2xs text-warm-gray-light ml-2 font-mono">In development</span>
                )}
                <span className="text-warm-gray text-sm"> — {sub.description}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  )
}
