import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'dorkos:lastVisitedDashboard';

/**
 * Track the last time the dashboard was visited using localStorage.
 * Reads the previous timestamp via lazy state initializer, then writes the
 * current timestamp in an effect (side-effect only, no setState).
 * Returns null on first visit.
 */
export function useLastVisited(): string | null {
  const [lastVisitedAt] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const hasWritten = useRef(false);

  useEffect(() => {
    if (!hasWritten.current) {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      hasWritten.current = true;
    }
  }, []);

  return lastVisitedAt;
}
