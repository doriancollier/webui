/**
 * Singleton TanStack Query client — shared across the app and importable
 * by non-React code (e.g. the SSE reconnection handler) via dynamic import.
 *
 * @module shared/lib/query-client
 */
import { QueryClient } from '@tanstack/react-query';

import { QUERY_TIMING } from './constants';

/** Application-wide QueryClient singleton. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_TIMING.DEFAULT_STALE_TIME_MS,
      retry: QUERY_TIMING.DEFAULT_RETRY,
    },
  },
});
