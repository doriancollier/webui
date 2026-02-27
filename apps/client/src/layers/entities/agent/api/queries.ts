/**
 * TanStack Query key factory for agent identity queries.
 *
 * @module entities/agent/api
 */
export const agentKeys = {
  all: ['agents'] as const,
  byPath: (path: string) => ['agents', 'byPath', path] as const,
  resolved: (paths: string[]) => ['agents', 'resolved', ...paths] as const,
};
