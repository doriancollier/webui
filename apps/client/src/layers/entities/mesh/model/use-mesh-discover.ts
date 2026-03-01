import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';

/** Trigger a mesh discovery scan across filesystem roots. */
export function useDiscoverAgents() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts: { roots: string[]; maxDepth?: number }) =>
      transport.discoverMeshAgents(opts.roots, opts.maxDepth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesh', 'agents'] });
    },
  });
}
