import { useRef, useCallback, useEffect, useState } from 'react';
import { useTaskRuns } from './use-task-runs';

const STORAGE_KEY = 'dorkos-tasks-last-viewed';

interface CompletedTaskRunBadge {
  unviewedCount: number;
  clearBadge: () => void;
}

/**
 * Track Task run completions for badge/notification display.
 *
 * Only fires for runs that transition from `running` to a terminal state
 * during the current session. Runs already complete on initial load are not counted.
 *
 * @param enabled - When false, the hook is disabled (Tasks feature gate).
 */
export function useCompletedTaskRunBadge(enabled = true): CompletedTaskRunBadge {
  const { data: runs } = useTaskRuns({ limit: 50 }, enabled);
  const prevRunningIdsRef = useRef<Set<string>>(new Set());
  const [unviewedCount, setUnviewedCount] = useState(0);

  // Track which runs were previously "running"
  useEffect(() => {
    if (!runs) return;

    const currentRunning = new Set(runs.filter((r) => r.status === 'running').map((r) => r.id));
    const prevRunning = prevRunningIdsRef.current;

    // Detect transitions: was running, now terminal
    let newCompletions = 0;
    for (const id of prevRunning) {
      const run = runs.find((r) => r.id === id);
      if (run && run.status !== 'running') {
        newCompletions++;
      }
    }

    if (newCompletions > 0) {
      setUnviewedCount((prev) => prev + newCompletions);
    }

    prevRunningIdsRef.current = currentRunning;
  }, [runs]);

  const clearBadge = useCallback(() => {
    setUnviewedCount(0);
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  }, []);

  return {
    unviewedCount,
    clearBadge,
  };
}
