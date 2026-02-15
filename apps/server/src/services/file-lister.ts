import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

/**
 * File listing service for the client file browser.
 *
 * Tries `git ls-files` first for accuracy, falls back to recursive readdir.
 * Results are cached with a 5-minute TTL. Enforces a 10,000 file limit.
 *
 * @module services/file-lister
 */
const execFileAsync = promisify(execFile);

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '__pycache__',
  '.cache',
]);
const MAX_FILES = 10_000;
const CACHE_TTL = 5 * 60 * 1000;

class FileListService {
  private cache = new Map<string, { files: string[]; timestamp: number }>();

  async listFiles(cwd: string): Promise<{ files: string[]; truncated: boolean; total: number }> {
    const cached = this.cache.get(cwd);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        files: cached.files,
        truncated: cached.files.length >= MAX_FILES,
        total: cached.files.length,
      };
    }

    let files: string[];
    try {
      files = await this.listViaGit(cwd);
    } catch {
      files = await this.listViaReaddir(cwd);
    }

    const truncated = files.length > MAX_FILES;
    if (truncated) files = files.slice(0, MAX_FILES);

    this.cache.set(cwd, { files, timestamp: Date.now() });
    return { files, truncated, total: files.length };
  }

  private async listViaGit(cwd: string): Promise<string[]> {
    const { stdout } = await execFileAsync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard'],
      {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    return stdout.split('\n').filter(Boolean);
  }

  private async listViaReaddir(cwd: string, prefix = '', depth = 0): Promise<string[]> {
    if (depth > 8) return [];
    const results: string[] = [];
    const entries = await fs.readdir(path.join(cwd, prefix), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        results.push(...(await this.listViaReaddir(cwd, rel, depth + 1)));
      } else {
        results.push(rel);
      }
      if (results.length >= MAX_FILES) break;
    }
    return results;
  }

  invalidateCache(cwd?: string): void {
    if (cwd) this.cache.delete(cwd);
    else this.cache.clear();
  }
}

export const fileLister = new FileListService();
