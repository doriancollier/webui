import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';

const ENDPOINTS_KEY = ['relay', 'endpoints'] as const;

/**
 * Fetch all registered relay endpoints.
 *
 * @param enabled - When false, the query is skipped entirely (Relay feature gate).
 */
export function useRelayEndpoints(enabled = true) {
  const transport = useTransport();

  return useQuery({
    queryKey: [...ENDPOINTS_KEY],
    queryFn: () => transport.listRelayEndpoints(),
    enabled,
    staleTime: 30_000,
  });
}
