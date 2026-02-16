/** Server-only constants — timeouts, limits, and tuning parameters. */

export const INTERVALS = {
  /** How often to run session health checks (ms). */
  HEALTH_CHECK_MS: 5 * 60 * 1000,
} as const;

export const FILE_LIMITS = {
  /** Max buffer for `git ls-files` output (bytes). */
  GIT_MAX_BUFFER: 10 * 1024 * 1024,
  /** Max recursion depth for readdir fallback. */
  MAX_READDIR_DEPTH: 8,
} as const;

export const WATCHER = {
  /** chokidar awaitWriteFinish stabilityThreshold (ms). */
  STABILITY_THRESHOLD_MS: 50,
  /** chokidar awaitWriteFinish pollInterval (ms). */
  POLL_INTERVAL_MS: 25,
  /** Debounce interval for file-change broadcasts (ms). */
  DEBOUNCE_MS: 100,
} as const;

export const GIT = {
  /** Timeout for `git status` commands (ms). */
  STATUS_TIMEOUT_MS: 5000,
} as const;
