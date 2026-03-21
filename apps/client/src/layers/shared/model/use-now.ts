import { useState, useEffect } from 'react';

/**
 * Return a stable `Date.now()` timestamp that re-renders the component on a fixed interval.
 *
 * Avoids calling `Date.now()` directly inside render or `useMemo` (which triggers the
 * `react-hooks/purity` lint rule). The returned value updates every `intervalMs` milliseconds.
 *
 * @param intervalMs - Re-render interval in milliseconds (default: 60 000 — one minute)
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
