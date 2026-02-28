'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants'

/** Final page close — the boot sequence completes. */
export function TheClose() {
  return (
    <section className="py-14 md:py-24 px-8 bg-cream-primary relative">
      {/* Subtle graph-paper callback — matching the Hero */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(139, 90, 43, 0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(139, 90, 43, 0.07) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)',
        }}
      />

      <motion.div
        className="max-w-xl mx-auto text-center relative z-10"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        <motion.p
          variants={REVEAL}
          className="text-warm-gray text-lg md:text-xl leading-[1.5] mb-6"
        >
          Your agents are ready. Give them the night.
        </motion.p>

        <motion.p
          variants={REVEAL}
          className="font-mono text-[48px] md:text-[72px] font-bold text-brand-orange leading-none tracking-[-0.03em] mb-10"
        >
          Ready<span className="cursor-blink" aria-hidden="true" />.
        </motion.p>

        <motion.div variants={REVEAL}>
          <Link
            href="https://www.npmjs.com/package/dorkos"
            target="_blank"
            rel="noopener noreferrer"
            className="marketing-btn hidden lg:inline-flex items-center gap-2"
            style={{ background: '#E85D04', color: '#FFFEFB' }}
          >
            npm install -g dorkos
          </Link>
          <Link
            href="/docs/getting-started/quickstart"
            className="marketing-btn inline-flex lg:hidden items-center gap-2"
            style={{ background: '#E85D04', color: '#FFFEFB' }}
          >
            Get started
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}
