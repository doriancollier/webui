import { useState } from 'react';

const FIRST_USE_KEY = 'dorkos-first-use-date';
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Read or initialise the first-use date stored in localStorage. */
function resolveFirstUseDate(): Date {
  try {
    const stored = localStorage.getItem(FIRST_USE_KEY);
    if (stored) {
      const parsed = new Date(stored);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const now = new Date();
    localStorage.setItem(FIRST_USE_KEY, now.toISOString());
    return now;
  } catch {
    return new Date();
  }
}

/** Compute days since first use. Extracted so Date.now() is called in an initializer, not render. */
function computeDaysSinceFirstUse(): number {
  const firstUse = resolveFirstUseDate();
  return Math.floor((Date.now() - firstUse.getTime()) / MS_PER_DAY);
}

/**
 * Returns the number of days elapsed since the user's first recorded app usage.
 * Writes the current timestamp to localStorage on first call and reads it on
 * subsequent calls, so the value is stable across sessions.
 */
export function useFirstUseDate(): number {
  const [days] = useState(computeDaysSinceFirstUse);
  return days;
}
