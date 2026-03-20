import { useSearch } from '@tanstack/react-router';
import type { SessionSearch } from '@/router';

/**
 * Read session search params safely from any route.
 *
 * Returns `{ session, dir }` when on `/_shell/session`, empty object otherwise.
 * Uses `strict: false` so it never throws — safe to call from any route.
 */
export function useSessionSearch(): Partial<SessionSearch> {
  const search = useSearch({ strict: false });
  return {
    session: typeof search.session === 'string' ? search.session : undefined,
    dir: typeof search.dir === 'string' ? search.dir : undefined,
  };
}
