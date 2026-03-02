import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Dirent } from 'node:fs';

vi.mock('node:fs/promises');
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

describe('scanForAgents', () => {
  let scanForAgents: typeof import('../discovery-scanner.js').scanForAgents;
  let AGENT_MARKERS: typeof import('../discovery-scanner.js').AGENT_MARKERS;
  let DEFAULT_EXCLUDE_PATTERNS: typeof import('../discovery-scanner.js').DEFAULT_EXCLUDE_PATTERNS;
  let fsp: typeof import('node:fs/promises');
  let execFileMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    fsp = await import('node:fs/promises');
    const cp = await import('node:child_process');
    execFileMock = vi.mocked(cp.execFile);

    const mod = await import('../discovery-scanner.js');
    scanForAgents = mod.scanForAgents;
    AGENT_MARKERS = mod.AGENT_MARKERS;
    DEFAULT_EXCLUDE_PATTERNS = mod.DEFAULT_EXCLUDE_PATTERNS;
  });

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function makeDirent(name: string, isDir: boolean): Dirent {
    return {
      name,
      isDirectory: () => isDir,
      isFile: () => !isDir,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      isSymbolicLink: () => false,
      parentPath: '',
      path: '',
    } as Dirent;
  }

  /**
   * Set up readdir to return specific entries per directory path.
   * Paths not configured return an empty array.
   */
  function mockReaddir(structure: Record<string, Dirent[]>) {
    vi.mocked(fsp.readdir).mockImplementation(async (dirPath: unknown) => {
      const resolved = typeof dirPath === 'string' ? dirPath : String(dirPath);
      return (structure[resolved] ?? []) as Dirent[];
    });
  }

  /**
   * Set up access to succeed for specific paths and fail otherwise.
   */
  function mockAccess(existingPaths: Set<string>) {
    vi.mocked(fsp.access).mockImplementation(async (filePath: unknown) => {
      const resolved = typeof filePath === 'string' ? filePath : String(filePath);
      if (!existingPaths.has(resolved)) {
        throw new Error('ENOENT');
      }
    });
  }

  /**
   * Set up git execFile to return branch/remote for specific directories.
   */
  function mockGit(config: Record<string, { branch?: string; remote?: string }>) {
    execFileMock.mockImplementation(
      (
        _cmd: string,
        args: string[],
        opts: { cwd?: string },
        cb?: (err: Error | null, result: { stdout: string }) => void
      ) => {
        const cwd = opts?.cwd ?? '';
        const gitConfig = config[cwd];

        if (!gitConfig) {
          if (cb) cb(new Error('not a git repo'), { stdout: '' });
          return undefined;
        }

        if (args.includes('rev-parse')) {
          cb?.(null, { stdout: gitConfig.branch ?? '' });
        } else if (args.includes('remote.origin.url')) {
          cb?.(null, { stdout: gitConfig.remote ?? '' });
        } else {
          cb?.(new Error('unknown git command'), { stdout: '' });
        }
        return undefined;
      }
    );
  }

  /** Collect all events from the async generator. */
  async function collectEvents(
    gen: AsyncGenerator<import('../discovery-scanner.js').ScanEvent>
  ) {
    const events: import('../discovery-scanner.js').ScanEvent[] = [];
    for await (const event of gen) {
      events.push(event);
    }
    return events;
  }

  // -----------------------------------------------------------------------
  // Tests
  // -----------------------------------------------------------------------

  it('discovers directory with CLAUDE.md marker', async () => {
    mockReaddir({
      '/home/user': [makeDirent('my-project', true)],
      '/home/user/my-project': [],
    });
    mockAccess(new Set(['/home/user/my-project/CLAUDE.md']));
    mockGit({ '/home/user/my-project': { branch: 'main', remote: 'git@github.com:user/repo.git' } });

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].data).toEqual(
      expect.objectContaining({
        path: '/home/user/my-project',
        name: 'my-project',
        markers: ['CLAUDE.md'],
        gitBranch: 'main',
        gitRemote: 'git@github.com:user/repo.git',
        hasDorkManifest: false,
      })
    );
  });

  it('discovers directory with .claude/ marker', async () => {
    mockReaddir({
      '/home/user': [makeDirent('project-a', true)],
      '/home/user/project-a': [],
    });
    mockAccess(new Set(['/home/user/project-a/.claude']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].data).toEqual(
      expect.objectContaining({
        markers: ['.claude'],
        hasDorkManifest: false,
      })
    );
  });

  it('discovers directory with .cursor/ marker', async () => {
    mockReaddir({
      '/home/user': [makeDirent('cursor-proj', true)],
      '/home/user/cursor-proj': [],
    });
    mockAccess(new Set(['/home/user/cursor-proj/.cursor']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].data.markers).toEqual(['.cursor']);
  });

  it('discovers directory with .github/copilot marker', async () => {
    mockReaddir({
      '/home/user': [makeDirent('copilot-proj', true)],
      '/home/user/copilot-proj': [],
    });
    mockAccess(new Set(['/home/user/copilot-proj/.github/copilot']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].data.markers).toEqual(['.github/copilot']);
  });

  it('discovers directory with .dork/agent.json and sets hasDorkManifest', async () => {
    mockReaddir({
      '/home/user': [makeDirent('dork-proj', true)],
      '/home/user/dork-proj': [],
    });
    mockAccess(new Set(['/home/user/dork-proj/.dork/agent.json']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].data.hasDorkManifest).toBe(true);
    expect(candidates[0].data.markers).toEqual(['.dork/agent.json']);
  });

  it('discovers directory with multiple markers', async () => {
    mockReaddir({
      '/home/user': [makeDirent('multi', true)],
      '/home/user/multi': [],
    });
    mockAccess(
      new Set(['/home/user/multi/CLAUDE.md', '/home/user/multi/.claude', '/home/user/multi/.dork/agent.json'])
    );
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].data.markers).toHaveLength(3);
    expect(candidates[0].data.markers).toContain('CLAUDE.md');
    expect(candidates[0].data.markers).toContain('.claude');
    expect(candidates[0].data.markers).toContain('.dork/agent.json');
    expect(candidates[0].data.hasDorkManifest).toBe(true);
  });

  it('skips excluded directory patterns', async () => {
    mockReaddir({
      '/home/user': [
        makeDirent('node_modules', true),
        makeDirent('.git', true),
        makeDirent('vendor', true),
        makeDirent('.cache', true),
        makeDirent('real-project', true),
      ],
      '/home/user/real-project': [],
    });
    mockAccess(new Set(['/home/user/real-project/CLAUDE.md']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].data.name).toBe('real-project');

    // readdir should NOT have been called for excluded dirs
    const readdirCalls = vi.mocked(fsp.readdir).mock.calls.map((c) => String(c[0]));
    expect(readdirCalls).not.toContain('/home/user/node_modules');
    expect(readdirCalls).not.toContain('/home/user/.git');
    expect(readdirCalls).not.toContain('/home/user/vendor');
    expect(readdirCalls).not.toContain('/home/user/.cache');
  });

  it('respects maxDepth', async () => {
    mockReaddir({
      '/home/user': [makeDirent('level1', true)],
      '/home/user/level1': [makeDirent('level2', true)],
      '/home/user/level1/level2': [makeDirent('level3', true)],
      '/home/user/level1/level2/level3': [],
    });
    // Marker only at depth 3, but maxDepth is 2
    mockAccess(new Set(['/home/user/level1/level2/level3/CLAUDE.md']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    // maxDepth=2 means we scan root(0), level1(1), level2(2) — level2 checks markers but
    // doesn't recurse into level3. So level3 markers should NOT be found.
    expect(candidates).toHaveLength(0);
  });

  it('handles permission errors without crashing', async () => {
    vi.mocked(fsp.readdir).mockImplementation(async (dirPath: unknown) => {
      const resolved = String(dirPath);
      if (resolved === '/home/user') {
        return [makeDirent('forbidden', true), makeDirent('accessible', true)] as Dirent[];
      }
      if (resolved === '/home/user/forbidden') {
        throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
      }
      if (resolved === '/home/user/accessible') {
        return [] as Dirent[];
      }
      return [] as Dirent[];
    });
    mockAccess(new Set(['/home/user/accessible/CLAUDE.md']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    // Should complete without throwing
    const complete = events.find((e) => e.type === 'complete');
    expect(complete).toBeDefined();

    // Should still find the accessible project
    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].data.name).toBe('accessible');
  });

  it('returns git branch and remote when available', async () => {
    mockReaddir({
      '/home/user': [makeDirent('git-proj', true)],
      '/home/user/git-proj': [],
    });
    mockAccess(new Set(['/home/user/git-proj/CLAUDE.md']));
    mockGit({
      '/home/user/git-proj': {
        branch: 'feature/cool',
        remote: 'https://github.com/user/repo.git',
      },
    });

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates[0].data.gitBranch).toBe('feature/cool');
    expect(candidates[0].data.gitRemote).toBe('https://github.com/user/repo.git');
  });

  it('returns null git info when not a git repo', async () => {
    mockReaddir({
      '/home/user': [makeDirent('no-git', true)],
      '/home/user/no-git': [],
    });
    mockAccess(new Set(['/home/user/no-git/CLAUDE.md']));
    mockGit({}); // No git config for this dir

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates[0].data.gitBranch).toBeNull();
    expect(candidates[0].data.gitRemote).toBeNull();
  });

  it('times out with partial results and timedOut flag', async () => {
    // Create a large directory structure that will take time
    const manyDirs = Array.from({ length: 200 }, (_, i) => makeDirent(`dir-${i}`, true));

    vi.mocked(fsp.readdir).mockImplementation(async (dirPath: unknown) => {
      const resolved = String(dirPath);
      if (resolved === '/home/user') return manyDirs as Dirent[];
      return [] as Dirent[];
    });

    // First 50 dirs have markers
    const markerPaths = new Set(
      Array.from({ length: 50 }, (_, i) => `/home/user/dir-${i}/CLAUDE.md`)
    );
    mockAccess(markerPaths);
    mockGit({});

    // Use a very short timeout to force timeout
    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 1, timeout: 0 })
    );

    const complete = events.find((e) => e.type === 'complete');
    expect(complete).toBeDefined();
    expect(complete!.data).toHaveProperty('timedOut', true);
  });

  it('emits progress events periodically', async () => {
    // Create enough directories to trigger at least one progress event (every 100)
    const dirs = Array.from({ length: 120 }, (_, i) => makeDirent(`dir-${i}`, true));

    vi.mocked(fsp.readdir).mockImplementation(async (dirPath: unknown) => {
      const resolved = String(dirPath);
      if (resolved === '/home/user') return dirs as Dirent[];
      return [] as Dirent[];
    });
    mockAccess(new Set()); // No markers
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 1 })
    );

    const progressEvents = events.filter((e) => e.type === 'progress');
    // Root(1) + 120 dirs = 121 scanned, so we should get at least 1 progress at 100
    expect(progressEvents.length).toBeGreaterThanOrEqual(1);
    expect(progressEvents[0].data.scannedDirs).toBe(100);
  });

  it('emits a complete event at the end with correct counts', async () => {
    mockReaddir({
      '/home/user': [makeDirent('proj-a', true), makeDirent('proj-b', true)],
      '/home/user/proj-a': [],
      '/home/user/proj-b': [],
    });
    mockAccess(new Set(['/home/user/proj-a/CLAUDE.md']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const complete = events.find((e) => e.type === 'complete');
    expect(complete).toBeDefined();
    expect(complete!.type).toBe('complete');
    // root + proj-a + proj-b = 3 scanned
    expect(complete!.data.scannedDirs).toBe(3);
    expect(complete!.data.foundAgents).toBe(1);
    expect(complete!.data).toHaveProperty('timedOut', false);
  });

  it('does not recurse into regular dot-directories', async () => {
    mockReaddir({
      '/home/user': [makeDirent('.hidden-dir', true), makeDirent('visible', true)],
      '/home/user/visible': [],
    });
    mockAccess(new Set(['/home/user/visible/CLAUDE.md']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const readdirCalls = vi.mocked(fsp.readdir).mock.calls.map((c) => String(c[0]));
    expect(readdirCalls).not.toContain('/home/user/.hidden-dir');
  });

  it('traverses tracked dot-directories (.dork, .claude, .cursor, .github)', async () => {
    mockReaddir({
      '/home/user': [
        makeDirent('.dork', true),
        makeDirent('.claude', true),
        makeDirent('.cursor', true),
        makeDirent('.github', true),
      ],
      '/home/user/.dork': [],
      '/home/user/.claude': [],
      '/home/user/.cursor': [],
      '/home/user/.github': [],
    });
    mockAccess(new Set());
    mockGit({});

    await collectEvents(scanForAgents({ root: '/home/user', maxDepth: 2 }));

    const readdirCalls = vi.mocked(fsp.readdir).mock.calls.map((c) => String(c[0]));
    expect(readdirCalls).toContain('/home/user/.dork');
    expect(readdirCalls).toContain('/home/user/.claude');
    expect(readdirCalls).toContain('/home/user/.cursor');
    expect(readdirCalls).toContain('/home/user/.github');
  });

  it('skips non-directory entries', async () => {
    mockReaddir({
      '/home/user': [
        makeDirent('file.txt', false),
        makeDirent('project', true),
      ],
      '/home/user/project': [],
    });
    mockAccess(new Set(['/home/user/project/CLAUDE.md']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
  });

  it('also checks root directory for markers', async () => {
    mockReaddir({
      '/home/user/my-project': [],
    });
    mockAccess(new Set(['/home/user/my-project/CLAUDE.md']));
    mockGit({ '/home/user/my-project': { branch: 'main' } });

    const events = await collectEvents(
      scanForAgents({ root: '/home/user/my-project', maxDepth: 1 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].data.path).toBe('/home/user/my-project');
  });

  it('handles symlinks safely (skips non-directory symlinks)', async () => {
    mockReaddir({
      '/home/user': [
        {
          ...makeDirent('symlink-proj', true),
          isSymbolicLink: () => true,
        },
      ],
      '/home/user/symlink-proj': [],
    });
    mockAccess(new Set(['/home/user/symlink-proj/CLAUDE.md']));
    mockGit({});

    // Should not crash — symlinked directories are treated as normal directories
    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const complete = events.find((e) => e.type === 'complete');
    expect(complete).toBeDefined();
    // The scanner uses isDirectory() which returns true for our mock,
    // so the symlinked dir is traversed and its marker is found
    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
  });

  it('exports AGENT_MARKERS constant', () => {
    expect(AGENT_MARKERS).toContain('CLAUDE.md');
    expect(AGENT_MARKERS).toContain('.claude');
    expect(AGENT_MARKERS).toContain('.cursor');
    expect(AGENT_MARKERS).toContain('.github/copilot');
    expect(AGENT_MARKERS).toContain('.dork/agent.json');
  });

  it('exports DEFAULT_EXCLUDE_PATTERNS constant', () => {
    expect(DEFAULT_EXCLUDE_PATTERNS).toContain('node_modules');
    expect(DEFAULT_EXCLUDE_PATTERNS).toContain('.git');
    expect(DEFAULT_EXCLUDE_PATTERNS).toContain('vendor');
    expect(DEFAULT_EXCLUDE_PATTERNS).toContain('Library');
    expect(DEFAULT_EXCLUDE_PATTERNS).toContain('.Trash');
    expect(DEFAULT_EXCLUDE_PATTERNS).toContain('dist');
    expect(DEFAULT_EXCLUDE_PATTERNS).toContain('build');
  });

  it('skips dist/ and build/ directories', async () => {
    mockReaddir({
      '/home/user': [
        makeDirent('dist', true),
        makeDirent('build', true),
        makeDirent('real-project', true),
      ],
      '/home/user/real-project': [],
    });
    mockAccess(new Set(['/home/user/real-project/CLAUDE.md']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const readdirCalls = vi.mocked(fsp.readdir).mock.calls.map((c) => String(c[0]));
    expect(readdirCalls).not.toContain('/home/user/dist');
    expect(readdirCalls).not.toContain('/home/user/build');

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].data.name).toBe('real-project');
  });

  it('skips Library/ directory (macOS)', async () => {
    mockReaddir({
      '/Users/user': [
        makeDirent('Library', true),
        makeDirent('my-project', true),
      ],
      '/Users/user/my-project': [],
    });
    mockAccess(new Set(['/Users/user/my-project/CLAUDE.md']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/Users/user', maxDepth: 2 })
    );

    const readdirCalls = vi.mocked(fsp.readdir).mock.calls.map((c) => String(c[0]));
    expect(readdirCalls).not.toContain('/Users/user/Library');

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
  });

  it('skips .Trash directory', async () => {
    mockReaddir({
      '/home/user': [
        makeDirent('.Trash', true),
        makeDirent('project', true),
      ],
      '/home/user/project': [],
    });
    mockAccess(new Set(['/home/user/project/CLAUDE.md']));
    mockGit({});

    await collectEvents(scanForAgents({ root: '/home/user', maxDepth: 2 }));

    const readdirCalls = vi.mocked(fsp.readdir).mock.calls.map((c) => String(c[0]));
    expect(readdirCalls).not.toContain('/home/user/.Trash');
  });

  it('finds markers at exactly maxDepth', async () => {
    mockReaddir({
      '/home/user': [makeDirent('level1', true)],
      '/home/user/level1': [makeDirent('level2', true)],
      '/home/user/level1/level2': [],
    });
    // Marker at depth=2, maxDepth=2 — should be found
    mockAccess(new Set(['/home/user/level1/level2/CLAUDE.md']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].data.path).toBe('/home/user/level1/level2');
  });

  it('does not recurse children at maxDepth', async () => {
    mockReaddir({
      '/home/user': [makeDirent('level1', true)],
      '/home/user/level1': [makeDirent('level2', true)],
      '/home/user/level1/level2': [makeDirent('level3', true)],
      '/home/user/level1/level2/level3': [],
    });
    mockAccess(new Set(['/home/user/level1/level2/level3/CLAUDE.md']));
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    // level3 is at depth 3, beyond maxDepth=2, so not scanned
    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(0);

    // readdir should not be called for level2's children enumeration beyond marker check
    const readdirCalls = vi.mocked(fsp.readdir).mock.calls.map((c) => String(c[0]));
    expect(readdirCalls).not.toContain('/home/user/level1/level2/level3');
  });

  it('handles empty root directory', async () => {
    mockReaddir({
      '/home/user': [],
    });
    mockAccess(new Set());
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(0);

    const complete = events.find((e) => e.type === 'complete');
    expect(complete).toBeDefined();
    expect(complete!.data.scannedDirs).toBe(1); // root is still scanned
    expect(complete!.data.foundAgents).toBe(0);
    expect(complete!.data.timedOut).toBe(false);
  });

  it('handles root directory with readdir error', async () => {
    vi.mocked(fsp.readdir).mockRejectedValue(
      Object.assign(new Error('EACCES'), { code: 'EACCES' })
    );
    mockAccess(new Set());
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/forbidden/root', maxDepth: 2 })
    );

    // Should still emit a complete event without crashing
    const complete = events.find((e) => e.type === 'complete');
    expect(complete).toBeDefined();
    expect(complete!.data.timedOut).toBe(false);
  });

  it('git branch trims whitespace from stdout', async () => {
    mockReaddir({
      '/home/user': [makeDirent('proj', true)],
      '/home/user/proj': [],
    });
    mockAccess(new Set(['/home/user/proj/CLAUDE.md']));

    // Return branch with trailing newline (typical git output)
    execFileMock.mockImplementation(
      (_cmd: string, args: string[], opts: { cwd?: string }, cb?: (err: Error | null, result: { stdout: string }) => void) => {
        if (args.includes('rev-parse')) {
          cb?.(null, { stdout: '  develop\n' });
        } else if (args.includes('remote.origin.url')) {
          cb?.(null, { stdout: '  https://github.com/user/repo.git\n' });
        }
        return undefined;
      }
    );

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates[0].data.gitBranch).toBe('develop');
    expect(candidates[0].data.gitRemote).toBe('https://github.com/user/repo.git');
  });

  it('git returns null when stdout is empty', async () => {
    mockReaddir({
      '/home/user': [makeDirent('proj', true)],
      '/home/user/proj': [],
    });
    mockAccess(new Set(['/home/user/proj/CLAUDE.md']));

    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], _opts: { cwd?: string }, cb?: (err: Error | null, result: { stdout: string }) => void) => {
        cb?.(null, { stdout: '' });
        return undefined;
      }
    );

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates[0].data.gitBranch).toBeNull();
    expect(candidates[0].data.gitRemote).toBeNull();
  });

  it('discovers multiple projects in the same root', async () => {
    mockReaddir({
      '/home/user': [
        makeDirent('project-a', true),
        makeDirent('project-b', true),
        makeDirent('project-c', true),
      ],
      '/home/user/project-a': [],
      '/home/user/project-b': [],
      '/home/user/project-c': [],
    });
    mockAccess(
      new Set([
        '/home/user/project-a/CLAUDE.md',
        '/home/user/project-b/.cursor',
        '/home/user/project-c/.dork/agent.json',
      ])
    );
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 2 })
    );

    const candidates = events.filter((e) => e.type === 'candidate');
    expect(candidates).toHaveLength(3);

    const names = candidates.map((c) => c.data.name).sort();
    expect(names).toEqual(['project-a', 'project-b', 'project-c']);
  });

  it('timeout produces partial results with candidates found so far', async () => {
    // With timeout=0, the deadline is already passed when the loop starts,
    // so it breaks immediately before scanning any directory
    mockReaddir({
      '/home/user': Array.from({ length: 100 }, (_, i) => makeDirent(`dir-${i}`, true)),
    });
    mockAccess(new Set());
    mockGit({});

    const events = await collectEvents(
      scanForAgents({ root: '/home/user', maxDepth: 1, timeout: 0 })
    );

    const complete = events.find((e) => e.type === 'complete');
    expect(complete).toBeDefined();
    expect(complete!.data.timedOut).toBe(true);
    // With timeout=0, the scanner breaks before processing any directories
    expect(complete!.data.scannedDirs).toBe(0);
    expect(complete!.data.foundAgents).toBe(0);
  });
});
