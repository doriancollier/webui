import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';

const AGENT_PATHS_KEY = ['mesh', 'agent-paths'] as const;

/** Fetch registered agents with their project paths (lightweight, for onboarding/scheduling). */
export function useMeshAgentPaths() {
  const transport = useTransport();

  return useQuery({
    queryKey: [...AGENT_PATHS_KEY],
    queryFn: () => transport.listMeshAgentPaths(),
    staleTime: 30_000,
  });
}
