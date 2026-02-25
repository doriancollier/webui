import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';

/** Update an existing mesh agent's metadata. */
export function useUpdateAgent() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts: { id: string; updates: Partial<AgentManifest> }) =>
      transport.updateMeshAgent(opts.id, opts.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesh', 'agents'] });
    },
  });
}
