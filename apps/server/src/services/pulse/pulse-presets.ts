/**
 * Pulse preset system — default schedule templates for first-time users.
 *
 * Provides factory-default presets stored at `{dorkHome}/pulse/presets.json`.
 * Presets are created on first server start and can be customized by the user.
 *
 * @module services/pulse/pulse-presets
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import path from 'node:path';
import { logger } from '../../lib/logger.js';

/** A pulse schedule preset template. */
export interface PulsePreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
  cron: string;
  timezone: string;
  category: string;
}

/** The four factory-default presets. */
const DEFAULT_PRESETS: PulsePreset[] = [
  {
    id: 'health-check',
    name: 'Health Check',
    description: 'Run lint, tests, and type-check to catch issues early.',
    prompt:
      'Run the project health checks: lint, test, and typecheck. Report any failures with file paths and error messages. Suggest fixes for any issues found.',
    cron: '0 8 * * 1',
    timezone: 'UTC',
    category: 'maintenance',
  },
  {
    id: 'dependency-audit',
    name: 'Dependency Audit',
    description: 'Audit npm dependencies for known vulnerabilities.',
    prompt:
      'Run npm audit and review the results. List any vulnerabilities found with severity levels. Suggest remediation steps for critical and high severity issues.',
    cron: '0 9 * * 1',
    timezone: 'UTC',
    category: 'security',
  },
  {
    id: 'docs-sync',
    name: 'Docs Sync',
    description: 'Check for documentation drift against the codebase.',
    prompt:
      'Review the project documentation for accuracy. Check that README, API docs, and inline comments reflect the current code. Report any outdated or missing documentation.',
    cron: '0 10 * * *',
    timezone: 'UTC',
    category: 'documentation',
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Review recent commits for code quality and potential issues.',
    prompt:
      'Review the git commits from the past week. Look for code quality issues, potential bugs, missing tests, and style inconsistencies. Provide a summary with actionable feedback.',
    cron: '0 8 * * 5',
    timezone: 'UTC',
    category: 'quality',
  },
];

/**
 * Resolve the presets file path within the dork home directory.
 *
 * @param dorkHome - The dork home directory path
 */
function resolvePresetsPath(dorkHome: string): string {
  return path.join(dorkHome, 'pulse', 'presets.json');
}

/**
 * Load presets from the JSON file on disk.
 *
 * Returns the default presets array if the file does not exist.
 * Returns an empty array if the file contains malformed JSON.
 *
 * @param dorkHome - The dork home directory path
 */
export async function loadPresets(dorkHome: string): Promise<PulsePreset[]> {
  const presetsPath = resolvePresetsPath(dorkHome);
  try {
    const content = await readFile(presetsPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      logger.warn('[Pulse] Presets file does not contain an array, returning empty');
      return [];
    }
    return parsed as PulsePreset[];
  } catch (err) {
    if (err instanceof SyntaxError) {
      logger.warn('[Pulse] Malformed presets JSON, returning empty array');
      return [];
    }
    // File not found — return factory defaults
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [...DEFAULT_PRESETS];
    }
    logger.warn('[Pulse] Failed to load presets', { error: (err as Error).message });
    return [];
  }
}

/**
 * Ensure default presets exist on disk.
 *
 * Creates `{dorkHome}/pulse/presets.json` with the four default presets
 * if the file does not already exist. Existing files are left untouched.
 *
 * @param dorkHome - The dork home directory path
 */
export async function ensureDefaultPresets(dorkHome: string): Promise<void> {
  const presetsPath = resolvePresetsPath(dorkHome);
  try {
    await readFile(presetsPath, 'utf-8');
    // File exists — do not overwrite
    logger.debug('[Pulse] Presets file already exists, skipping default creation');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // File does not exist — create with defaults
      await mkdir(dirname(presetsPath), { recursive: true });
      await writeFile(presetsPath, JSON.stringify(DEFAULT_PRESETS, null, 2), 'utf-8');
      logger.info(`[Pulse] Created default presets at ${presetsPath}`);
    } else {
      logger.warn('[Pulse] Failed to check presets file', { error: (err as Error).message });
    }
  }
}

/**
 * Get the default presets without reading from disk.
 *
 * Useful for testing or when the file system is unavailable.
 */
export function getDefaultPresets(): PulsePreset[] {
  return [...DEFAULT_PRESETS];
}
