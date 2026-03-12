import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { ObservedChat } from '@dorkos/shared/relay-schemas';

/**
 * Fetch observed chats for an adapter instance.
 *
 * Used by the BindingDialog chatId picker to show real chats
 * the adapter has seen in trace data.
 *
 * @param adapterId - Adapter instance ID, or undefined to skip the query
 */
export function useObservedChats(adapterId: string | undefined) {
  const transport = useTransport();
  return useQuery<ObservedChat[]>({
    queryKey: ['relay', 'observed-chats', adapterId],
    queryFn: () => transport.getObservedChats(adapterId!),
    enabled: !!adapterId,
    staleTime: 30_000,
  });
}
