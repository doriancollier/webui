import { useFeatureEnabled } from '@/layers/shared/model';

/** Fetch server config and derive whether the Mesh subsystem is enabled. */
export function useMeshEnabled(): boolean {
  return useFeatureEnabled('mesh');
}
