import { useQueryClient } from '@tanstack/react-query';
import type { ConnectionState } from '@dorkos/shared/types';
import { useEventStream, useEventSubscription } from '@/layers/shared/model';

/**
 * Subscribe to relay events from the unified SSE stream and invalidate the
 * conversations query cache on each incoming message.
 *
 * @param enabled - When false, handlers are no-ops (avoids invalidations while relay is disabled).
 * @param pattern - Reserved for future server-side filtering; currently unused by the unified stream.
 * @returns Connection state and failed attempt count sourced from the shared event stream.
 */
export function useRelayEventStream(
  enabled: boolean,
  pattern?: string // eslint-disable-line @typescript-eslint/no-unused-vars
): { connectionState: ConnectionState; failedAttempts: number } {
  const queryClient = useQueryClient();
  const { connectionState, failedAttempts } = useEventStream();

  useEventSubscription('relay_message', () => {
    if (enabled) {
      queryClient.invalidateQueries({ queryKey: ['relay', 'conversations'] });
    }
  });

  useEventSubscription('relay_signal', () => {
    if (enabled) {
      queryClient.invalidateQueries({ queryKey: ['relay', 'conversations'] });
    }
  });

  return { connectionState, failedAttempts };
}
