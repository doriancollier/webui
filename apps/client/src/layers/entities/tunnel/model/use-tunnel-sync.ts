import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createChannel } from '@/layers/shared/lib';
import type { TunnelStatus } from '@dorkos/shared/types';

const CHANNEL_NAME = 'dorkos-tunnel';

/** Broadcast a tunnel status change to other tabs. */
export function broadcastTunnelChange(): void {
  const channel = createChannel(CHANNEL_NAME);
  channel.postMessage({ type: 'tunnel_changed' });
  channel.close();
}

/**
 * Cross-tab and cross-device tunnel status sync.
 *
 * Subscribes to BroadcastChannel for same-browser tab sync
 * and SSE `/api/tunnel/stream` for cross-device sync.
 * Invalidates `tunnel-status` and `config` queries on any event.
 */
export function useTunnelSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['tunnel-status'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    };

    // Cross-tab sync via BroadcastChannel
    const channel = createChannel<{ type: string }>(CHANNEL_NAME);
    const unsubscribe = channel.onMessage(() => invalidate());

    // Cross-device sync via SSE
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/tunnel/stream');
      eventSource.addEventListener('tunnel_status', (event: MessageEvent) => {
        try {
          const status = JSON.parse(event.data) as TunnelStatus;
          queryClient.setQueryData(['tunnel-status'], status);
          queryClient.invalidateQueries({ queryKey: ['config'] });
        } catch {
          invalidate();
        }
      });
    } catch {
      // SSE unavailable (e.g., test environment)
    }

    return () => {
      unsubscribe();
      channel.close();
      eventSource?.close();
    };
  }, [queryClient]);
}
