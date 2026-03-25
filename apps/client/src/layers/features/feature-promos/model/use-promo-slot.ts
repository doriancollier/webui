import { useMemo } from 'react';
import type { PromoDefinition, PromoPlacement } from './promo-types';
import { PROMO_REGISTRY } from './promo-registry';
import { usePromoContext } from './use-promo-context';
import { useAppStore } from '@/layers/shared/model';

/**
 * Main consumer hook — returns filtered, sorted, capped promos for a placement slot.
 *
 * Pipeline: filter by placement -> exclude dismissed -> evaluate conditions -> sort by priority desc -> cap at maxUnits.
 * Returns empty array when global toggle is off or no promos qualify.
 *
 * @param placement - The slot to filter promos for
 * @param maxUnits - Maximum number of promos to return
 */
export function usePromoSlot(placement: PromoPlacement, maxUnits: number): PromoDefinition[] {
  const ctx = usePromoContext();
  const dismissedPromoIds = useAppStore((s) => s.dismissedPromoIds);
  const promoEnabled = useAppStore((s) => s.promoEnabled);

  return useMemo(() => {
    if (!promoEnabled) return [];

    return PROMO_REGISTRY.filter((p) => p.placements.includes(placement))
      .filter((p) => !dismissedPromoIds.includes(p.id))
      .filter((p) => p.shouldShow(ctx))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxUnits);
  }, [placement, maxUnits, ctx, dismissedPromoIds, promoEnabled]);
}
