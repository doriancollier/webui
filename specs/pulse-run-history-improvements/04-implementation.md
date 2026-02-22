# Implementation Summary: Pulse RunHistoryPanel Improvements & RunRow Navigation Bug Fix

**Created:** 2026-02-22
**Last Updated:** 2026-02-22
**Spec:** specs/pulse-run-history-improvements/02-specification.md

## Progress

**Status:** Complete
**Tasks Completed:** 9 / 9

## Tasks Completed

### Session 1 - 2026-02-22

- Task #1: [P1] Fix RunRow navigation with scheduleCwd prop
- Task #2: [P1] Update tests and add navigation tests
- Task #3: [P2] Add ARIA attributes and keyboard support to RunRow
- Task #4: [P2] Add cancel toast feedback with sonner
- Task #5: [P3] Add status filter to schema, server, route, and transport
- Task #6: [P3] Add status filter Select UI and Load more pagination
- Task #7: [P4] Conditional polling in useRuns
- Task #8: [P4] Add RunTimestamp component and trigger badges
- Task #9: [P4] Add Skeleton loading and truncated text tooltips

## Files Modified/Created

**Source files:**

- `apps/client/src/layers/features/pulse/ui/RunHistoryPanel.tsx` - Navigation fix, ARIA attrs, toast feedback, status filter, pagination, RunTimestamp, trigger badges, skeleton loading, tooltips
- `apps/client/src/layers/features/pulse/ui/ScheduleRow.tsx` - Pass schedule.cwd to RunHistoryPanel
- `apps/client/src/layers/entities/pulse/model/use-runs.ts` - Conditional polling (refetchInterval function form)
- `apps/client/src/layers/shared/lib/http-transport.ts` - Status param in listRuns URL
- `apps/client/src/layers/shared/ui/skeleton.tsx` - New shadcn Skeleton component
- `apps/client/src/layers/shared/ui/index.ts` - Export Skeleton
- `packages/shared/src/schemas.ts` - Added status to ListRunsQuerySchema
- `apps/server/src/services/pulse-store.ts` - Dynamic SQL with status filter
- `apps/server/src/routes/pulse.ts` - Pass status to listRuns

**Test files:**

- `apps/client/src/layers/features/pulse/__tests__/RunHistoryPanel.test.tsx` - useDirectoryState mock, scheduleCwd prop, navigation tests
- `apps/client/src/layers/entities/pulse/__tests__/use-runs.test.tsx` - Conditional polling tests

## Known Issues

_(None)_

## Implementation Notes

### Session 1

- Batch 1-2 (P1): Navigation bug fixed with directory-aware handleNavigateToRun using setTimeout(0) to work around useDirectoryState auto-clearing sessionId
- Batch 3 (P2+P3+P4): Combined RunHistoryPanel UX changes into single agent to avoid merge conflicts. Backend status filter and conditional polling ran in parallel.
- Batch 4 (P3 UI): Status filter Select dropdown + "Load more" pagination. Used accumulated runs pattern (previousRuns state) instead of useEffect to avoid infinite re-render loops.
- All 69 Pulse tests passing across 9 test files
