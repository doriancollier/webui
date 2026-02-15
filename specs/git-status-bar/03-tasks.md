---
slug: git-status-bar
---

# Tasks: Git Status in Status Bar

**Generated:** 2026-02-13
**Spec:** [specs/git-status-bar/02-specification.md](./02-specification.md)

---

## Phase 1: Shared Foundation

### Task 1.1: Add GitStatus schemas and types to shared package

**Status:** Not Started
**Files:**

- `packages/shared/src/schemas.ts` (MODIFY)
- `packages/shared/src/types.ts` (MODIFY)

**Description:**

Add a new Zod schema for the git status response to `packages/shared/src/schemas.ts`:

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

Re-export the new types in `packages/shared/src/types.ts`:

```typescript
export type { GitStatusResponse, GitStatusError } from './schemas';
```

Add these to the existing export block alongside the other type re-exports.

**Acceptance Criteria:**

- `GitStatusResponseSchema` and `GitStatusErrorSchema` are exported from `schemas.ts`
- `GitStatusResponse` and `GitStatusError` types are exported from `types.ts`
- Schemas include `.openapi()` metadata
- All fields have `.describe()` annotations

---

### Task 1.2: Add getGitStatus to Transport interface

**Status:** Not Started
**Blocked by:** Task 1.1
**Files:**

- `packages/shared/src/transport.ts` (MODIFY)

**Description:**

Add the new method to the Transport interface in `packages/shared/src/transport.ts`:

```typescript
export interface Transport {
  // ... existing methods ...
  getGitStatus(cwd?: string): Promise<GitStatusResponse | GitStatusError>;
}
```

Add the import for `GitStatusResponse` and `GitStatusError` to the existing import block at the top of the file:

```typescript
import type {
  // ... existing imports ...
  GitStatusResponse,
  GitStatusError,
} from './types.js';
```

**Acceptance Criteria:**

- `getGitStatus` method is declared on the `Transport` interface
- Method signature accepts optional `cwd` string parameter
- Return type is `Promise<GitStatusResponse | GitStatusError>`
- Types are properly imported

---

## Phase 2: Server

### Task 2.1: Create git-status service with porcelain parser

**Status:** Not Started
**Blocked by:** Task 1.1
**Files:**

- `apps/server/src/services/git-status.ts` (NEW)

**Description:**

Create a new service at `apps/server/src/services/git-status.ts` that shells out to git:

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitStatusResponse, GitStatusError } from '@dorkos/shared/types';

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

The `parsePorcelainOutput` function must:

1. Extract branch name from `## <branch>` (before `...` if tracking remote)
2. Extract `tracking` branch (after `...`, before `[`)
3. Extract `ahead`/`behind` from `[ahead N, behind M]` bracket notation
4. Detect detached HEAD from `## HEAD (no branch)` pattern
5. Count files by category:
   - `staged`: first char is `M`, `A`, `D`, `R`, or `C`
   - `modified`: second char is `M` or `D`
   - `untracked`: status is `??`
   - `conflicted`: status is `UU`, `AA`, `DD`, `AU`, `UA`, `DU`, or `UD`
6. Deduplicates files that appear in both staged and unstaged (a file can be both `MM`)

Export `parsePorcelainOutput` so it can be tested directly.

**Acceptance Criteria:**

- `getGitStatus(cwd)` calls `git status --porcelain=v1 --branch` with 5-second timeout
- Returns `{ error: 'not_git_repo' }` when git command fails
- `parsePorcelainOutput` correctly extracts branch, tracking, ahead, behind
- Detects detached HEAD
- Counts modified, staged, untracked, conflicted files correctly
- Sets `clean: true` when no changes
- Uses `execFile` (not `exec`) to prevent shell injection

---

### Task 2.2: Create git route and mount in app

**Status:** Not Started
**Blocked by:** Task 2.1
**Files:**

- `apps/server/src/routes/git.ts` (NEW)
- `apps/server/src/app.ts` (MODIFY)

**Description:**

Create a new route file at `apps/server/src/routes/git.ts`:

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

Mount the route in `apps/server/src/app.ts`:

```typescript
import gitRoutes from './routes/git';
// ...
app.use('/api/git', gitRoutes);
```

Add this alongside the existing route mounts (sessions, commands, health, files).

**Acceptance Criteria:**

- GET `/api/git/status` returns git status JSON
- Accepts optional `?dir=` query parameter
- Defaults to `process.cwd()` when no `dir` provided
- Returns 400 with Zod error details for invalid query
- Route is mounted at `/api/git` in app.ts

---

## Phase 3: Client Infrastructure

### Task 3.1: Add git status toggle to Zustand store

**Status:** Not Started
**Blocked by:** Task 1.1
**Files:**

- `apps/client/src/stores/app-store.ts` (MODIFY)

**Description:**

Add the toggle to the Zustand store following the exact existing pattern used by other status bar toggles.

In the state interface, add:

```typescript
showStatusBarGit: boolean;
setShowStatusBarGit: (v: boolean) => void;
```

In the `create()` call, add:

```typescript
showStatusBarGit: (() => {
  try { return localStorage.getItem('gateway-show-status-bar-git') !== 'false'; }
  catch { return true; }
})(),
setShowStatusBarGit: (v) => {
  try { localStorage.setItem('gateway-show-status-bar-git', String(v)); } catch {}
  set({ showStatusBarGit: v });
},
```

In the `resetPreferences()` function, add:

```typescript
localStorage.removeItem('gateway-show-status-bar-git');
// ... and in the state reset object:
showStatusBarGit: true,
```

**Acceptance Criteria:**

- `showStatusBarGit` defaults to `true`
- Value is persisted to `localStorage` with key `gateway-show-status-bar-git`
- `setShowStatusBarGit` updates both store and localStorage
- `resetPreferences()` removes the localStorage key and resets to `true`
- Pattern matches existing status bar toggles exactly

---

### Task 3.2: Create useGitStatus hook

**Status:** Not Started
**Blocked by:** Task 1.2
**Files:**

- `apps/client/src/hooks/use-git-status.ts` (NEW)

**Description:**

Create a new hook at `apps/client/src/hooks/use-git-status.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { useTransport } from '../contexts/TransportContext';
import type { GitStatusResponse, GitStatusError } from '@dorkos/shared/types';

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

**Acceptance Criteria:**

- `useGitStatus` polls every 10 seconds with `refetchInterval: 10_000`
- Polling pauses when tab is hidden (`refetchIntervalInBackground: false`)
- Data is stale after 5 seconds (`staleTime: 5_000`)
- Query is disabled when `cwd` is `null`
- `isGitStatusOk` type guard distinguishes `GitStatusResponse` from `GitStatusError`
- Uses `useTransport()` to get the transport instance

---

### Task 3.3: Add getGitStatus to HTTP and Direct transports

**Status:** Not Started
**Blocked by:** Task 1.2
**Files:**

- `apps/client/src/lib/http-transport.ts` (MODIFY)
- `apps/client/src/lib/direct-transport.ts` (MODIFY)

**Description:**

Add the `getGitStatus` method to `apps/client/src/lib/http-transport.ts` following the existing `cwd` query parameter pattern:

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

Add the `getGitStatus` method to `apps/client/src/lib/direct-transport.ts`:

```typescript
async getGitStatus(cwd?: string): Promise<GitStatusResponse | GitStatusError> {
  const { getGitStatus } = await import('../../server/services/git-status');
  return getGitStatus(cwd || this.cwd);
}
```

Follow whatever pattern DirectTransport uses for its other methods (it may use dynamic imports or top-level imports).

Import `GitStatusResponse` and `GitStatusError` types in both files.

**Acceptance Criteria:**

- `HttpTransport.getGitStatus()` calls `GET /api/git/status` with optional `?dir=` param
- `DirectTransport.getGitStatus()` calls the service directly, falling back to `this.cwd`
- Both return `Promise<GitStatusResponse | GitStatusError>`
- Pattern matches existing transport methods

---

## Phase 4: Client UI

### Task 4.1: Create GitStatusItem component

**Status:** Not Started
**Blocked by:** Task 3.2
**Files:**

- `apps/client/src/components/status/GitStatusItem.tsx` (NEW)

**Description:**

Create a new component at `apps/client/src/components/status/GitStatusItem.tsx`:

```typescript
import { GitBranch, ArrowUp, ArrowDown } from 'lucide-react';
import type { GitStatusResponse, GitStatusError } from '@dorkos/shared/types';
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

**Display States:**

| State                  | Display                              |
| ---------------------- | ------------------------------------ |
| Clean, no remote       | `[GitBranch] main`                   |
| Clean, synced          | `[GitBranch] main`                   |
| Dirty                  | `[GitBranch] main · 3 changes`       |
| Dirty + ahead          | `[GitBranch] main ↑2 · 3 changes`    |
| Dirty + behind         | `[GitBranch] main ↓1 · 3 changes`    |
| Dirty + ahead + behind | `[GitBranch] main ↑2 ↓1 · 3 changes` |
| Detached HEAD          | `[GitBranch] abc1234 · 3 changes`    |
| Not a git repo         | `[GitBranch] No repo` (grayed out)   |
| Loading (first fetch)  | Item not shown until data arrives    |

**Acceptance Criteria:**

- Shows branch name with GitBranch icon
- Shows ahead/behind arrows when non-zero
- Shows total change count when dirty
- Shows "1 change" (singular) for single file
- Shows "No repo" in grayed-out state for error response
- Returns null when data is undefined
- Truncates long branch names with `max-w-[25ch] truncate`
- Sets `title` attribute with tooltip breakdown (branch + change details or "clean")

---

### Task 4.2: Integrate GitStatusItem into StatusLine

**Status:** Not Started
**Blocked by:** Task 4.1, Task 3.1
**Files:**

- `apps/client/src/components/status/StatusLine.tsx` (MODIFY)

**Description:**

Add the git status item to the StatusLine component. Import the component and hook:

```typescript
import { GitStatusItem } from './GitStatusItem';
import { useGitStatus } from '../../hooks/use-git-status';
```

Inside the StatusLine component, add:

```typescript
const { showStatusBarGit } = useAppStore();
const { data: gitStatus } = useGitStatus(status.cwd);
```

In the entries array building section, add (after CwdItem since they are both about working directory context, before other items):

```typescript
if (showStatusBarGit) {
  entries.push({ key: 'git', node: <GitStatusItem data={gitStatus} /> });
}
```

**Acceptance Criteria:**

- Git status item appears in the status bar when `showStatusBarGit` is true
- Item is positioned after CwdItem and before other items
- Uses `useGitStatus(status.cwd)` to get data
- Respects the `showStatusBarGit` store toggle
- Follows the existing entry pattern used by other status items

---

### Task 4.3: Add git status toggle to Settings dialog

**Status:** Not Started
**Blocked by:** Task 3.1
**Files:**

- `apps/client/src/components/settings/SettingsDialog.tsx` (MODIFY)

**Description:**

Add a new toggle in the Status Bar tab of the Settings dialog.

Get the store values:

```typescript
const { showStatusBarGit, setShowStatusBarGit } = useAppStore();
```

Add a new toggle row in the Status Bar tab content, placed after the existing "Show working directory" toggle since they're related:

```typescript
<SettingRow label="Show git status" description="Display branch name and change count">
  <Switch checked={showStatusBarGit} onCheckedChange={setShowStatusBarGit} />
</SettingRow>
```

**Acceptance Criteria:**

- "Show git status" toggle appears in the Status Bar tab
- Toggle label is "Show git status"
- Toggle description is "Display branch name and change count"
- Toggle is checked by default (matches store default of `true`)
- Toggling updates the `showStatusBarGit` store value
- Positioned after the "Show working directory" toggle

---

## Phase 5: Tests

### Task 5.1: Write git-status service tests

**Status:** Not Started
**Blocked by:** Task 2.1
**Files:**

- `apps/server/src/services/__tests__/git-status.test.ts` (NEW)

**Description:**

Create tests at `apps/server/src/services/__tests__/git-status.test.ts`. Mock `child_process.execFile` to return known porcelain output strings.

Test cases:

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

Example test patterns:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { getGitStatus, parsePorcelainOutput } from '../git-status';

describe('parsePorcelainOutput', () => {
  it('correctly parses clean repo', () => {
    const output = '## main...origin/main\n';
    const result = parsePorcelainOutput(output);
    expect(result).toEqual({
      branch: 'main',
      ahead: 0,
      behind: 0,
      modified: 0,
      staged: 0,
      untracked: 0,
      conflicted: 0,
      clean: true,
      detached: false,
      tracking: 'origin/main',
    });
  });

  it('extracts ahead/behind from branch line', () => {
    const output = '## main...origin/main [ahead 2, behind 1]\n';
    const result = parsePorcelainOutput(output);
    expect(result.ahead).toBe(2);
    expect(result.behind).toBe(1);
  });

  it('handles detached HEAD', () => {
    const output = '## HEAD (no branch)\n M file.txt\n';
    const result = parsePorcelainOutput(output);
    expect(result.detached).toBe(true);
  });

  it('handles no tracking branch', () => {
    const output = '## main\n';
    const result = parsePorcelainOutput(output);
    expect(result.branch).toBe('main');
    expect(result.tracking).toBeNull();
  });

  it('counts modified, staged, untracked, conflicted correctly', () => {
    const output = [
      '## main...origin/main',
      ' M file1.txt',
      'M  file2.txt',
      'A  file3.txt',
      '?? file4.txt',
      'UU file5.txt',
      '',
    ].join('\n');
    const result = parsePorcelainOutput(output);
    expect(result.modified).toBe(1);
    expect(result.staged).toBe(2); // M + A
    expect(result.untracked).toBe(1);
    expect(result.conflicted).toBe(1);
    expect(result.clean).toBe(false);
  });

  it('deduplicates files staged AND modified (MM)', () => {
    const output = '## main\nMM file.txt\n';
    const result = parsePorcelainOutput(output);
    expect(result.staged).toBe(1);
    expect(result.modified).toBe(1);
  });
});

describe('getGitStatus', () => {
  it('returns not_git_repo error when git fails', async () => {
    // Mock execFile to reject
    const result = await getGitStatus('/nonexistent');
    expect(result).toEqual({ error: 'not_git_repo' });
  });
});
```

**Acceptance Criteria:**

- All 9 test cases pass
- `parsePorcelainOutput` is tested independently from `getGitStatus`
- `child_process.execFile` is mocked (not calling real git)
- Tests verify branch parsing, ahead/behind, detached HEAD, no tracking, file counts, deduplication, and error handling

---

### Task 5.2: Write GitStatusItem component tests

**Status:** Not Started
**Blocked by:** Task 4.1
**Files:**

- `apps/client/src/components/status/__tests__/GitStatusItem.test.tsx` (NEW)

**Description:**

Create tests at `apps/client/src/components/status/__tests__/GitStatusItem.test.tsx`.

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GitStatusItem } from '../GitStatusItem';
import type { GitStatusResponse, GitStatusError } from '@dorkos/shared/types';
```

Test cases:

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

Example test data:

```typescript
const cleanStatus: GitStatusResponse = {
  branch: 'main',
  ahead: 0,
  behind: 0,
  modified: 0,
  staged: 0,
  untracked: 0,
  conflicted: 0,
  clean: true,
  detached: false,
  tracking: 'origin/main',
};

const dirtyStatus: GitStatusResponse = {
  branch: 'feature/my-branch',
  ahead: 2,
  behind: 1,
  modified: 3,
  staged: 1,
  untracked: 2,
  conflicted: 0,
  clean: false,
  detached: false,
  tracking: 'origin/feature/my-branch',
};

const errorStatus: GitStatusError = { error: 'not_git_repo' };
```

Example tests:

```typescript
it('renders branch name for clean repo', () => {
  render(<GitStatusItem data={cleanStatus} />);
  expect(screen.getByText('main')).toBeInTheDocument();
});

it('renders change count when dirty', () => {
  render(<GitStatusItem data={dirtyStatus} />);
  expect(screen.getByText(/6 changes/)).toBeInTheDocument();
});

it('renders singular "1 change" for single file', () => {
  render(<GitStatusItem data={{ ...cleanStatus, modified: 1, clean: false }} />);
  expect(screen.getByText(/1 change$/)).toBeInTheDocument();
});

it('renders "No repo" in disabled state for error response', () => {
  render(<GitStatusItem data={errorStatus} />);
  expect(screen.getByText('No repo')).toBeInTheDocument();
});

it('does not render when data is undefined', () => {
  const { container } = render(<GitStatusItem data={undefined} />);
  expect(container.firstChild).toBeNull();
});

it('sets title attribute with tooltip breakdown', () => {
  render(<GitStatusItem data={dirtyStatus} />);
  const el = screen.getByTitle(/feature\/my-branch/);
  expect(el.title).toContain('3 modified');
  expect(el.title).toContain('1 staged');
  expect(el.title).toContain('2 untracked');
});
```

**Acceptance Criteria:**

- All 10 test cases pass
- Tests use `@testing-library/react` with jsdom environment
- Tests cover all display states: clean, dirty, singular change, ahead, behind, both, error, undefined, truncation, tooltip

---

### Task 5.3: Extend SettingsDialog tests for git toggle

**Status:** Not Started
**Blocked by:** Task 4.3
**Files:**

- `apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx` (MODIFY)

**Description:**

Add test cases to the existing `SettingsDialog.test.tsx`:

```
- shows "Show git status" toggle in Status Bar tab
- git status toggle defaults to checked
```

Navigate to the Status Bar tab and verify the toggle is present and defaults to checked. Follow the existing test patterns in the file for navigating tabs and checking toggle state.

**Acceptance Criteria:**

- "Show git status" toggle is visible in Status Bar tab
- Toggle defaults to checked state
- Tests follow existing SettingsDialog test patterns

---

### Task 5.4: Write useGitStatus hook tests

**Status:** Not Started
**Blocked by:** Task 3.2
**Files:**

- `apps/client/src/hooks/__tests__/use-git-status.test.tsx` (NEW)

**Description:**

Create tests at `apps/client/src/hooks/__tests__/use-git-status.test.tsx`:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { isGitStatusOk } from '../use-git-status';
import type { GitStatusResponse, GitStatusError } from '@dorkos/shared/types';
```

Test cases:

```
- calls transport.getGitStatus with cwd
- does not fetch when cwd is null
- isGitStatusOk returns true for valid status
- isGitStatusOk returns false for error response
```

For hook tests, use the same TransportProvider wrapper pattern used by other hook tests in the codebase (check `apps/client/src/hooks/__tests__/` for examples). Create a mock transport with `getGitStatus` returning test data.

```typescript
describe('isGitStatusOk', () => {
  it('returns true for valid status', () => {
    const status: GitStatusResponse = {
      branch: 'main',
      ahead: 0,
      behind: 0,
      modified: 0,
      staged: 0,
      untracked: 0,
      conflicted: 0,
      clean: true,
      detached: false,
      tracking: null,
    };
    expect(isGitStatusOk(status)).toBe(true);
  });

  it('returns false for error response', () => {
    const error: GitStatusError = { error: 'not_git_repo' };
    expect(isGitStatusOk(error)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isGitStatusOk(undefined)).toBe(false);
  });
});
```

**Acceptance Criteria:**

- All 4 test cases pass
- Hook tests use TransportProvider wrapper with mock transport
- `isGitStatusOk` type guard is tested for valid, error, and undefined inputs

---

## Dependency Graph

```
Task 1.1 (schemas/types)
  ├── Task 1.2 (transport interface) ──→ Task 3.2 (hook) ──→ Task 4.1 (component) ──→ Task 4.2 (StatusLine)
  │                                  └── Task 3.3 (transports)                         Task 5.2 (component tests)
  │                                  └── Task 5.4 (hook tests)
  ├── Task 2.1 (service) ──→ Task 2.2 (route + mount)
  │                      └── Task 5.1 (service tests)
  └── Task 3.1 (store toggle) ──→ Task 4.2 (StatusLine)
                              └── Task 4.3 (settings) ──→ Task 5.3 (settings tests)
```

## Summary

| Phase                     | Tasks              | Description                                                      |
| ------------------------- | ------------------ | ---------------------------------------------------------------- |
| P1: Shared Foundation     | 1.1, 1.2           | Schemas, types, transport interface                              |
| P2: Server                | 2.1, 2.2           | Git status service, route, mount                                 |
| P3: Client Infrastructure | 3.1, 3.2, 3.3      | Store toggle, hook, transport adapters                           |
| P4: Client UI             | 4.1, 4.2, 4.3      | GitStatusItem component, StatusLine integration, Settings toggle |
| P5: Tests                 | 5.1, 5.2, 5.3, 5.4 | Service tests, component tests, settings tests, hook tests       |

**Total tasks:** 13

**Parallel execution opportunities:**

- After Task 1.1: Tasks 1.2, 2.1, and 3.1 can run in parallel
- After Task 1.2: Tasks 3.2, 3.3, and 5.4 can run in parallel
- After Task 2.1: Tasks 2.2 and 5.1 can run in parallel
- After Task 4.1: Tasks 4.2 and 5.2 can run in parallel
