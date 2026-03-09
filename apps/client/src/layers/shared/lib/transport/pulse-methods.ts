/**
 * Pulse scheduler Transport methods factory.
 *
 * @module shared/lib/transport/pulse-methods
 */
import type {
  PulseSchedule,
  PulseRun,
  CreateScheduleInput,
  UpdateScheduleRequest,
  ListRunsQuery,
  PulsePreset,
} from '@dorkos/shared/types';
import { fetchJSON, buildQueryString } from './http-client';

/** Create all Pulse scheduler methods bound to a base URL. */
export function createPulseMethods(baseUrl: string) {
  return {
    listSchedules(): Promise<PulseSchedule[]> {
      return fetchJSON<PulseSchedule[]>(baseUrl, '/pulse/schedules');
    },

    createSchedule(opts: CreateScheduleInput): Promise<PulseSchedule> {
      return fetchJSON<PulseSchedule>(baseUrl, '/pulse/schedules', {
        method: 'POST',
        body: JSON.stringify(opts),
      });
    },

    updateSchedule(id: string, opts: UpdateScheduleRequest): Promise<PulseSchedule> {
      return fetchJSON<PulseSchedule>(baseUrl, `/pulse/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(opts),
      });
    },

    deleteSchedule(id: string): Promise<{ success: boolean }> {
      return fetchJSON<{ success: boolean }>(baseUrl, `/pulse/schedules/${id}`, {
        method: 'DELETE',
      });
    },

    triggerSchedule(id: string): Promise<{ runId: string }> {
      return fetchJSON<{ runId: string }>(baseUrl, `/pulse/schedules/${id}/trigger`, {
        method: 'POST',
      });
    },

    listRuns(opts?: Partial<ListRunsQuery>): Promise<PulseRun[]> {
      const qs = buildQueryString({
        scheduleId: opts?.scheduleId,
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      });
      return fetchJSON<PulseRun[]>(baseUrl, `/pulse/runs${qs}`);
    },

    getRun(id: string): Promise<PulseRun> {
      return fetchJSON<PulseRun>(baseUrl, `/pulse/runs/${id}`);
    },

    cancelRun(id: string): Promise<{ success: boolean }> {
      return fetchJSON<{ success: boolean }>(baseUrl, `/pulse/runs/${id}/cancel`, {
        method: 'POST',
      });
    },

    getPulsePresets(): Promise<PulsePreset[]> {
      return fetchJSON<PulsePreset[]>(baseUrl, '/pulse/presets');
    },
  };
}
