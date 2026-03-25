import { useMeshEnabled as useMeshEnabledEntity } from '@/layers/entities/mesh';

/**
 * Returns whether the Mesh agent registry is enabled.
 * Mesh is always enabled per ADR-0062; this hook exists for explicit
 * PromoContext composition rather than embedding the entity directly.
 */
export function useMeshEnabled(): boolean {
  return useMeshEnabledEntity();
}
