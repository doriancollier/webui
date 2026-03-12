'use client'

import { motion } from 'motion/react'
import { REVEAL, STAGGER, VIEWPORT } from '../../lib/motion-variants'
import { evolutionSteps } from '../../lib/story-data'

interface HowItBuiltSectionProps {
  slideId?: string
}

/** 4-step evolution timeline: LifeOS -> DorkOS -> Pulse -> Mesh. */
export function HowItBuiltSection({ slideId = 'timeline' }: HowItBuiltSectionProps) {
  return (
    <section
      className="flex min-h-screen flex-col justify-center bg-cream-primary px-8 py-16"
      data-slide={slideId}
    >
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={STAGGER}
          className="mb-10"
        >
          <motion.div
            variants={REVEAL}
            className="mb-3 font-mono text-[9px] tracking-[0.2em] text-brand-orange uppercase"
          >
            Two Months of Evenings
          </motion.div>
          <motion.h2
            variants={REVEAL}
            className="text-[clamp(20px,2.8vw,32px)] font-semibold tracking-tight text-charcoal"
          >
            Each step hit a ceiling. Each ceiling became the next build.
          </motion.h2>
        </motion.div>

        {/* Timeline steps */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={STAGGER}
          className="flex flex-col gap-6"
        >
          {evolutionSteps.map((step) => (
            <motion.div key={step.step} variants={REVEAL} className="flex gap-4">
              {/* Step number */}
              <div
                className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold text-cream-white ${step.color === 'orange' ? 'bg-brand-orange' : 'bg-charcoal'}`}
              >
                {step.step}
              </div>

              {/* Content */}
              <div className="min-w-0">
                <div className={`mb-0.5 font-mono text-[9px] tracking-[0.1em] uppercase ${step.color === 'orange' ? 'text-brand-orange' : 'text-warm-gray'}`}>
                  {step.product} &mdash; {step.duration}
                </div>
                <p className="mb-1 text-[14px] font-medium text-charcoal">{step.description}</p>
                {step.ceiling && (
                  <p className="font-mono text-[10px] text-warm-gray-light">
                    Ceiling hit: {step.ceiling}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer quote */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={REVEAL}
          className="mt-8 border-t border-cream-tertiary pt-6"
        >
          <p className="text-[13px] italic leading-relaxed text-warm-gray">
            &ldquo;Total calendar time from &lsquo;I want a to-do list&rsquo; to &lsquo;my agents coordinate while I sleep&rsquo; &mdash;&mdash; about two months of evenings.&rdquo;
          </p>
        </motion.div>
      </div>
    </section>
  )
}
