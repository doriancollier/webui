/**
 * Track the last time the activity feed was visited using localStorage.
 *
 * Pattern mirrors `use-last-visited.ts` in the dashboard-activity feature.
 * Reads the previous timestamp on mount (lazy state initializer), then writes
 * the current timestamp in a side-effect. Returns null on first visit.
 *
 * @module features/activity-feed-page/model/use-last-visited-activity
 */
import { useEffect, useRef, useState } from 'react';

/** localStorage key for the activity feed last-visit timestamp. */
const STORAGE_KEY = 'dorkos:lastVisitedActivity';

/**
 * Track the last time the activity feed was visited.
 *
 * @returns ISO 8601 timestamp of the previous visit, or null on first visit.
 */
export function useLastVisitedActivity(): string | null {
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
