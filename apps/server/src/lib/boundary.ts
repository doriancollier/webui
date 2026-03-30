import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Centralized directory boundary enforcement utility.
 *
 * Provides path validation to ensure all filesystem operations are restricted
 * to a configured root directory. Must be initialized at server startup via
 * `initBoundary()` before any validation calls.
 *
 * @module lib/boundary
 */

/** Error thrown when a path violates the directory boundary. */
export class BoundaryError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'BoundaryError';
    this.code = code;
  }
}

/** Resolved boundary root, set once at startup via initBoundary(). */
let resolvedBoundary: string | null = null;

/**
 * Initialize the boundary root. Must be called once at server startup.
 * Resolves symlinks and stores the canonical path.
 *
 * @param boundary - Configured boundary path, or null/undefined for os.homedir()
 * @returns The resolved canonical boundary path
 */
export async function initBoundary(boundary?: string | null): Promise<string> {
  const raw = boundary ?? os.homedir();
  resolvedBoundary = await fs.realpath(raw);
  return resolvedBoundary;
}

/**
 * Get the resolved boundary path.
 *
 * @throws Error if initBoundary() hasn't been called yet
 */
export function getBoundary(): string {
  if (!resolvedBoundary) {
    throw new Error('Boundary not initialized. Call initBoundary() at startup.');
  }
  return resolvedBoundary;
}

/**
 * Expand a leading `~` or `~/` in a user-supplied path to the home directory.
 *
 * Node.js filesystem APIs don't expand tilde — this normalizes user-supplied
 * paths (e.g., from config values like `~/.dork/agents`) before resolution.
 *
 * @param userPath - Path that may start with `~`
 * @returns Path with tilde expanded to `os.homedir()`
 */
export function expandTilde(userPath: string): string {
  if (userPath === '~') return os.homedir();
  if (userPath.startsWith('~/')) return path.join(os.homedir(), userPath.slice(2));
  return userPath;
}

/**
 * Validate that a path is within the directory boundary.
 *
 * Expands leading `~` to the home directory, then resolves symlinks before
 * checking containment to prevent symlink-based boundary escapes. For
 * non-existent paths (ENOENT), falls back to `path.resolve()` so session
 * creation for new directories still validates.
 *
 * @param userPath - User-supplied path to validate (absolute or tilde-prefixed)
 * @param boundary - Optional boundary override (defaults to initialized boundary)
 * @returns Resolved canonical path
 * @throws BoundaryError if path is outside boundary, contains null bytes, or permission is denied
 */
export async function validateBoundary(userPath: string, boundary?: string): Promise<string> {
  const root = boundary ?? getBoundary();

  // Reject null bytes — prevents null byte injection attacks
  if (userPath.includes('\0')) {
    throw new BoundaryError('Invalid path: null bytes not allowed', 'NULL_BYTE');
  }

  // Expand leading tilde before any filesystem resolution
  const expanded = expandTilde(userPath);

  // Resolve symlinks to their real target
  let resolved: string;
  try {
    resolved = await fs.realpath(expanded);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      // Path doesn't exist yet (e.g., new session directory) — resolve without symlink follow
      resolved = path.resolve(expanded);
    } else if (code === 'EACCES') {
      throw new BoundaryError('Permission denied', 'PERMISSION_DENIED');
    } else {
      throw err;
    }
  }

  // Boundary check: use path.sep suffix to prevent prefix collision.
  // Without it, boundary /home/user would incorrectly allow /home/username.
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new BoundaryError('Access denied: path outside directory boundary', 'OUTSIDE_BOUNDARY');
  }

  return resolved;
}

/**
 * Check if a path is within the boundary without throwing.
 *
 * @param userPath - User-supplied path to check
 * @param boundary - Optional boundary override (defaults to initialized boundary)
 * @returns true if the path is within the boundary, false otherwise
 */
export async function isWithinBoundary(userPath: string, boundary?: string): Promise<boolean> {
  try {
    await validateBoundary(userPath, boundary);
    return true;
  } catch {
    return false;
  }
}
