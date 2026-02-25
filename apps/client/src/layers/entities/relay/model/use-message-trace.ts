import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { TraceSpan } from '@dorkos/shared/relay-schemas';

export type { TraceSpan };

/**
 * Fetch the full delivery trace for a single Relay message.
 *
 * @param messageId - The message ID to fetch the trace for. Pass `null` to disable the query.
 */
export function useMessageTrace(messageId: string | null) {
  const transport = useTransport();

  return useQuery({
    queryKey: ['relay', 'trace', messageId],
    queryFn: () => transport.getRelayTrace(messageId!),
    enabled: !!messageId,
    staleTime: 30_000,
  });
}
