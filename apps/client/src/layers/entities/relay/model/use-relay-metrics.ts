import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';

const METRICS_KEY = ['relay', 'metrics'] as const;

/**
 * Fetch relay system metrics.
 *
 * @param enabled - When false, the query is skipped entirely (Relay feature gate).
 */
export function useRelayMetrics(enabled = true) {
  const transport = useTransport();

  return useQuery({
    queryKey: [...METRICS_KEY],
    queryFn: () => transport.getRelayMetrics(),
    enabled,
    staleTime: 30_000,
  });
}
