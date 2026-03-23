/**
 * Re-export from shared layer — the store lives in shared/model to allow
 * cross-feature access (command-palette, top-nav) without FSD violations.
 */
export { useAgentCreationStore } from '@/layers/shared/model';
