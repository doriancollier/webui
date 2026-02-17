'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { REVEAL, STAGGER } from '@/layers/features/marketing/lib/motion-variants'

interface HeroProps {
  headline: string
  subhead: string
  ctaText: string
  ctaHref: string
}

// ---------------------------------------------------------------------------
// Typewriter sequence definition
// ---------------------------------------------------------------------------

interface TerminalLine {
  type: 'input' | 'output' | 'blank'
  prompt?: string
  text: string
  /** delay before this line starts appearing, in ms after the previous finished */
  pauseBefore?: number
}

const TERMINAL_LINES: TerminalLine[] = [
  { type: 'input', prompt: '$ ', text: 'npm install -g dorkos', pauseBefore: 0 },
  { type: 'blank', text: '', pauseBefore: 160 },
  { type: 'output', text: 'added 1 package in 3s', pauseBefore: 0 },
  { type: 'blank', text: '', pauseBefore: 80 },
  { type: 'input', prompt: '$ ', text: 'dorkos --dir ~/projects', pauseBefore: 600 },
  { type: 'blank', text: '', pauseBefore: 120 },
  { type: 'output', text: '✓ DorkOS running on http://localhost:4242', pauseBefore: 0 },
]

/** Characters per second for input lines; output lines appear instantly */
const CHARS_PER_SEC = 22
const CHAR_DELAY_MS = Math.round(1000 / CHARS_PER_SEC)

// ---------------------------------------------------------------------------
// useTypewriter hook
// ---------------------------------------------------------------------------

interface TypewriterState {
  /** Index of the line currently being typed (or last completed) */
  lineIndex: number
  /** How many characters of the current input line are visible */
  charIndex: number
  /** Which lines are fully revealed */
  revealedLines: boolean[]
  /** Whether the full sequence is done */
  done: boolean
}

function useTypewriter(lines: TerminalLine[], startDelay = 800) {
  const [state, setState] = useState<TypewriterState>({
    lineIndex: -1,
    charIndex: 0,
    revealedLines: [],
    done: false,
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    function clearTimers() {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    function revealLine(index: number) {
      if (cancelled || index >= lines.length) {
        if (!cancelled) setState((s) => ({ ...s, done: true }))
        return
      }

      const line = lines[index]
      const pause = line.pauseBefore ?? 0

      timerRef.current = setTimeout(() => {
        if (cancelled) return

        if (line.type !== 'input') {
          // Output and blank lines appear immediately
          setState((s) => {
            const next = [...s.revealedLines]
            next[index] = true
            return { ...s, lineIndex: index, charIndex: 0, revealedLines: next }
          })
          revealLine(index + 1)
          return
        }

        // Input lines type character by character
        const totalChars = line.text.length
        let charCount = 0

        setState((s) => ({ ...s, lineIndex: index, charIndex: 0 }))

        intervalRef.current = setInterval(() => {
          if (cancelled) {
            clearInterval(intervalRef.current!)
            return
          }
          charCount++
          setState((s) => ({ ...s, charIndex: charCount }))

          if (charCount >= totalChars) {
            clearInterval(intervalRef.current!)
            setState((s) => {
              const next = [...s.revealedLines]
              next[index] = true
              return { ...s, revealedLines: next }
            })
            revealLine(index + 1)
          }
        }, CHAR_DELAY_MS)
      }, pause)
    }

    timerRef.current = setTimeout(() => {
      if (!cancelled) revealLine(0)
    }, startDelay)

    return () => {
      cancelled = true
      clearTimers()
    }
  }, [lines, startDelay])

  return state
}

// ---------------------------------------------------------------------------
// TerminalWindow
// ---------------------------------------------------------------------------

interface TerminalWindowProps {
  lines: TerminalLine[]
  typeState: TypewriterState
}

function TerminalWindow({ lines, typeState }: TerminalWindowProps) {
  const { lineIndex, charIndex, revealedLines } = typeState

  return (
    <div
      className="rounded-lg overflow-hidden shadow-floating border border-[rgba(255,255,255,0.08)] flex flex-col"
      style={{ background: '#1A1814' }}
    >
      {/* macOS window chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(255,255,255,0.06)] shrink-0"
        style={{ background: '#232018' }}
      >
        <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
        <span className="w-3 h-3 rounded-full bg-[#28C840]" />
        <span
          className="ml-auto font-mono text-[10px] tracking-[0.08em]"
          style={{ color: '#6B6560' }}
        >
          Terminal — bash
        </span>
      </div>

      {/* Terminal body */}
      <div className="p-5 font-mono text-[13px] leading-[1.9] flex-1 min-h-0">
        {lines.map((line, i) => {
          const isCurrentInputLine = line.type === 'input' && i === lineIndex && !revealedLines[i]
          const isRevealed = revealedLines[i]
          const isPast = i < lineIndex || isRevealed

          if (!isPast && !isCurrentInputLine) return null

          if (line.type === 'blank') {
            return <div key={i} className="h-[0.5em]" />
          }

          if (line.type === 'output') {
            const isSuccess = line.text.startsWith('✓')
            return (
              <div key={i} style={{ color: isSuccess ? '#4EC94E' : '#8B8680' }}>
                {line.text}
              </div>
            )
          }

          // Input line
          const visibleText = isCurrentInputLine ? line.text.slice(0, charIndex) : line.text
          const showCursor = isCurrentInputLine

          return (
            <div key={i} className="flex items-baseline">
              <span style={{ color: '#4EC94E' }}>{line.prompt}</span>
              <span style={{ color: '#F5F0E6' }}>{visibleText}</span>
              {showCursor && (
                <span
                  className="inline-block w-[7px] h-[13px] ml-[1px]"
                  style={{
                    background: '#E85D04',
                    animation: 'cursor-fade 1.1s ease-in-out infinite',
                    verticalAlign: 'text-bottom',
                  }}
                />
              )}
            </div>
          )
        })}

        {/* Idle cursor after sequence completes */}
        {typeState.done && (
          <div className="flex items-baseline">
            <span style={{ color: '#4EC94E' }}>$ </span>
            <span
              className="inline-block w-[7px] h-[13px] ml-[1px]"
              style={{
                background: '#E85D04',
                animation: 'cursor-fade 1.1s ease-in-out infinite',
                verticalAlign: 'text-bottom',
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BrowserWindow — simplified DorkOS UI mockup
// ---------------------------------------------------------------------------

function BrowserWindow() {
  return (
    <div
      className="rounded-lg overflow-hidden shadow-floating border flex flex-col"
      style={{ borderColor: 'rgba(139, 90, 43, 0.15)', background: '#FFFEFB' }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{
          background: '#F5F0E6',
          borderColor: 'rgba(139, 90, 43, 0.12)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <span className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <div
          className="flex-1 rounded px-3 py-1 font-mono text-[11px] text-center"
          style={{
            background: '#EDE6D6',
            color: '#7A756A',
            maxWidth: '240px',
            margin: '0 auto',
          }}
        >
          localhost:4242
        </div>
      </div>

      {/* DorkOS UI — sidebar + chat */}
      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ height: '320px' }}>
        {/* Sidebar */}
        <div
          className="w-[160px] shrink-0 border-r flex flex-col"
          style={{
            background: '#EDE6D6',
            borderColor: 'rgba(139, 90, 43, 0.12)',
          }}
        >
          {/* Sidebar header */}
          <div
            className="px-3 py-2.5 border-b"
            style={{ borderColor: 'rgba(139, 90, 43, 0.1)' }}
          >
            <span className="font-mono text-[9px] tracking-[0.12em] uppercase" style={{ color: '#7A756A' }}>
              Sessions
            </span>
          </div>

          {/* Session items */}
          <div className="flex-1 overflow-hidden py-1">
            {[
              { label: 'Fix auth middleware', active: true },
              { label: 'Refactor API routes', active: false },
              { label: 'Add test coverage', active: false },
            ].map((session) => (
              <div
                key={session.label}
                className="px-3 py-2 mx-1 my-0.5 rounded-[4px]"
                style={{
                  background: session.active ? '#FFFEFB' : 'transparent',
                  borderLeft: session.active ? '2px solid #E85D04' : '2px solid transparent',
                }}
              >
                <div
                  className="font-mono text-[10px] leading-[1.4] truncate"
                  style={{ color: session.active ? '#1A1814' : '#7A756A' }}
                >
                  {session.label}
                </div>
              </div>
            ))}
          </div>

          {/* New session button */}
          <div className="p-2 border-t" style={{ borderColor: 'rgba(139, 90, 43, 0.1)' }}>
            <div
              className="w-full py-1.5 px-2 rounded-[4px] font-mono text-[9px] tracking-[0.08em] uppercase text-center"
              style={{ background: '#E85D04', color: '#FFFEFB' }}
            >
              + New
            </div>
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: '#FFFEFB' }}>
          {/* Chat header */}
          <div
            className="px-4 py-2.5 border-b"
            style={{ borderColor: 'rgba(139, 90, 43, 0.08)' }}
          >
            <span className="font-mono text-[10px] tracking-[0.06em]" style={{ color: '#1A1814' }}>
              Fix auth middleware
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-hidden p-3 space-y-3">
            {/* User message */}
            <div className="flex justify-end">
              <div
                className="max-w-[75%] px-3 py-2 rounded-[6px] rounded-tr-[2px] font-mono text-[11px] leading-[1.5]"
                style={{ background: '#1A1814', color: '#F5F0E6' }}
              >
                The JWT refresh logic is broken — tokens expire mid-session.
              </div>
            </div>

            {/* Assistant message */}
            <div className="flex justify-start">
              <div
                className="max-w-[80%] px-3 py-2 rounded-[6px] rounded-tl-[2px] text-[11px] leading-[1.6]"
                style={{
                  background: '#F5F0E6',
                  color: '#4A4640',
                  border: '1px solid rgba(139,90,43,0.1)',
                }}
              >
                <div
                  className="font-mono text-[9px] tracking-[0.1em] uppercase mb-1"
                  style={{ color: '#E85D04' }}
                >
                  Claude
                </div>
                I&apos;ll fix the token refresh timing. Reading{' '}
                <code
                  className="px-1 rounded-[2px] font-mono"
                  style={{ background: '#EDE6D6', fontSize: '10px' }}
                >
                  auth/middleware.ts
                </code>
                …
              </div>
            </div>

            {/* Tool call indicator */}
            <div
              className="flex items-center gap-2 px-2 py-1.5 rounded-[4px]"
              style={{ background: '#F5F0E6', border: '1px solid rgba(139,90,43,0.12)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: '#228B22' }}
              />
              <span className="font-mono text-[9px]" style={{ color: '#7A756A' }}>
                Editing auth/middleware.ts
              </span>
            </div>
          </div>

          {/* Input bar */}
          <div
            className="px-3 py-2 border-t flex items-center gap-2"
            style={{ borderColor: 'rgba(139, 90, 43, 0.08)' }}
          >
            <div
              className="flex-1 rounded-[4px] px-3 py-1.5 font-mono text-[11px]"
              style={{
                background: '#F5F0E6',
                color: '#7A756A',
                border: '1px solid rgba(139,90,43,0.12)',
              }}
            >
              Message Claude…
            </div>
            <div
              className="w-7 h-7 rounded-[4px] flex items-center justify-center shrink-0"
              style={{ background: '#E85D04' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M7 3l3 3-3 3" stroke="#FFFEFB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * HeroV2 — Split screen hero: terminal on left types the install flow,
 * browser mockup on the right reveals the DorkOS UI after sequence completes.
 */
export function HeroV2({ headline, subhead, ctaText, ctaHref }: HeroProps) {
  const typeState = useTypewriter(TERMINAL_LINES, 800)
  const browserVisible = typeState.done

  return (
    <section className="relative min-h-[85vh] bg-cream-primary flex flex-col items-center justify-center px-6 py-16 overflow-hidden">
      {/* Subtle graph-paper background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(139, 90, 43, 0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(139, 90, 43, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
        }}
      />

      {/* Content wrapper */}
      <motion.div
        className="relative z-10 w-full max-w-6xl mx-auto"
        initial="hidden"
        animate="visible"
        variants={STAGGER}
      >
        {/* Headline */}
        <motion.div variants={REVEAL} className="text-center mb-4">
          <p className="font-mono text-2xs tracking-[0.2em] uppercase text-brand-orange mb-5">
            Install → Run → Use
          </p>
          <h1
            className="font-bold text-charcoal tracking-[-0.04em] overflow-visible"
            style={{ fontSize: 'clamp(36px, 6vw, 72px)', lineHeight: 1.05 }}
          >
            {headline}
          </h1>
        </motion.div>

        {/* Subhead */}
        <motion.p
          variants={REVEAL}
          className="text-warm-gray text-base font-light leading-[1.7] max-w-[520px] mx-auto text-center mb-12"
        >
          {subhead}
        </motion.p>

        {/* Split panels */}
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          {/* Left — Terminal */}
          <motion.div
            className="flex-1 min-w-0"
            initial={{ opacity: 0, x: -32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="h-full flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xs tracking-[0.12em] uppercase text-warm-gray-light">
                  01 — Install
                </span>
                <div className="h-px flex-1" style={{ background: 'rgba(139,90,43,0.15)' }} />
              </div>
              <TerminalWindow lines={TERMINAL_LINES} typeState={typeState} />
            </div>
          </motion.div>

          {/* Right — Browser */}
          <motion.div
            className="flex-1 min-w-0"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: browserVisible ? 1 : 0, x: browserVisible ? 0 : 32 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="h-full flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xs tracking-[0.12em] uppercase text-warm-gray-light">
                  02 — Open
                </span>
                <div className="h-px flex-1" style={{ background: 'rgba(139,90,43,0.15)' }} />
              </div>
              <AnimatePresence>
                {browserVisible && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  >
                    <BrowserWindow />
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Placeholder shimmer while waiting */}
              {!browserVisible && (
                <div
                  className="rounded-lg border animate-pulse"
                  style={{
                    height: '380px',
                    background: '#EDE6D6',
                    borderColor: 'rgba(139,90,43,0.12)',
                  }}
                />
              )}
            </div>
          </motion.div>
        </div>

        {/* CTAs */}
        <motion.div
          variants={REVEAL}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          {/* Primary CTA */}
          <motion.div
            animate={browserVisible ? { scale: [1, 1.03, 1] } : {}}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            <Link
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center font-mono text-button tracking-[0.1em] text-brand-orange hover:text-brand-green transition-smooth"
            >
              {ctaText}
              <span className="cursor-blink" aria-hidden="true" />
            </Link>
          </motion.div>

          <span className="text-warm-gray-light font-mono text-2xs" aria-hidden="true">
            ·
          </span>

          {/* Secondary CTA */}
          <Link
            href="/docs/getting-started/quickstart"
            className="inline-flex items-center font-mono text-2xs tracking-[0.1em] text-warm-gray-light hover:text-brand-orange transition-smooth"
          >
            Read the docs &rarr;
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}
