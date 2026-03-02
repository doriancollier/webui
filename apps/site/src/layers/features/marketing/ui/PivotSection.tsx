'use client'

import { motion } from 'motion/react'
import { BRAND_COLORS } from '@dorkos/icons/brand'
import { SUBSYSTEMS } from '@dorkos/icons/subsystems'
import { REVEAL, STAGGER, SPRING, VIEWPORT } from '../lib/motion-variants'

/** Word stagger variant — each word fades in 100ms apart. */
const WORD_STAGGER = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
}

const WORD_REVEAL = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: SPRING,
  },
}

/** The OS metaphor reframe — makes "operating system" feel inevitable, not claimed. */
export function PivotSection() {
  const closingWords = 'So we built them one.'.split(' ')

  return (
    <section className="py-16 md:py-28 px-8 bg-cream-secondary">
      <motion.div
        className="max-w-2xl mx-auto text-center"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        {/* Thesis — the line people remember */}
        <motion.p
          variants={REVEAL}
          className="text-charcoal text-[24px] md:text-[28px] font-semibold tracking-[-0.02em] leading-[1.4] mb-6"
        >
          Intelligence doesn&apos;t scale. Coordination does.
        </motion.p>

        {/* Proof — history earns the claim */}
        <motion.p
          variants={REVEAL}
          className="text-warm-gray text-[15px] md:text-base leading-[1.7] mb-10"
        >
          That&apos;s the lesson of every team, every company, every civilization.
          The breakthroughs never came from smarter people. They came from giving
          smart people better systems&nbsp;&mdash; schedules, communication, shared
          memory, ways to find each other.
        </motion.p>

        {/* OS icons — visual bridge from thesis to product */}
        <motion.div
          variants={STAGGER}
          className="grid grid-cols-3 md:grid-cols-6 gap-8 max-w-xs md:max-w-lg mx-auto mb-10"
        >
          {SUBSYSTEMS.map((sub) => {
            const Icon = sub.icon
            return (
              <motion.div key={sub.id} variants={REVEAL} className="flex flex-col items-center gap-2">
                <Icon size={32} color={BRAND_COLORS.orange} strokeWidth={1.5} />
                <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-brand-orange">
                  {sub.label}
                </span>
              </motion.div>
            )
          })}
        </motion.div>

        {/* The agent turn */}
        <motion.p
          variants={REVEAL}
          className="text-warm-gray text-[18px] md:text-[20px] leading-[1.6] mb-2"
        >
          Your AI agents have the intelligence.
          They just don&apos;t have the systems yet.
        </motion.p>

        {/* Word-by-word stagger on the closing line */}
        <motion.p
          variants={WORD_STAGGER}
          className="font-mono text-[24px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.2] mt-8"
          style={{ color: BRAND_COLORS.orange }}
        >
          {closingWords.map((word, i) => (
            <motion.span
              key={i}
              variants={WORD_REVEAL}
              className="inline-block mr-[0.3em] last:mr-0"
            >
              {word}
            </motion.span>
          ))}
        </motion.p>
      </motion.div>
    </section>
  )
}
