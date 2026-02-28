'use client'

import { motion } from 'motion/react'
import { villainCards } from '../lib/villain-cards'
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants'

/** Terminal-style CSS art for each villain card — visual evidence, not decoration. */
const CARD_ART: Record<string, React.ReactNode> = {
  'dead-terminal': (
    <div className="font-mono text-[10px] leading-[1.6] text-warm-gray-light/50 mb-3 select-none" aria-hidden="true">
      <span className="text-brand-green/40">$</span> claude &mdash;session refactor-auth
      <br />
      <span className="text-brand-green/40">✓</span> 47 files changed, tests passing
      <br />
      <span className="text-red-400/50">Connection closed.</span>
    </div>
  ),
  goldfish: (
    <div className="font-mono text-[10px] leading-[1.6] text-warm-gray-light/40 mb-3 select-none" aria-hidden="true">
      <span className="text-warm-gray-light/30">&gt;</span> Let me give you some contex
      <span className="cursor-blink" />
    </div>
  ),
  'tab-graveyard': (
    <div className="flex gap-1.5 mb-3 select-none" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full"
          style={{
            width: i < 3 ? '24px' : '16px',
            background: i === 2 ? 'rgba(232, 93, 4, 0.4)' : 'rgba(122, 117, 106, 0.15)',
          }}
        />
      ))}
    </div>
  ),
  '3am-build': (
    <div className="font-mono text-[10px] leading-[1.6] text-warm-gray-light/50 mb-3 select-none" aria-hidden="true">
      <span className="text-red-400/50">✗</span> CI failed &mdash; 2:47am
      <br />
      <span className="text-warm-gray-light/30">fix: 3 lines &middot; agent: ready &middot; terminal: closed</span>
    </div>
  ),
}

/** Pain-point recognition section — four villain cards that name the problem. */
export function VillainSection() {
  return (
    <section className="bg-cream-primary px-8 py-16 md:py-28">
      <motion.div
        className="mx-auto max-w-3xl"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        <motion.div variants={REVEAL} className="mb-16 text-center">
          <h2 className="mb-4 text-[28px] font-medium leading-[1.3] tracking-[-0.02em] text-charcoal md:text-[32px]">
            What your agents do when you leave.
          </h2>
          <p className="text-lg text-warm-gray">Nothing.</p>
        </motion.div>

        <motion.div variants={STAGGER} className="space-y-5">
          {villainCards.map((card) => (
            <motion.article
              key={card.id}
              variants={REVEAL}
              className="rounded-lg px-6 py-5"
              style={{
                background: '#FFFEFB',
                borderLeft: '3px solid rgba(232, 93, 4, 0.3)',
                border: '1px solid rgba(139, 90, 43, 0.1)',
                borderLeftWidth: '3px',
                borderLeftColor: 'rgba(232, 93, 4, 0.3)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(139,90,43,0.06)',
              }}
            >
              {CARD_ART[card.id]}
              <span className="mb-3 block font-mono text-2xs uppercase tracking-[0.12em] text-warm-gray-light">
                {card.label}
              </span>
              {card.body.split('\n\n').map((paragraph, i) => (
                <p
                  key={i}
                  className="mb-3 text-[15px] leading-[1.75] text-warm-gray last:mb-0"
                >
                  {paragraph}
                </p>
              ))}
            </motion.article>
          ))}
        </motion.div>

        <motion.div variants={REVEAL} className="mt-14 text-center">
          <div className="max-w-xl mx-auto" style={{ borderTop: '1px solid rgba(139, 90, 43, 0.1)' }}>
            <p className="text-xl md:text-2xl leading-[1.5] text-charcoal font-medium pt-10">
              You pay for the most powerful AI coding agent ever built.
            </p>
            <p className="text-xl md:text-2xl leading-[1.5] text-warm-gray font-medium">
              It stops the moment you stop watching it.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
