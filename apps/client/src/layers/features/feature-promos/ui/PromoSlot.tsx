import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { PromoPlacement } from '../model/promo-types';
import { usePromoSlot } from '../model/use-promo-slot';
import { PromoCard } from './PromoCard';

const sectionEntrance = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.2, ease: [0, 0, 0.2, 1] },
} as const;

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
} as const;

interface PromoSlotProps {
  /** Which placement slot to render. */
  placement: PromoPlacement;
  /** Maximum number of promo cards to show. */
  maxUnits: number;
}

/**
 * Renders promo cards for a given placement slot.
 * Zero DOM when no promos qualify. Layout varies by placement.
 *
 * - `dashboard-main`: section header + responsive 1/2-col grid
 * - `dashboard-sidebar`, `agent-sidebar`: vertical stack, no header
 */
export function PromoSlot({ placement, maxUnits }: PromoSlotProps) {
  const promos = usePromoSlot(placement, maxUnits);
  const shouldReduceMotion = useReducedMotion();

  const motionProps = shouldReduceMotion ? {} : sectionEntrance;

  return (
    <AnimatePresence initial={false}>
      {promos.length > 0 && (
        <motion.section
          key="promo-slot"
          data-slot="promo-slot"
          {...motionProps}
          className="overflow-hidden"
        >
          {placement === 'dashboard-main' && (
            <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">
              Discover
            </h2>
          )}

          <motion.div
            variants={shouldReduceMotion ? undefined : staggerContainer}
            initial="initial"
            animate="animate"
            className={
              placement === 'dashboard-main' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'space-y-2'
            }
          >
            {promos.map((promo) => (
              <PromoCard key={promo.id} promo={promo} placement={placement} />
            ))}
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
