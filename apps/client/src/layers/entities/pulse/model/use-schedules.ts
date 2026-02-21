import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { CreateScheduleInput, UpdateScheduleRequest } from '@dorkos/shared/types';

const SCHEDULES_KEY = ['pulse', 'schedules'] as const;

/**
 * Fetch all Pulse schedules.
 *
 * @param enabled - When false, the query is skipped entirely (Pulse feature gate).
 */
export function useSchedules(enabled = true) {
  const transport = useTransport();

  return useQuery({
    queryKey: [...SCHEDULES_KEY],
    queryFn: () => transport.listSchedules(),
    enabled,
  });
}

/** Create a new Pulse schedule. */
export function useCreateSchedule() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateScheduleInput) => transport.createSchedule(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SCHEDULES_KEY] });
    },
  });
}

/** Update an existing Pulse schedule. */
export function useUpdateSchedule() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateScheduleRequest) =>
      transport.updateSchedule(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SCHEDULES_KEY] });
    },
  });
}

/** Delete a Pulse schedule. */
export function useDeleteSchedule() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transport.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SCHEDULES_KEY] });
    },
  });
}

/** Trigger a manual run of a schedule. */
export function useTriggerSchedule() {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transport.triggerSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse', 'runs'] });
    },
  });
}
