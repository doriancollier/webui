import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import { agentKeys } from '../api/queries';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';

/**
 * Batch resolve agents for multiple paths.
 * Used by DirectoryPicker to show agent names in the recents list.
 *
 * @param paths - Array of directory paths to resolve
 */
export function useResolvedAgents(paths: string[]) {
  const transport = useTransport();
  return useQuery<Record<string, AgentManifest | null>>({
    queryKey: agentKeys.resolved(paths),
    queryFn: () => transport.resolveAgents(paths),
    enabled: paths.length > 0,
    staleTime: 60_000,
  });
}
