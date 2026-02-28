'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'motion/react'
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants'

/** The install command with typing animation, positioned at peak desire. */
export function InstallMoment() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.5 })
  const [displayText, setDisplayText] = useState('')
  const hasAnimated = useRef(false)
  const command = 'npm install -g dorkos'

  useEffect(() => {
    if (!isInView || hasAnimated.current) return
    hasAnimated.current = true
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayText(command.slice(0, i))
      if (i >= command.length) clearInterval(interval)
    }, 50)
    return () => clearInterval(interval)
  }, [isInView])

  return (
    <section ref={ref} className="py-14 md:py-24 px-8 bg-cream-tertiary">
      <motion.div
        className="max-w-xl mx-auto text-center"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        <motion.div variants={REVEAL} className="mb-10">
          <div className="inline-block bg-cream-secondary rounded-lg px-8 py-5">
            <p className="font-mono text-lg md:text-xl text-charcoal">
              <span style={{ color: '#7A756A' }}>$ </span>
              {displayText || command}
              <span className="cursor-blink" aria-hidden="true" />
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={REVEAL}
          className="flex flex-wrap items-center justify-center gap-2 mb-6"
        >
          {['Claude Agent SDK', 'Open Source', 'MIT Licensed', 'Self-Hosted'].map((badge) => (
            <span
              key={badge}
              className="font-mono text-[9px] tracking-[0.08em] uppercase px-2 py-0.5 rounded-[3px]"
              style={{
                background: 'rgba(232, 93, 4, 0.06)',
                color: '#7A756A',
                border: '1px solid rgba(232, 93, 4, 0.12)',
              }}
            >
              {badge}
            </span>
          ))}
        </motion.div>

        <motion.p variants={REVEAL} className="text-charcoal text-lg font-medium mb-2">
          One person. Ten agents. Ship around the clock.
        </motion.p>

        <motion.div variants={REVEAL} className="flex items-center justify-center gap-6 mt-8">
          <Link
            href="https://www.npmjs.com/package/dorkos"
            target="_blank"
            rel="noopener noreferrer"
            className="marketing-btn hidden lg:inline-flex items-center gap-2"
            style={{ background: '#E85D04', color: '#FFFEFB' }}
          >
            npm install -g dorkos
            <span className="cursor-blink" aria-hidden="true" />
          </Link>
          <Link
            href="/docs/getting-started/quickstart"
            className="marketing-btn inline-flex lg:hidden items-center gap-2"
            style={{ background: '#E85D04', color: '#FFFEFB' }}
          >
            Get started
          </Link>
          <Link
            href="/docs/getting-started/quickstart"
            className="font-mono text-button tracking-[0.08em] text-warm-gray-light hover:text-brand-orange transition-smooth"
          >
            Read the docs
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}
