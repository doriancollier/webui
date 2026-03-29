/**
 * Infinite-scroll data fetching hook for the full activity feed page.
 * Uses cursor-based pagination via `before` param (ISO 8601 timestamp of
 * the oldest item on the current page).
 *
 * @module features/activity-feed-page/model/use-full-activity-feed
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import type { ListActivityQuery, ListActivityResponse } from '@dorkos/shared/activity-schemas';

/** Stable query key root for all activity feed queries. */
export const ACTIVITY_QUERY_KEY = ['activity'] as const;

/**
 * Fetch the full activity feed with cursor-based infinite pagination.
 *
 * Each page returns up to 50 items ordered by `occurredAt` descending.
 * The next page is loaded by passing `nextCursor` from the previous page
 * as the `before` param.
 *
 * @param filters - Optional filter params forwarded to the transport.
 */
export function useFullActivityFeed(filters: Partial<ListActivityQuery> = {}) {
  const transport = useTransport();

  return useInfiniteQuery<ListActivityResponse>({
    queryKey: [...ACTIVITY_QUERY_KEY, filters],
    queryFn: ({ pageParam }) =>
      transport.listActivityEvents({
        ...filters,
        limit: 50,
        before: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
