'use client'

import { useEffect, useRef, useState } from 'react'
import { usePresentationMode } from '../lib/use-presentation-mode'

/** Section IDs navigated by keyboard in presentation mode. FutureVisionSection is excluded. */
const PRESENTATION_SECTION_IDS = ['hero', 'morning', 'timeline', 'prompts', 'close'] as const

interface PresentationShellProps {
  children: React.ReactNode
}

/**
 * Wraps the story page. When ?present=true is in the URL:
 * - Switches to fixed full-screen scroll-snap layout
 * - Enables ArrowRight/Space (next) and ArrowLeft (prev) keyboard nav
 * - Renders a progress line at the bottom of the screen
 * - Hides the marketing header and footer
 */
export function PresentationShell({ children }: PresentationShellProps) {
  const isPresent = usePresentationMode()
  const [currentIndex, setCurrentIndex] = useState(0)
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

    const scrollToIndex = (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, PRESENTATION_SECTION_IDS.length - 1))
      const container = containerRef.current
      if (!container) return
      const target = container.querySelector<HTMLElement>(
        `[data-slide="${PRESENTATION_SECTION_IDS[clamped]}"]`,
      )
      if (!target) return
      // Use scrollTo with offsetTop — more reliable than scrollIntoView inside a fixed container
      container.scrollTo({ top: target.offsetTop, behavior: 'smooth' })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        scrollToIndex(currentIndex + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        scrollToIndex(currentIndex - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPresent, currentIndex])

  const progressPct = ((currentIndex + 1) / PRESENTATION_SECTION_IDS.length) * 100

  return (
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
  )
}
