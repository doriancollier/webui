---
slug: git-status-bar
---

# Specification: Git Status in Status Bar

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-13
**Ideation:** [specs/git-status-bar/01-ideation.md](./01-ideation.md)

---

## Overview

Add a git status indicator to the existing status bar that displays the current branch name, ahead/behind sync arrows, and total local change count. The feature is toggleable on/off from the Settings dialog's "Status Bar" tab, following the same declarative pattern used by all existing status items (CwdItem, ModelItem, CostItem, ContextItem, PermissionModeItem).

## Background / Problem Statement

Users working in a git repository have no visibility into their git state from the gateway UI. They must switch to a terminal to check their current branch or whether they have uncommitted changes. Since the gateway is a coding assistant interface, git context is highly relevant — knowing the branch name and dirty state helps users understand the context Claude is operating in.

## Goals

- Display current git branch name in the status bar
- Show ahead/behind sync indicators when tracking a remote
- Show total local change count (modified + staged + untracked)
- Show a disabled "No repo" state when not in a git repository
- Provide a tooltip with full branch name and change breakdown on hover
- Allow users to toggle visibility from Settings > Status Bar
- Poll for updates every 10 seconds while the tab is active
- Require zero new npm dependencies (use raw `git` CLI via `child_process`)

## Non-Goals

- Git actions (commit, push, pull, branch switching)
- File-level change details or diff views
- File watcher / chokidar for real-time updates (polling is sufficient for v1)
- Multi-repo or submodule support
- Click behavior on the status item (no-op for v1)
- Merge/rebase in-progress detection

## Technical Dependencies

- `child_process.execFile` (Node.js built-in) — for running `git status`
- `lucide-react` (already installed) — `GitBranch`, `ArrowUp`, `ArrowDown` icons
- `@tanstack/react-query` (already installed) — polling with `refetchInterval`
- `zod` (already installed) — schema validation
- `motion/react` (already installed) — status bar entry/exit animations

No new npm packages required.

## Detailed Design

### 1. Shared Schema (`packages/shared/src/schemas.ts`)

Add a new Zod schema for the git status response:

```typescript
export const GitStatusResponseSchema = z
  .object({
    branch: z.string().describe('Current branch name or HEAD SHA if detached'),
    ahead: z.number().int().describe('Commits ahead of remote tracking branch'),
    behind: z.number().int().describe('Commits behind remote tracking branch'),
    modified: z.number().int().describe('Count of modified files (staged + unstaged)'),
    staged: z.number().int().describe('Count of staged files'),
    untracked: z.number().int().describe('Count of untracked files'),
    conflicted: z.number().int().describe('Count of files with merge conflicts'),
    clean: z.boolean().describe('True if working directory is clean'),
    detached: z.boolean().describe('True if HEAD is detached'),
    tracking: z.string().nullable().describe('Remote tracking branch name'),
  })
  .openapi('GitStatusResponse');

export type GitStatusResponse = z.infer<typeof GitStatusResponseSchema>;

export const GitStatusErrorSchema = z
  .object({
    error: z.literal('not_git_repo'),
  })
  .openapi('GitStatusError');

export type GitStatusError = z.infer<typeof GitStatusErrorSchema>;
```

The endpoint returns either `GitStatusResponse` or `GitStatusError`. The client uses a discriminated union: if the response has an `error` field, it's not a git repo.

### 2. Shared Types (`packages/shared/src/types.ts`)

Re-export the new types:

```typescript
export type { GitStatusResponse, GitStatusError } from './schemas';
```

### 3. Transport Interface (`packages/shared/src/transport.ts`)

Add the new method to the Transport interface:

```typescript
export interface Transport {
  // ... existing methods ...
  getGitStatus(cwd?: string): Promise<GitStatusResponse | GitStatusError>;
}
```

### 4. Server: Git Status Service (`apps/server/src/services/git-status.ts` — NEW)

Create a new service that shells out to git:

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitStatusResponse, GitStatusError } from '@lifeos/shared/types';

const execFileAsync = promisify(execFile);

export async function getGitStatus(cwd: string): Promise<GitStatusResponse | GitStatusError> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain=v1', '--branch'], {
      cwd,
      timeout: 5000,
    });
    return parsePorcelainOutput(stdout);
  } catch {
    return { error: 'not_git_repo' as const };
  }
}
```

**Parsing logic for `--porcelain=v1 --branch` output:**

The first line is the branch header:
```
## main...origin/main [ahead 2, behind 1]
```

Remaining lines are file status entries with 2-char codes:
```
 M file1.txt       (modified, unstaged)
M  file2.txt       (modified, staged)
A  file3.txt       (added, staged)
?? file4.txt       (untracked)
UU file5.txt       (conflicted)
```

The parser:
1. Extracts branch name from `## <branch>` (before `...` if tracking remote)
2. Extracts `tracking` branch (after `...`, before `[`)
3. Extracts `ahead`/`behind` from `[ahead N, behind M]` bracket notation
4. Detects detached HEAD from `## HEAD (no branch)` pattern
5. Counts files by category:
   - `staged`: first char is `M`, `A`, `D`, `R`, or `C`
   - `modified`: second char is `M` or `D`
   - `untracked`: status is `??`
   - `conflicted`: status is `UU`, `AA`, `DD`, `AU`, `UA`, `DU`, or `UD`
6. Deduplicates files that appear in both staged and unstaged (a file can be both `MM`)

### 5. Server: Git Route (`apps/server/src/routes/git.ts` — NEW)

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { getGitStatus } from '../services/git-status';

const router = Router();

const GitStatusQuerySchema = z.object({
  dir: z.string().optional(),
});

router.get('/status', async (req, res) => {
  const parsed = GitStatusQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.format() });
  }
  const cwd = parsed.data.dir || process.cwd();
  const result = await getGitStatus(cwd);
  res.json(result);
});

export default router;
```

### 6. Server: Mount Route (`apps/server/src/app.ts`)

Add to the existing router mounts:

```typescript
import gitRoutes from './routes/git';
// ...
app.use('/api/git', gitRoutes);
```

### 7. HTTP Transport (`apps/client/src/lib/http-transport.ts`)

Add the new method following the existing `cwd` query parameter pattern:

```typescript
async getGitStatus(cwd?: string): Promise<GitStatusResponse | GitStatusError> {
  const params = new URLSearchParams();
  if (cwd) params.set('dir', cwd);
  const qs = params.toString();
  return fetchJSON<GitStatusResponse | GitStatusError>(
    this.baseUrl,
    `/git/status${qs ? `?${qs}` : ''}`
  );
}
```

### 8. Direct Transport (`apps/client/src/lib/direct-transport.ts`)

Add the method with inline implementation (since DirectTransport has access to Node.js):

```typescript
async getGitStatus(cwd?: string): Promise<GitStatusResponse | GitStatusError> {
  const { getGitStatus } = await import('../../server/services/git-status');
  return getGitStatus(cwd || this.cwd);
}
```

Or if the service is already imported at the top, call it directly. Follow whatever pattern DirectTransport uses for its other methods.

### 9. Client: useGitStatus Hook (`apps/client/src/hooks/use-git-status.ts` — NEW)

```typescript
import { useQuery } from '@tanstack/react-query';
import { useTransport } from '../contexts/TransportContext';
import type { GitStatusResponse, GitStatusError } from '@lifeos/shared/types';

export function useGitStatus(cwd: string | null) {
  const transport = useTransport();

  return useQuery({
    queryKey: ['git-status', cwd],
    queryFn: () => transport.getGitStatus(cwd ?? undefined),
    enabled: !!cwd,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });
}

export function isGitStatusOk(
  data: GitStatusResponse | GitStatusError | undefined
): data is GitStatusResponse {
  return !!data && !('error' in data);
}
```

### 10. Client: Zustand Store (`apps/client/src/stores/app-store.ts`)

Add toggle following the exact existing pattern:

```typescript
// In state interface
showStatusBarGit: boolean;
setShowStatusBarGit: (v: boolean) => void;

// In create()
showStatusBarGit: (() => {
  try { return localStorage.getItem('gateway-show-status-bar-git') !== 'false'; }
  catch { return true; }
})(),
setShowStatusBarGit: (v) => {
  try { localStorage.setItem('gateway-show-status-bar-git', String(v)); } catch {}
  set({ showStatusBarGit: v });
},

// In resetPreferences()
localStorage.removeItem('gateway-show-status-bar-git');
// ... and reset state:
showStatusBarGit: true,
```

### 11. Client: GitStatusItem Component (`apps/client/src/components/status/GitStatusItem.tsx` — NEW)

```typescript
import { GitBranch, ArrowUp, ArrowDown } from 'lucide-react';
import type { GitStatusResponse, GitStatusError } from '@lifeos/shared/types';
import { isGitStatusOk } from '../../hooks/use-git-status';

interface GitStatusItemProps {
  data: GitStatusResponse | GitStatusError | undefined;
}

export function GitStatusItem({ data }: GitStatusItemProps) {
  if (!data) return null;

  // Not a git repo — show disabled state
  if (!isGitStatusOk(data)) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground/50" title="Not a git repository">
        <GitBranch className="size-(--size-icon-xs)" />
        <span>No repo</span>
      </span>
    );
  }

  const totalChanges = data.modified + data.staged + data.untracked;
  const changeLabel = totalChanges === 1 ? '1 change' : `${totalChanges} changes`;

  // Build tooltip breakdown
  const parts: string[] = [];
  if (data.modified > 0) parts.push(`${data.modified} modified`);
  if (data.staged > 0) parts.push(`${data.staged} staged`);
  if (data.untracked > 0) parts.push(`${data.untracked} untracked`);
  if (data.conflicted > 0) parts.push(`${data.conflicted} conflicted`);
  const tooltip = parts.length > 0
    ? `${data.branch} · ${parts.join(', ')}`
    : `${data.branch} · clean`;

  return (
    <span className="inline-flex items-center gap-1" title={tooltip}>
      <GitBranch className="size-(--size-icon-xs)" />
      <span className="max-w-[25ch] truncate">{data.branch}</span>

      {data.ahead > 0 && (
        <span className="inline-flex items-center gap-0.5 text-muted-foreground">
          <ArrowUp className="size-(--size-icon-xs)" />
          {data.ahead}
        </span>
      )}
      {data.behind > 0 && (
        <span className="inline-flex items-center gap-0.5 text-muted-foreground">
          <ArrowDown className="size-(--size-icon-xs)" />
          {data.behind}
        </span>
      )}

      {totalChanges > 0 && (
        <span className="text-muted-foreground">· {changeLabel}</span>
      )}
    </span>
  );
}
```

### 12. Client: StatusLine Integration (`apps/client/src/components/status/StatusLine.tsx`)

Add the git status item to the entries array, following the existing conditional pattern:

```typescript
import { GitStatusItem } from './GitStatusItem';
import { useGitStatus } from '../../hooks/use-git-status';

// Inside StatusLine component:
const { showStatusBarGit } = useAppStore();
const { data: gitStatus } = useGitStatus(status.cwd);

// In entries building:
if (showStatusBarGit) {
  entries.push({ key: 'git', node: <GitStatusItem data={gitStatus} /> });
}
```

Place the git entry after CwdItem (since they're both about the working directory context) and before the other items.

### 13. Client: Settings Dialog (`apps/client/src/components/settings/SettingsDialog.tsx`)

Add a new toggle in the Status Bar tab:

```typescript
const { showStatusBarGit, setShowStatusBarGit } = useAppStore();

// In the StatusBar tab content, add:
<SettingRow label="Show git status" description="Display branch name and change count">
  <Switch checked={showStatusBarGit} onCheckedChange={setShowStatusBarGit} />
</SettingRow>
```

Place after the existing "Show working directory" toggle since they're related.

## User Experience

### Display States

| State | Display |
|-------|---------|
| Clean, no remote | `[GitBranch] main` |
| Clean, synced | `[GitBranch] main` |
| Dirty | `[GitBranch] main · 3 changes` |
| Dirty + ahead | `[GitBranch] main ↑2 · 3 changes` |
| Dirty + behind | `[GitBranch] main ↓1 · 3 changes` |
| Dirty + ahead + behind | `[GitBranch] main ↑2 ↓1 · 3 changes` |
| Detached HEAD | `[GitBranch] abc1234 · 3 changes` |
| Not a git repo | `[GitBranch] No repo` (grayed out) |
| Toggle off | Item hidden from status bar |
| Loading (first fetch) | Item not shown until data arrives |

### Tooltip Content

On hover, the native `title` attribute shows:
- Full branch name (useful when truncated)
- Detailed breakdown: `feature/my-long-branch-name · 3 modified, 1 staged, 2 untracked`
- Or `main · clean` if no changes

### Polling Behavior

- Fetches git status every 10 seconds while the browser tab is active
- Pauses polling when the tab is hidden (TanStack Query `refetchIntervalInBackground: false`)
- Data is considered stale after 5 seconds (`staleTime: 5000`)
- Query is disabled when `cwd` is null (no session active)

## Testing Strategy

### Server: git-status service tests (`apps/server/src/services/__tests__/git-status.test.ts`)

```
- parsePorcelainOutput correctly parses clean repo (## main...origin/main)
- parsePorcelainOutput correctly parses dirty repo with mixed status codes
- parsePorcelainOutput extracts ahead/behind from branch line
- parsePorcelainOutput handles detached HEAD (## HEAD (no branch))
- parsePorcelainOutput handles no tracking branch (## main)
- parsePorcelainOutput counts modified, staged, untracked, conflicted correctly
- parsePorcelainOutput deduplicates files staged AND modified (MM)
- getGitStatus returns not_git_repo error when git fails
- getGitStatus returns parsed status for valid repo
```

Mock `child_process.execFile` to return known porcelain output strings.

### Client: GitStatusItem tests (`apps/client/src/components/status/__tests__/GitStatusItem.test.tsx`)

```
- renders branch name for clean repo
- renders change count when dirty
- renders singular "1 change" for single file
- renders ahead indicator with arrow
- renders behind indicator with arrow
- renders both ahead and behind
- renders "No repo" in disabled state for error response
- does not render when data is undefined
- truncates long branch names (via CSS class check)
- sets title attribute with tooltip breakdown
```

### Client: Settings toggle test (extend `SettingsDialog.test.tsx`)

```
- shows "Show git status" toggle in Status Bar tab
- git status toggle defaults to checked
```

### Client: useGitStatus hook tests (`apps/client/src/hooks/__tests__/use-git-status.test.tsx`)

```
- calls transport.getGitStatus with cwd
- does not fetch when cwd is null
- isGitStatusOk returns true for valid status
- isGitStatusOk returns false for error response
```

## Performance Considerations

- **Polling interval**: 10 seconds balances freshness with server load. `git status` typically completes in 50-200ms for medium repos.
- **execFile timeout**: 5-second timeout prevents hanging on enormous repos.
- **staleTime**: 5-second stale time prevents redundant fetches when components re-render.
- **Background pause**: Polling stops entirely when the tab is hidden, saving resources.
- **No file watching**: Deliberate choice to avoid complexity and memory overhead of chokidar. Polling is sufficient for status bar display.

## Security Considerations

- **Command injection**: Using `execFile` (not `exec`) prevents shell injection. Arguments are passed as an array, never interpolated into a string.
- **Path traversal**: The `dir` query parameter is passed directly to `execFile` as `cwd`. Git itself validates the directory. Additional validation could restrict `dir` to within the workspace root, but this matches the existing pattern used by other endpoints (sessions, commands) that also accept `cwd`/`dir`.
- **Information disclosure**: Only returns aggregate counts, not file names. File paths are not exposed through the API.

## Implementation Phases

### Phase 1: Core (MVP)

All items in this spec constitute Phase 1:
1. Shared schema + types + transport interface
2. Server service (git porcelain parser) + route + mount
3. Client hook (useGitStatus with polling)
4. Client component (GitStatusItem)
5. Zustand store toggle + Settings dialog switch
6. StatusLine integration
7. Tests for all layers

### Phase 2: Future Enhancements (Deferred)

- Click to copy branch name
- File watcher for instant updates (chokidar on `.git/index`)
- Merge/rebase in-progress indicator
- Multi-repo workspace support
- Branch switcher dropdown

## Open Questions

None — all clarifications were resolved during ideation-to-spec.

## References

- Ideation: [specs/git-status-bar/01-ideation.md](./01-ideation.md)
- Existing status items: `apps/client/src/components/status/`
- Transport interface: `packages/shared/src/transport.ts`
- Git porcelain format: https://git-scm.com/docs/git-status#_short_format
