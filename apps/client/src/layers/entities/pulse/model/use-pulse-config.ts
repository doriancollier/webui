import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';

/** Fetch server config and derive whether the Pulse scheduler is enabled. */
export function usePulseEnabled(): boolean {
  const transport = useTransport();

  const { data } = useQuery({
    queryKey: ['config'],
    queryFn: () => transport.getConfig(),
    staleTime: 5 * 60 * 1000,
  });

  return data?.pulse?.enabled ?? false;
}
