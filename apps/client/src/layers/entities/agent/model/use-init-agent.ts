import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import { agentKeys } from '../api/queries';

/**
 * Mutation hook to initialize an agent at a directory path (write config to existing directory).
 * Invalidates the byPath query on success.
 */
export function useInitAgent() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts: { path: string; name?: string; description?: string; runtime?: string }) =>
      transport.initAgent(opts.path, opts.name, opts.description, opts.runtime),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.byPath(variables.path) });
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}
