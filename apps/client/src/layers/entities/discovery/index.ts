/**
 * Discovery entity — shared discovery scan state, hook, and UI primitives.
 *
 * Provides a Zustand store (`useDiscoveryStore`) for cross-feature scan state,
 * a `useDiscoveryScan` hook that wraps the Transport `scan()` method, and the
 * `CandidateCard` UI component for rendering discovered agent candidates.
 *
 * @module entities/discovery
 */
export { useDiscoveryStore } from './model/discovery-store';
export type { DiscoveryState, DiscoveryActions } from './model/discovery-store';
export { useDiscoveryScan } from './model/use-discovery-scan';
export { CandidateCard } from './ui/CandidateCard';
