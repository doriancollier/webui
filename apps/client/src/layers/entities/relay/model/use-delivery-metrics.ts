import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { DeliveryMetrics } from '@dorkos/shared/relay-schemas';

export type { DeliveryMetrics };

/** Fetch aggregate delivery metrics with 30-second auto-refresh. */
export function useDeliveryMetrics() {
  const transport = useTransport();

  return useQuery({
    queryKey: ['relay', 'metrics'],
    queryFn: () => transport.getRelayDeliveryMetrics(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
