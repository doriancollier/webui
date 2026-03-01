/**
 * Single source of truth for the server's default working directory (vault root).
 *
 * Prefers the `DORKOS_DEFAULT_CWD` env var (set by CLI, Obsidian plugin, etc.),
 * falling back to the repository root resolved from this file's location.
 *
 * @module lib/resolve-root
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../env.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));

/** Default CWD for the server -- prefers env var, falls back to repo root. */
export const DEFAULT_CWD: string = env.DORKOS_DEFAULT_CWD ?? path.resolve(thisDir, '../../../');
