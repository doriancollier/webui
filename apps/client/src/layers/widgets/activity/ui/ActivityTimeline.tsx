import { useId, useMemo } from 'react';
import { motion } from 'motion/react';
import { Skeleton } from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib';
import {
  ActivityRow,
  ActivityGroupHeader,
  ActivityEmptyState,
  groupByTime,
  useActivityKeyboardNav,
} from '@/layers/features/activity-feed-page';
import type { ActivityItem } from '@/layers/entities/activity';

// ---------------------------------------------------------------------------
// Stagger animation variants (module-scope to avoid recreation)
// ---------------------------------------------------------------------------

const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.03 } },
} as const;

const staggerItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } },
} as const;

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

/**
 * Skeleton shimmer for a single activity row while data is loading.
 *
 * Uses `useId()` to derive a deterministic summary width so each skeleton
 * row looks slightly different without relying on `Math.random()`.
 */
function ActivityRowSkeleton() {
  const id = useId();

  // Derive a deterministic width (50-90%) from the React-generated id so each
  // row appears slightly different. Using `style` here because the width is
  // dynamically computed and cannot be expressed as a Tailwind class.
  const summaryWidth = useMemo(() => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `${(hash % 40) + 50}%`;
  }, [id]);

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Time column — matches the w-28 fixed-width time slot in ActivityRow */}
      <Skeleton className="h-3 w-28 shrink-0" />
      {/* Actor badge — matches the w-24 actor badge slot */}
      <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
      {/* Summary — variable width for visual variety */}
      <Skeleton className="h-3 rounded" style={{ width: summaryWidth }} />
    </div>
  );
}

/** Five-row skeleton with a group header, matching the live timeline anatomy. */
function ActivityTimelineSkeleton() {
  return (
    <div data-slot="activity-timeline-skeleton" className="space-y-1">
      {/* Skeleton group header — mirrors ActivityGroupHeader layout */}
      <div className="py-2">
        <Skeleton className="h-3 w-16 rounded" />
      </div>
      {/* Skeleton rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        // Static index key is safe — skeleton rows are purely decorative
        // and never reorder. eslint-disable-next-line react/no-array-index-key
        <ActivityRowSkeleton key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityTimeline
// ---------------------------------------------------------------------------

export interface ActivityTimelineProps {
  /** All loaded activity items (flattened from all pages). */
  items: ActivityItem[];
  /** When true shows a skeleton loader instead of items. */
  isLoading: boolean;
  /** When true every item is filtered out — shows filtered empty state. */
  isFiltered: boolean;
  className?: string;
}

/**
 * Time-grouped activity timeline.
 *
 * Groups items into Today / Yesterday / This Week / Earlier buckets.
 * Renders a sticky group header above each bucket. Shows a skeleton
 * shimmer while data is loading, or an empty state when no items match.
 */
export function ActivityTimeline({
  items,
  isLoading,
  isFiltered,
  className,
}: ActivityTimelineProps) {
  const groups = useMemo(() => groupByTime(items, new Date()), [items]);
  const { containerRef, handleKeyDown } = useActivityKeyboardNav(items.length);

  if (isLoading && items.length === 0) {
    return (
      <div data-slot="activity-timeline" className={cn('px-4', className)}>
        <ActivityTimelineSkeleton />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div data-slot="activity-timeline" className={cn(className)}>
        <ActivityEmptyState isFiltered={isFiltered} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      data-slot="activity-timeline"
      className={cn('px-4', className)}
    >
      {groups.map((group) => (
        <section key={group.label}>
          <ActivityGroupHeader
            label={group.label as 'Today' | 'Yesterday' | 'This Week' | 'Earlier'}
          />
          <motion.div
            className="divide-y divide-transparent"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {group.items.map((item, index) => (
              <motion.div
                key={item.id}
                // Limit stagger to first 8 items per group for performance
                variants={index < 8 ? staggerItem : undefined}
              >
                <ActivityRow item={item} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      ))}
    </div>
  );
}
