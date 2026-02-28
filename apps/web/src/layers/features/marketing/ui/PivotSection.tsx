'use client'

import { motion } from 'motion/react'
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants'

/** The OS metaphor reframe — makes "operating system" feel inevitable, not claimed. */
export function PivotSection() {
  return (
    <section className="py-16 md:py-28 px-8 bg-cream-secondary">
      <motion.div
        className="max-w-2xl mx-auto text-center"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        <motion.p
          variants={REVEAL}
          className="text-charcoal text-[24px] md:text-[28px] font-medium tracking-[-0.02em] leading-[1.4] mb-10"
        >
          We solved this for applications fifty years ago.
        </motion.p>

        <motion.div variants={STAGGER} className="space-y-3 mb-10">
          {[
            'Processes needed scheduling. We built cron.',
            'Processes needed communication. We built IPC.',
            'Processes needed discovery. We built registries.',
            'Processes needed memory. We built filesystems.',
          ].map((line) => (
            <motion.p
              key={line}
              variants={REVEAL}
              className="text-warm-gray text-[15px] md:text-base leading-[1.7]"
            >
              {line}
            </motion.p>
          ))}
        </motion.div>

        <motion.p
          variants={REVEAL}
          className="text-charcoal text-[24px] md:text-[28px] font-medium tracking-[-0.02em] leading-[1.4] mb-4"
        >
          We called it an operating system.
        </motion.p>

        <motion.p
          variants={REVEAL}
          className="font-mono text-[24px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.2] mt-8"
          style={{ color: '#E85D04' }}
        >
          So we built one.
        </motion.p>
      </motion.div>
    </section>
  )
}
