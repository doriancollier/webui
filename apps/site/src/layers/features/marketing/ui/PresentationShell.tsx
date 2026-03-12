'use client'

import { useEffect, useRef, useState } from 'react'
import { usePresentationMode } from '../lib/use-presentation-mode'
import { PresentationProvider } from '../lib/presentation-context'

/** Section IDs navigated by keyboard in presentation mode. FutureVisionSection is excluded. */
const PRESENTATION_SECTION_IDS = ['hero', 'morning', 'timeline', 'prompts', 'close'] as const

/** Index of the timeline slide — supports incremental step reveal. */
const TIMELINE_SLIDE_IDX = PRESENTATION_SECTION_IDS.indexOf('timeline')

/** Number of sub-steps on the timeline slide (one per evolution step). */
const TIMELINE_SUB_STEPS = 4

interface PresentationShellProps {
  children: React.ReactNode
}

/**
 * Wraps the story page. When ?present=true is in the URL:
 * - Switches to fixed full-screen scroll-snap layout
 * - Enables ArrowRight/Space (next) and ArrowLeft (prev) keyboard nav
 * - On the timeline slide, ArrowRight reveals one evolution step at a time
 * - Renders a progress line at the bottom of the screen
 * - Hides the marketing header and footer
 */
export function PresentationShell({ children }: PresentationShellProps) {
  const isPresent = usePresentationMode()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [subStep, setSubStep] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Set a data attribute on <html> so global CSS can hide fixed-position chrome (header/footer)
  useEffect(() => {
    const html = document.documentElement
    if (isPresent) {
      html.dataset.presentationMode = 'true'
    } else {
      delete html.dataset.presentationMode
    }
    return () => {
      delete html.dataset.presentationMode
    }
  }, [isPresent])

  // Track which section is in view via IntersectionObserver
  useEffect(() => {
    if (!isPresent || !containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const slideId = entry.target.getAttribute('data-slide')
            const idx = PRESENTATION_SECTION_IDS.indexOf(
              slideId as (typeof PRESENTATION_SECTION_IDS)[number],
            )
            if (idx !== -1) setCurrentIndex(idx)
          }
        }
      },
      { threshold: 0.5 },
    )

    const slides = containerRef.current.querySelectorAll('[data-slide]')
    slides.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [isPresent])

  // Keyboard navigation
  useEffect(() => {
    if (!isPresent) return

    const scrollToIndex = (idx: number, direction: 'forward' | 'back') => {
      const clamped = Math.max(0, Math.min(idx, PRESENTATION_SECTION_IDS.length - 1))
      const container = containerRef.current
      if (!container) return
      const target = container.querySelector<HTMLElement>(
        `[data-slide="${PRESENTATION_SECTION_IDS[clamped]}"]`,
      )
      if (!target) return

      // When entering the timeline slide going forward, start from the first step.
      // When entering it going backward, show all steps already revealed.
      if (PRESENTATION_SECTION_IDS[clamped] === 'timeline') {
        setSubStep(direction === 'forward' ? 0 : TIMELINE_SUB_STEPS - 1)
      } else {
        setSubStep(0)
      }

      container.scrollTo({ top: target.offsetTop, behavior: 'smooth' })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        if (currentIndex === TIMELINE_SLIDE_IDX && subStep < TIMELINE_SUB_STEPS - 1) {
          // Reveal next step on the timeline slide
          setSubStep((s) => s + 1)
        } else {
          scrollToIndex(currentIndex + 1, 'forward')
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (currentIndex === TIMELINE_SLIDE_IDX && subStep > 0) {
          // Hide last step on the timeline slide
          setSubStep((s) => s - 1)
        } else {
          scrollToIndex(currentIndex - 1, 'back')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPresent, currentIndex, subStep])

  const progressPct = ((currentIndex + 1) / PRESENTATION_SECTION_IDS.length) * 100

  return (
    <PresentationProvider value={{ isPresent, subStep }}>
      <div
        ref={containerRef}
        className="presentation-shell"
        {...(isPresent ? { 'data-present': 'true' } : {})}
      >
        {children}

        {isPresent && (
          <div className="presentation-progress" aria-hidden="true">
            <div
              className="presentation-progress-bar"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>
    </PresentationProvider>
  )
}
