/**
 * Unified discovery types — events, options, and exclude patterns.
 *
 * @module mesh/discovery/types
 */
import type { DiscoveryCandidate, AgentManifest } from '@dorkos/shared/mesh-schemas';
import type { Logger } from '@dorkos/shared/logger';

/** Events yielded by the unified scanner. */
export type ScanEvent =
  | { type: 'candidate'; data: DiscoveryCandidate }
  | { type: 'auto-import'; data: { manifest: AgentManifest; path: string } }
  | { type: 'progress'; data: ScanProgress }
  | { type: 'complete'; data: ScanProgress & { timedOut: boolean } };

/** Progress counters emitted during a scan. */
export interface ScanProgress {
  scannedDirs: number;
  foundAgents: number;
}

/** Options for the unified scanner. */
export interface UnifiedScanOptions {
  /** Root directory to scan. */
  root: string;
  /** Maximum BFS depth (default: 5). */
  maxDepth?: number;
  /** Scan timeout in ms (default: 30000). */
  timeout?: number;
  /** Follow symlinks with cycle detection (default: false). */
  followSymlinks?: boolean;
  /** Additional exclude patterns beyond the defaults. */
  extraExcludes?: string[];
  /** Logger for warnings. */
  logger?: Logger;
}

/**
 * Unified exclude set — superset of both Scanner A and Scanner B patterns.
 *
 * Combines all exclusions from the legacy `discovery-engine.ts` (Scanner A)
 * and `discovery-scanner.ts` (Scanner B) into a single canonical set.
 */
export const UNIFIED_EXCLUDE_PATTERNS = new Set([
  // From Scanner A (discovery-engine.ts)
  'node_modules',
  '.git',
  'vendor',
  'Library',
  'AppData',
  '.Trash',
  'dist',
  'build',
  '.cache',
  '.npm',
  '.nvm',
  '.local',
  '.cargo',
  '.rustup',
  'go/pkg',
  // From Scanner B (discovery-scanner.ts — additions)
  '__pycache__',
  '.venv',
  'venv',
  '.tox',
  '.DS_Store',
  'extensions',
]);
