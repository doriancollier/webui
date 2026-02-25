import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';

const DENIED_KEY = ['mesh', 'denied'] as const;

/**
 * Fetch all denied mesh agent paths.
 *
 * @param enabled - When false, the query is skipped entirely (Mesh feature gate).
 */
export function useDeniedAgents(enabled = true) {
  const transport = useTransport();

  return useQuery({
    queryKey: [...DENIED_KEY],
    queryFn: () => transport.listDeniedMeshAgents(),
    enabled,
    staleTime: 30_000,
  });
}
