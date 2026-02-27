import { useFeatureEnabled } from '@/layers/shared/model';

/** Fetch server config and derive whether the Pulse scheduler is enabled. */
export function usePulseEnabled(): boolean {
  return useFeatureEnabled('pulse');
}
