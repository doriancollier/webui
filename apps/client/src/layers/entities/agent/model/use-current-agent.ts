import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import { agentKeys } from '../api/queries';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';

/**
 * Fetch the agent manifest for a working directory.
 *
 * Returns `null` when no agent is registered at the given path.
 * Uses a 60-second stale time since agent config changes infrequently.
 *
 * @param cwd - Working directory path to look up
 */
export function useCurrentAgent(cwd: string | null) {
  const transport = useTransport();
  return useQuery<AgentManifest | null>({
    queryKey: agentKeys.byPath(cwd ?? ''),
    queryFn: () => transport.getAgentByPath(cwd!),
    enabled: !!cwd,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
