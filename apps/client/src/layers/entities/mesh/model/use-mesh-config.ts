import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';

/** Fetch server config and derive whether the Mesh subsystem is enabled. */
export function useMeshEnabled(): boolean {
  const transport = useTransport();

  const { data } = useQuery({
    queryKey: ['config'],
    queryFn: () => transport.getConfig(),
    staleTime: 5 * 60 * 1000,
  });

  return data?.mesh?.enabled ?? false;
}
