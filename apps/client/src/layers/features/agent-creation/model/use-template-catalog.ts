/**
 * TanStack Query hook for fetching the agent template catalog.
 *
 * @module features/agent-creation/model/use-template-catalog
 */
import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';

/** Fetch the merged template catalog (builtin + user templates) with 5-minute caching. */
export function useTemplateCatalog() {
  const transport = useTransport();

  return useQuery({
    queryKey: ['templates'],
    queryFn: () => transport.getTemplates(),
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 30 * 60 * 1000, // 30 min
  });
}
