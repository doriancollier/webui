import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTransport, useAppStore } from '@/layers/shared/model';
import type { TaskItem, TaskUpdateEvent, TaskStatus } from '@dorkos/shared/types';

const STATUS_ORDER: Record<TaskStatus, number> = {
  in_progress: 0,
  pending: 1,
  completed: 2,
};

function sortTasks(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

/**
 * Strip empty-string and undefined values from an update event's task fields.
 * For TaskUpdate, buildTaskEvent sends `subject: ''` and `status: 'pending'`
 * as defaults when the SDK didn't include them — stripping these prevents
 * overwriting the existing task's real values during the merge.
 */
function stripDefaults(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== '') result[key] = value;
  }
  return result;
}

export interface TaskState {
  tasks: TaskItem[];
  activeForm: string | null;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  handleTaskEvent: (event: TaskUpdateEvent) => void;
}

const MAX_VISIBLE = 10;

/**
 * Manages task state for a session, combining historical tasks from the API
 * with real-time streaming updates.
 *
 * @param sessionId - The active session ID, or null when no session is selected.
 *   When null, the initial task query is disabled and no API requests are made.
 */
export function useTaskState(sessionId: string | null): TaskState {
  const transport = useTransport();
  const selectedCwd = useAppStore((s) => s.selectedCwd);
  const [taskMap, setTaskMap] = useState<Map<string, TaskItem>>(new Map());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const nextIdRef = useRef(1);

  // Load historical tasks via TanStack Query (invalidated on sync_update)
  const { data: initialTasks } = useQuery({
    queryKey: ['tasks', sessionId, selectedCwd],
    queryFn: () => transport.getTasks(sessionId!, selectedCwd ?? undefined),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: !!sessionId,
  });

  // Reset taskMap when query data changes (initial load or sync invalidation)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Idiomatic: reset state when query data changes
    setTaskMap(new Map());
    nextIdRef.current = 1;

    if (initialTasks && initialTasks.tasks.length > 0) {
      const map = new Map<string, TaskItem>();
      for (const task of initialTasks.tasks) {
        map.set(task.id, task);
      }
      setTaskMap(map);
      nextIdRef.current = initialTasks.tasks.length + 1;
    }
  }, [initialTasks]);

  const handleTaskEvent = useCallback((event: TaskUpdateEvent) => {
    setTaskMap((prev) => {
      const next = new Map(prev);
      if (event.action === 'snapshot') {
        // TodoWrite: full overwrite — clear and rebuild from tasks array
        next.clear();
        const items = event.tasks ?? [event.task];
        for (const item of items) {
          next.set(item.id, item);
        }
        nextIdRef.current = items.length + 1;
      } else if (event.action === 'create') {
        const id = String(nextIdRef.current++);
        next.set(id, { ...event.task, id });
      } else if (event.action === 'update' && event.task.id) {
        const existing = next.get(event.task.id);
        if (existing) {
          next.set(event.task.id, {
            ...existing,
            ...stripDefaults(event.task as unknown as Record<string, unknown>),
          });
        }
      }
      return next;
    });
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const allTasks = Array.from(taskMap.values());
  const sorted = sortTasks(allTasks);
  const inProgressTask = allTasks.find((t) => t.status === 'in_progress');
  const activeForm = inProgressTask?.activeForm ?? null;

  return {
    tasks: sorted.slice(0, MAX_VISIBLE),
    activeForm,
    isCollapsed,
    toggleCollapse,
    handleTaskEvent,
  };
}
