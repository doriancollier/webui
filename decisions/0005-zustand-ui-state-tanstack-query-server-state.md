---
number: 5
title: Use Zustand for UI State and TanStack Query for Server State
status: accepted
created: 2026-02-11
spec: url-persisted-directory-state
superseded-by: null
---

# 0005. Use Zustand for UI State and TanStack Query for Server State

## Status

Accepted

## Context

The client manages two categories of state: server state (sessions, commands, message history) that needs caching, background refetching, and deduplication; and UI state (selected directory, active session, theme, modal visibility) that is local to the browser. Redux was considered but rejected for its boilerplate overhead. Context API alone lacked caching and background sync capabilities. The team needed a clear decision criterion for which tool to use when.

## Decision

We will use TanStack Query (React Query) for all server state and Zustand for all UI state. The decision criterion is: if the data comes from an API or needs cache invalidation, use TanStack Query; if the data is local to the client and needs persistence, use Zustand with `persist` middleware; if the data is ephemeral UI state (modal open/close), use React `useState`. Examples: `useSessions()` and `useCommands()` use TanStack Query; `useAppStore()` with `selectedCwd` and `recentCwds` uses Zustand.

## Consequences

### Positive

- TanStack Query handles network concerns (caching, dedup, background refetch, stale-while-revalidate) with zero custom code
- Zustand's `persist` middleware handles localStorage automatically; UI state survives page reloads
- Zustand stores are ~20 lines vs Redux's ~100 lines; minimal boilerplate
- TanStack Query deduplicates identical requests; two components requesting the same session list make one HTTP call

### Negative

- Two mental models: developers must learn when to use TanStack Query vs Zustand (using Zustand for server state is a common mistake)
- TanStack Query's cache invalidation model (`staleTime`, `gcTime`, `refetchOnWindowFocus`) has a learning curve
- The same conceptual data (e.g., selected session) can exist in both Zustand (session ID) and TanStack Query cache (session metadata), requiring careful coordination
