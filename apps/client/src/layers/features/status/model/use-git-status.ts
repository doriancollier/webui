import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import { QUERY_TIMING } from '@/layers/shared/lib';
import type { GitStatusResponse, GitStatusError } from '@dorkos/shared/types';

export function useGitStatus(cwd: string | null) {
  const transport = useTransport();

  return useQuery({
    queryKey: ['git-status', cwd],
    queryFn: () => transport.getGitStatus(cwd ?? undefined),
    enabled: !!cwd,
    refetchInterval: QUERY_TIMING.GIT_STATUS_REFETCH_MS,
    refetchIntervalInBackground: false,
    staleTime: QUERY_TIMING.GIT_STATUS_STALE_TIME_MS,
  });
}

export function isGitStatusOk(
  data: GitStatusResponse | GitStatusError | undefined
): data is GitStatusResponse {
  return !!data && !('error' in data);
}
