import { PhilosophyCard } from './PhilosophyCard'
import type { PhilosophyItem } from '../lib/types'

interface PhilosophyGridProps {
  items: PhilosophyItem[]
  title?: string
}

export function PhilosophyGrid({
  items,
  title = 'Principles',
}: PhilosophyGridProps) {
  return (
    <section id="philosophy" className="py-24 px-6 bg-cream-primary">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <h2 className="text-center text-charcoal font-semibold text-3xl md:text-4xl mb-16">
          {title}
        </h2>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {items.map((item) => (
            <PhilosophyCard key={item.number} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}
