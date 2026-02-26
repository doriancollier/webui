import os from 'os';
import path from 'path';

/**
 * Resolve the DorkOS data directory with environment-aware defaults.
 *
 * Priority:
 *  1. `DORK_HOME` env var — explicit override, wins in any environment
 *  2. `.temp/.dork/` relative to `cwd` — dev default (keeps project-local state out of `~`)
 *  3. `~/.dork/` — production default
 *
 * The resolved value is set on `process.env.DORK_HOME` during server startup
 * so that all downstream services can read it without re-running this logic.
 */
export function resolveDorkHome(): string {
  if (process.env.DORK_HOME) return process.env.DORK_HOME;
  if (process.env.NODE_ENV !== 'production') {
    return path.join(process.cwd(), '.temp', '.dork');
  }
  return path.join(os.homedir(), '.dork');
}
