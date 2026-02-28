'use client'

import { Fragment } from 'react'
import { motion } from 'motion/react'
import { timelineEntries } from '../lib/timeline-entries'
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants'

const MODULE_NAMES = ['PULSE', 'RELAY', 'MESH', 'CONSOLE', 'WING', 'LOOP', 'ENGINE']

/** Render text with [MODULE] references highlighted in brand orange monospace. */
function renderWithModules(text: string) {
  const parts = text.split(/(\[[A-Z]+\])/)
  return parts.map((part, i) => {
    const match = part.match(/^\[([A-Z]+)\]$/)
    if (match && MODULE_NAMES.includes(match[1])) {
      return (
        <span key={i} className="font-mono text-brand-orange">
          {match[1]}
        </span>
      )
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

/** "A Night with DorkOS" — vertical timeline showing the product through story. */
export function TimelineSection() {
  return (
    <section className="bg-cream-white px-8 py-16 md:py-32">
      <motion.div
        className="mx-auto max-w-3xl"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        <motion.div variants={REVEAL} className="mb-20">
          <span className="text-2xs font-mono tracking-[0.2em] uppercase text-brand-orange mb-6 block text-center">
            A Night with DorkOS
          </span>
        </motion.div>

        <div className="relative">
          <div
            className="absolute top-0 bottom-0 left-[72px] hidden w-px md:block"
            style={{ background: 'rgba(139, 90, 43, 0.12)' }}
          />

          <motion.div variants={STAGGER} className="space-y-12">
            {timelineEntries.map((entry) => (
              <motion.div
                key={entry.id}
                variants={REVEAL}
                className="flex flex-col gap-4 md:flex-row md:gap-8"
              >
                <div className="shrink-0 md:w-[72px] md:text-right">
                  <span className="font-mono text-xs tracking-[0.04em]" style={{ color: '#7A756A' }}>
                    {entry.time}
                  </span>
                </div>

                <div className="hidden items-start pt-1.5 md:flex">
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: '#E85D04' }} />
                </div>

                <div className="flex-1 space-y-3">
                  {entry.paragraphs.map((p, i) => (
                    <p key={i} className="text-warm-gray text-[15px] leading-[1.75]">
                      {renderWithModules(p)}
                    </p>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
