import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { CreateAgentOptions } from '@dorkos/shared/mesh-schemas';

/**
 * Mutation hook for creating a new agent via the Transport interface.
 * Invalidates the agents query cache on success.
 */
export function useCreateAgent() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts: CreateAgentOptions) => transport.createAgent(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['mesh', 'agents'] });
      queryClient.invalidateQueries({ queryKey: ['mesh', 'agent-paths'] });
    },
  });
}
