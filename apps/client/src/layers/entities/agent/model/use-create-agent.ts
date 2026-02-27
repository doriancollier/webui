import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import { agentKeys } from '../api/queries';

/**
 * Mutation hook to create a new agent at a directory path.
 * Invalidates the byPath query on success.
 */
export function useCreateAgent() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts: { path: string; name?: string; description?: string; runtime?: string }) =>
      transport.createAgent(opts.path, opts.name, opts.description, opts.runtime),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.byPath(variables.path) });
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}
