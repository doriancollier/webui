import { createRequire } from 'module';

declare const __CLI_VERSION__: string | undefined;

/**
 * Resolved server version string.
 *
 * Uses the build-time injected `__CLI_VERSION__` when bundled via the CLI package,
 * and falls back to reading `package.json` in dev mode.
 */
export const SERVER_VERSION: string =
  typeof __CLI_VERSION__ !== 'undefined'
    ? __CLI_VERSION__
    : (createRequire(import.meta.url)('../../package.json') as { version: string }).version;
