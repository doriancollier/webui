import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { RelayConversation } from '@dorkos/shared/relay-schemas';

export const RELAY_CONVERSATIONS_KEY = ['relay', 'conversations'] as const;

/** Fetch grouped relay conversations with human-readable labels. */
export function useRelayConversations(enabled = true) {
  const transport = useTransport();
  return useQuery<{ conversations: RelayConversation[] }>({
    queryKey: [...RELAY_CONVERSATIONS_KEY],
    queryFn: () => transport.listRelayConversations(),
    enabled,
    refetchInterval: 5000,
  });
}
