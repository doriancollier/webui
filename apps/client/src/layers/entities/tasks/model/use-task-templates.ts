import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { TaskTemplate } from '@dorkos/shared/types';

export type { TaskTemplate } from '@dorkos/shared/types';

/** Fetch available Task templates from the server. */
export function useTaskTemplates() {
  const transport = useTransport();
  return useQuery<TaskTemplate[]>({
    queryKey: ['tasks', 'templates'],
    queryFn: () => transport.getTaskTemplates(),
  });
}
