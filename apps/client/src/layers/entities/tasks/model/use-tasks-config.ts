import { useFeatureEnabled } from '@/layers/shared/model';

/** Fetch server config and derive whether the Tasks scheduler is enabled. */
export function useTasksEnabled(): boolean {
  return useFeatureEnabled('tasks');
}
