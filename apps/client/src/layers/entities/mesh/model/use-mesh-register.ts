import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';

/** Register a discovered agent into the mesh registry. */
export function useRegisterAgent() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts: { path: string; overrides?: Partial<AgentManifest>; approver?: string }) =>
      transport.registerMeshAgent(opts.path, opts.overrides, opts.approver),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesh', 'agents'] });
    },
  });
}
