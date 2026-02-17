'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import posthog from 'posthog-js'

interface ContactSectionProps {
  email: string
  promptText?: string
}

export function ContactSection({
  email,
  promptText = 'Have feedback, want to contribute, or just say hello?',
}: ContactSectionProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <section id="contact" className="py-32 px-8 bg-cream-secondary">
      <div className="max-w-md mx-auto text-center">
        <span className="font-mono text-2xs tracking-[0.15em] uppercase text-brand-orange block mb-10">
          Contact
        </span>

        <p className="text-warm-gray text-lg leading-[1.7] mb-10">
          {promptText}
        </p>

        {/* Terminal-style command */}
        <div className="inline-flex items-center justify-center gap-2">
          <span className="font-mono text-lg text-warm-gray-light select-none">&gt;</span>
          <AnimatePresence mode="wait">
            {revealed ? (
              <motion.a
                key="email"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                href={`mailto:${email}`}
                className="inline-flex items-center font-mono text-lg tracking-[0.02em] text-brand-orange hover:text-brand-green transition-smooth"
              >
                {email}
                <span className="cursor-blink" aria-hidden="true" />
              </motion.a>
            ) : (
              <motion.button
                key="reveal"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                onClick={() => {
                  setRevealed(true)
                  posthog.capture('contact_email_revealed')
                }}
                className="inline-flex items-center font-mono text-lg tracking-[0.02em] text-brand-orange hover:text-brand-green transition-smooth"
              >
                <span>reveal_email</span>
                <span className="cursor-blink" aria-hidden="true" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
