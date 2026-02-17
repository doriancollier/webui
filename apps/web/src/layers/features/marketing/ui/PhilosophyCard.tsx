import type { PhilosophyItem } from '../lib/types'

interface PhilosophyCardProps {
  item: PhilosophyItem
}

export function PhilosophyCard({ item }: PhilosophyCardProps) {
  return (
    <div className="text-left">
      {/* Number - Green per mockup */}
      <span className="font-mono text-2xs tracking-[0.1em] text-brand-green block mb-4">
        {item.number}
      </span>

      {/* Title */}
      <h3 className="text-charcoal font-semibold text-lg tracking-[-0.01em] mb-3">
        {item.title}
      </h3>

      {/* Description */}
      <p className="text-warm-gray text-sm leading-[1.7]">
        {item.description}
      </p>
    </div>
  )
}
