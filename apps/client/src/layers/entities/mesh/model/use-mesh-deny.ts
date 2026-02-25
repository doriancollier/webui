import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';

/** Deny a discovered agent path, preventing future registration. */
export function useDenyAgent() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts: { path: string; reason?: string; denier?: string }) =>
      transport.denyMeshAgent(opts.path, opts.reason, opts.denier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesh', 'denied'] });
    },
  });
}
