import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Connect to the Relay SSE event stream and inject incoming messages into the query cache.
 *
 * @param enabled - Whether to connect (typically tied to relay feature flag).
 * @param pattern - Optional subject pattern for server-side filtering.
 */
export function useRelayEventStream(enabled: boolean, pattern?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const params = pattern ? `?subject=${encodeURIComponent(pattern)}` : '';
    const source = new EventSource(`/api/relay/stream${params}`);

    source.addEventListener('relay_message', (e) => {
      const envelope = JSON.parse(e.data);
      queryClient.setQueryData(
        ['relay', 'messages', undefined],
        (old: { messages: unknown[]; nextCursor?: string } | undefined) => {
          if (!old) return { messages: [envelope] };
          return { ...old, messages: [envelope, ...old.messages] };
        },
      );
    });

    source.addEventListener('relay_delivery', (e) => {
      const data = JSON.parse(e.data);
      queryClient.setQueryData(
        ['relay', 'messages', undefined],
        (old: { messages: unknown[]; nextCursor?: string } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((msg) => {
              const m = msg as Record<string, unknown>;
              return m.id === data.messageId ? { ...m, status: data.status } : msg;
            }),
          };
        },
      );
    });

    return () => source.close();
  }, [enabled, pattern, queryClient]);
}
