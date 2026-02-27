import os from 'node:os';
import { getGitStatus } from './git-status.js';
import type { GitStatusResponse } from '@dorkos/shared/types';
import { readManifest } from '@dorkos/shared/manifest';
import { logger } from '../../lib/logger.js';
import { env } from '../../env.js';

/**
 * Build a system prompt append string containing runtime context.
 *
 * Returns XML key-value blocks mirroring Claude Code's own `<env>` structure.
 * Never throws — all errors result in partial context (git failures produce
 * `Is git repo: false`).
 */
export async function buildSystemPromptAppend(cwd: string): Promise<string> {
  const [envResult, gitResult, agentResult] = await Promise.allSettled([
    buildEnvBlock(cwd),
    buildGitBlock(cwd),
    buildAgentBlock(cwd),
  ]);

  return [
    envResult.status === 'fulfilled' ? envResult.value : '',
    gitResult.status === 'fulfilled' ? gitResult.value : '',
    agentResult.status === 'fulfilled' ? agentResult.value : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Build the `<env>` block with system and DorkOS metadata. */
async function buildEnvBlock(cwd: string): Promise<string> {
  const lines = [
    `Working directory: ${cwd}`,
    `Product: DorkOS`,
    `Version: ${env.DORKOS_VERSION ?? 'development'}`,
    `Port: ${env.DORKOS_PORT}`,
    `Platform: ${os.platform()}`,
    `OS Version: ${os.release()}`,
    `Node.js: ${process.version}`,
    `Hostname: ${os.hostname()}`,
    `Date: ${new Date().toISOString()}`,
  ];

  return `<env>\n${lines.join('\n')}\n</env>`;
}

/**
 * Build the `<git_status>` block from git status data.
 *
 * For non-git directories or git failures, returns a minimal block
 * with `Is git repo: false`.
 */
async function buildGitBlock(cwd: string): Promise<string> {
  try {
    const status = await getGitStatus(cwd);

    // Non-git directory (error response)
    if ('error' in status) {
      return '<git_status>\nIs git repo: false\n</git_status>';
    }

    const gitStatus = status as GitStatusResponse;
    const lines: string[] = [
      'Is git repo: true',
      `Current branch: ${gitStatus.branch}`,
      'Main branch (use for PRs): main',
    ];

    if (gitStatus.ahead > 0) {
      lines.push(`Ahead of origin: ${gitStatus.ahead} commits`);
    }
    if (gitStatus.behind > 0) {
      lines.push(`Behind origin: ${gitStatus.behind} commits`);
    }
    if (gitStatus.detached) {
      lines.push('Detached HEAD: true');
    }

    if (gitStatus.clean) {
      lines.push('Working tree: clean');
    } else {
      const parts: string[] = [];
      if (gitStatus.modified > 0) parts.push(`${gitStatus.modified} modified`);
      if (gitStatus.staged > 0) parts.push(`${gitStatus.staged} staged`);
      if (gitStatus.untracked > 0) parts.push(`${gitStatus.untracked} untracked`);
      if (gitStatus.conflicted > 0) parts.push(`${gitStatus.conflicted} conflicted`);
      lines.push(`Working tree: dirty (${parts.join(', ')})`);
    }

    return `<git_status>\n${lines.join('\n')}\n</git_status>`;
  } catch (err) {
    logger.warn('[buildGitBlock] git status failed, returning non-git block', { err });
    return '<git_status>\nIs git repo: false\n</git_status>';
  }
}

/**
 * Build agent identity and persona blocks from `.dork/agent.json`.
 *
 * When a manifest exists, always includes `<agent_identity>` (informational).
 * Includes `<agent_persona>` only when `personaEnabled` is true and `persona`
 * text is non-empty.
 *
 * @param cwd - Working directory to check for agent manifest
 * @returns XML block string, or empty string if no manifest
 */
async function buildAgentBlock(cwd: string): Promise<string> {
  const manifest = await readManifest(cwd);
  if (!manifest) return '';

  // Zod v4 + openapi extension drops persona fields from inferred type
  const { persona, personaEnabled } = manifest as {
    persona?: string;
    personaEnabled?: boolean;
  };

  const identityLines = [
    `Name: ${manifest.name}`,
    `ID: ${manifest.id}`,
    manifest.description && `Description: ${manifest.description}`,
    manifest.capabilities.length > 0 && `Capabilities: ${manifest.capabilities.join(', ')}`,
  ].filter(Boolean);

  const blocks = [`<agent_identity>\n${identityLines.join('\n')}\n</agent_identity>`];

  if (personaEnabled !== false && persona) {
    blocks.push(`<agent_persona>\n${persona}\n</agent_persona>`);
  }

  return blocks.join('\n\n');
}

/** @internal Exported for testing only. */
export { buildAgentBlock as _buildAgentBlock };
