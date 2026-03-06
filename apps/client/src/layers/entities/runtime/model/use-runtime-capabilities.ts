import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { RuntimeCapabilities } from '@dorkos/shared/agent-runtime';

/** Query key for the capabilities endpoint — static for the server lifetime. */
const CAPABILITIES_KEY = ['capabilities'] as const;

/**
 * Fetch runtime capabilities for all registered runtimes.
 *
 * Capabilities are static for the lifetime of a server process, so
 * `staleTime: Infinity` prevents unnecessary refetches. Re-fetch by
 * calling `queryClient.invalidateQueries({ queryKey: ['capabilities'] })`.
 */
export function useRuntimeCapabilities() {
  const transport = useTransport();

  return useQuery({
    queryKey: [...CAPABILITIES_KEY],
    queryFn: () => transport.getCapabilities(),
    staleTime: Infinity,
  });
}

/**
 * Convenience hook — returns the default runtime's capability flags.
 *
 * Returns `undefined` while the capabilities are still loading.
 */
export function useDefaultCapabilities(): RuntimeCapabilities | undefined {
  const { data } = useRuntimeCapabilities();
  if (!data) return undefined;
  return data.capabilities[data.defaultRuntime];
}
