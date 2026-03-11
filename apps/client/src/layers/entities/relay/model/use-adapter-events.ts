import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { AdapterEvent } from '@dorkos/shared/transport';

/** Parsed metadata from an adapter event. */
export interface AdapterEventMetadata {
  adapterId: string;
  eventType: string;
  message: string;
}

/**
 * Fetch adapter lifecycle events with 5-second polling.
 *
 * @param adapterId - The adapter instance ID, or null to disable the query
 */
export function useAdapterEvents(adapterId: string | null) {
  const transport = useTransport();
  return useQuery<{ events: AdapterEvent[] }>({
    queryKey: ['relay', 'adapters', adapterId, 'events'],
    queryFn: () => transport.getAdapterEvents(adapterId!),
    enabled: !!adapterId,
    refetchInterval: 5_000,
  });
}
