import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { ListRunsQuery } from '@dorkos/shared/types';

const RUNS_KEY = ['pulse', 'runs'] as const;

/** Fetch Pulse runs with optional filters. */
export function useRuns(opts?: Partial<ListRunsQuery>) {
  const transport = useTransport();

  return useQuery({
    queryKey: [...RUNS_KEY, opts],
    queryFn: () => transport.listRuns(opts),
    refetchInterval: 10_000,
  });
}

/** Fetch a single Pulse run by ID. */
export function useRun(id: string | null) {
  const transport = useTransport();

  return useQuery({
    queryKey: [...RUNS_KEY, id],
    queryFn: () => transport.getRun(id!),
    enabled: !!id,
  });
}

/** Cancel a running Pulse job. */
export function useCancelRun() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transport.cancelRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...RUNS_KEY] });
    },
  });
}
