/**
 * Discovery entity — shared discovery scan state and hook.
 *
 * Provides a Zustand store (`useDiscoveryStore`) for cross-feature scan state
 * and a `useDiscoveryScan` hook that wraps the Transport `scan()` method.
 *
 * @module entities/discovery
 */
export { useDiscoveryStore } from './model/discovery-store';
export type { DiscoveryState, DiscoveryActions } from './model/discovery-store';
export { useDiscoveryScan } from './model/use-discovery-scan';
