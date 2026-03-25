import { useRelayAdapters, useRelayEnabled } from '@/layers/entities/relay';

/**
 * Returns whether a relay adapter of the given type is configured and connected.
 *
 * @param name - The adapter type name (e.g. 'telegram', 'slack', 'webhook').
 */
export function useAdapterStatus(name: string): boolean {
  const isRelayEnabled = useRelayEnabled();
  const { data: adapters } = useRelayAdapters(isRelayEnabled);

  if (!adapters) return false;

  return adapters.some((item) => item.config.type === name && item.status.state === 'connected');
}
