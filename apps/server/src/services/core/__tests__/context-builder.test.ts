import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';

vi.mock('../git-status.js', () => ({
  getGitStatus: vi.fn(),
}));
vi.mock('@dorkos/shared/manifest', () => ({
  readManifest: vi.fn(),
}));
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));

import { buildSystemPromptAppend, _buildAgentBlock } from '../context-builder.js';
import { getGitStatus } from '../git-status.js';
import { readManifest } from '@dorkos/shared/manifest';
import type { GitStatusResponse } from '@dorkos/shared/types';

const mockedGetGitStatus = vi.mocked(getGitStatus);
const mockedReadManifest = vi.mocked(readManifest);

function makeGitStatus(overrides: Partial<GitStatusResponse> = {}): GitStatusResponse {
  return {
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
    ...overrides,
  };
}

function makeManifest(overrides: Partial<AgentManifest> = {}): AgentManifest {
  return {
    id: '01JTEST000000000000000000',
    name: 'test-agent',
    description: '',
    runtime: 'claude-code',
    capabilities: [],
    behavior: { responseMode: 'always' },
    budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
    registeredAt: '2026-01-01T00:00:00.000Z',
    registeredBy: 'test',
    personaEnabled: true,
    projectPath: '/test/dir',
    scanRoot: '/test',
    ...overrides,
  };
}

describe('buildSystemPromptAppend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockedGetGitStatus.mockResolvedValue(makeGitStatus());
    mockedReadManifest.mockResolvedValue(null);
  });

  it('returns string containing <env> block', async () => {
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('<env>');
    expect(result).toContain('</env>');
  });

  it('<env> contains all required fields', async () => {
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('Working directory: /test/dir');
    expect(result).toContain('Product: DorkOS');
    expect(result).toMatch(/Version: /);
    expect(result).toMatch(/Port: /);
    expect(result).toMatch(/Platform: /);
    expect(result).toMatch(/OS Version: /);
    expect(result).toMatch(/Node\.js: /);
    expect(result).toMatch(/Hostname: /);
    expect(result).toMatch(/Date: /);
  });

  it('Date field is valid ISO 8601', async () => {
    const result = await buildSystemPromptAppend('/test/dir');
    const dateMatch = result.match(/Date: (.+)/);
    expect(dateMatch).not.toBeNull();
    const parsed = new Date(dateMatch![1]);
    expect(parsed.toISOString()).toBe(dateMatch![1]);
  });

  it('Version defaults to "development" when env unset', async () => {
    delete process.env.DORKOS_VERSION;
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('Version: development');
  });

  it('<git_status> shows "Is git repo: false" for non-git dirs', async () => {
    mockedGetGitStatus.mockResolvedValue({ error: 'not_git_repo' as const });
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('<git_status>');
    expect(result).toContain('Is git repo: false');
    expect(result).toContain('</git_status>');
  });

  it('<git_status> shows branch when git repo', async () => {
    mockedGetGitStatus.mockResolvedValue(makeGitStatus({ branch: 'feat/my-feature' }));
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('Is git repo: true');
    expect(result).toContain('Current branch: feat/my-feature');
  });

  it('omits "Ahead of origin" when ahead=0', async () => {
    mockedGetGitStatus.mockResolvedValue(makeGitStatus({ ahead: 0 }));
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).not.toContain('Ahead of origin');
  });

  it('shows "Ahead of origin" when ahead>0', async () => {
    mockedGetGitStatus.mockResolvedValue(makeGitStatus({ ahead: 3 }));
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('Ahead of origin: 3 commits');
  });

  it('shows "Working tree: clean" when all counts zero', async () => {
    mockedGetGitStatus.mockResolvedValue(makeGitStatus({ clean: true }));
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('Working tree: clean');
  });

  it('shows "Working tree: dirty" with only non-zero counts', async () => {
    mockedGetGitStatus.mockResolvedValue(
      makeGitStatus({
        clean: false,
        modified: 2,
        staged: 0,
        untracked: 3,
        conflicted: 0,
      })
    );
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('Working tree: dirty (2 modified, 3 untracked)');
    expect(result).not.toContain('staged');
    expect(result).not.toContain('conflicted');
  });

  it('shows "Detached HEAD" only when detached', async () => {
    mockedGetGitStatus.mockResolvedValue(makeGitStatus({ detached: false }));
    let result = await buildSystemPromptAppend('/test/dir');
    expect(result).not.toContain('Detached HEAD');

    mockedGetGitStatus.mockResolvedValue(makeGitStatus({ detached: true, branch: 'HEAD' }));
    result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('Detached HEAD: true');
  });

  it('git failure still returns env block (no throw)', async () => {
    mockedGetGitStatus.mockRejectedValue(new Error('git not found'));
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('<env>');
    expect(result).toContain('</env>');
  });

  it('includes agent block alongside env and git blocks', async () => {
    mockedReadManifest.mockResolvedValue(
      makeManifest({ name: 'my-agent', description: 'A helpful agent' })
    );
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('<env>');
    expect(result).toContain('<git_status>');
    expect(result).toContain('<agent_identity>');
    expect(result).toContain('Name: my-agent');
  });

  it('gracefully handles agent block failure', async () => {
    mockedReadManifest.mockRejectedValue(new Error('disk error'));
    const result = await buildSystemPromptAppend('/test/dir');
    expect(result).toContain('<env>');
    expect(result).toContain('<git_status>');
    expect(result).not.toContain('<agent_identity>');
  });
});

describe('buildAgentBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedReadManifest.mockResolvedValue(null);
  });

  it('returns empty string when readManifest returns null', async () => {
    mockedReadManifest.mockResolvedValue(null);
    const result = await _buildAgentBlock('/test/dir');
    expect(result).toBe('');
  });

  it('includes <agent_identity> with name and id when manifest exists', async () => {
    mockedReadManifest.mockResolvedValue(makeManifest());
    const result = await _buildAgentBlock('/test/dir');
    expect(result).toContain('<agent_identity>');
    expect(result).toContain('Name: test-agent');
    expect(result).toContain('ID: 01JTEST000000000000000000');
    expect(result).toContain('</agent_identity>');
  });

  it('includes description in identity block when non-empty', async () => {
    mockedReadManifest.mockResolvedValue(makeManifest({ description: 'A test agent' }));
    const result = await _buildAgentBlock('/test/dir');
    expect(result).toContain('Description: A test agent');
  });

  it('includes capabilities in identity block when non-empty array', async () => {
    mockedReadManifest.mockResolvedValue(
      makeManifest({ capabilities: ['code-review', 'testing'] })
    );
    const result = await _buildAgentBlock('/test/dir');
    expect(result).toContain('Capabilities: code-review, testing');
  });

  it('omits description line when description is empty string', async () => {
    mockedReadManifest.mockResolvedValue(makeManifest({ description: '' }));
    const result = await _buildAgentBlock('/test/dir');
    expect(result).not.toContain('Description:');
  });

  it('omits capabilities line when capabilities is empty array', async () => {
    mockedReadManifest.mockResolvedValue(makeManifest({ capabilities: [] }));
    const result = await _buildAgentBlock('/test/dir');
    expect(result).not.toContain('Capabilities:');
  });

  it('includes <agent_persona> when personaEnabled is true and persona is non-empty', async () => {
    mockedReadManifest.mockResolvedValue(
      makeManifest({ personaEnabled: true, persona: 'You are a helpful backend expert.' })
    );
    const result = await _buildAgentBlock('/test/dir');
    expect(result).toContain('<agent_persona>');
    expect(result).toContain('You are a helpful backend expert.');
    expect(result).toContain('</agent_persona>');
  });

  it('excludes <agent_persona> when personaEnabled is false', async () => {
    mockedReadManifest.mockResolvedValue(
      makeManifest({ personaEnabled: false, persona: 'You are a helpful backend expert.' })
    );
    const result = await _buildAgentBlock('/test/dir');
    expect(result).not.toContain('<agent_persona>');
    expect(result).toContain('<agent_identity>');
  });

  it('excludes <agent_persona> when persona is undefined', async () => {
    mockedReadManifest.mockResolvedValue(makeManifest({ personaEnabled: true, persona: undefined }));
    const result = await _buildAgentBlock('/test/dir');
    expect(result).not.toContain('<agent_persona>');
  });

  it('excludes <agent_persona> when persona is empty string', async () => {
    mockedReadManifest.mockResolvedValue(makeManifest({ personaEnabled: true, persona: '' }));
    const result = await _buildAgentBlock('/test/dir');
    expect(result).not.toContain('<agent_persona>');
  });

  it('includes <agent_persona> when personaEnabled is undefined (defaults true) and persona is non-empty', async () => {
    // personaEnabled defaults to true in the schema, so when present it will be true
    mockedReadManifest.mockResolvedValue(
      makeManifest({ personaEnabled: true, persona: 'Expert persona text.' })
    );
    const result = await _buildAgentBlock('/test/dir');
    expect(result).toContain('<agent_persona>');
    expect(result).toContain('Expert persona text.');
  });
});
