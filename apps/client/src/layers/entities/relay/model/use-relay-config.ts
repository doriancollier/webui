import { useFeatureEnabled } from '@/layers/shared/model';

/** Fetch server config and derive whether the Relay message bus is enabled. */
export function useRelayEnabled(): boolean {
  return useFeatureEnabled('relay');
}
