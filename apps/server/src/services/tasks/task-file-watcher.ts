/**
 * Watches task directories for .md file changes and syncs to the DB cache.
 *
 * @module services/tasks/task-file-watcher
 */
import chokidar, { type FSWatcher } from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { TaskStore } from './task-store.js';
import { parseTaskFile } from './task-file-parser.js';
import { logger } from '../../lib/logger.js';

/** Callback invoked when a task file changes or is removed. */
type TaskChangeCallback = (taskId: string) => void;

/**
 * Watches task directories for file changes and syncs to the DB cache.
 *
 * - Global tasks: `{dorkHome}/tasks/` — started unconditionally on server startup
 * - Project tasks: `{projectPath}/.dork/tasks/` — started per agent registration
 */
export class TaskFileWatcher {
  private watchers = new Map<string, FSWatcher>();

  constructor(
    private store: TaskStore,
    private onTaskChange: TaskChangeCallback,
    private dorkHome: string
  ) {}

  /**
   * Watch a task directory for .md file changes.
   *
   * @param tasksDir - Absolute path to the tasks directory
   * @param scope - 'project' or 'global'
   * @param projectPath - Project root (for project-scoped tasks)
   */
  watch(tasksDir: string, scope: 'project' | 'global', projectPath?: string): void {
    if (this.watchers.has(tasksDir)) {
      logger.warn(`[TaskFileWatcher] Already watching ${tasksDir} — skipping duplicate`);
      return;
    }

    const watcher = chokidar.watch(path.join(tasksDir, '*.md'), {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 25,
      },
    });

    watcher.on('add', (filePath) => this.handleFileChange(filePath, scope, projectPath));
    watcher.on('change', (filePath) => this.handleFileChange(filePath, scope, projectPath));
    watcher.on('unlink', (filePath) => this.handleFileRemove(filePath));

    this.watchers.set(tasksDir, watcher);
    logger.info(`[TaskFileWatcher] Watching ${tasksDir} (${scope})`);
  }

  /** Stop watching a specific directory (e.g., on agent unregister). */
  async stopWatching(tasksDir: string): Promise<void> {
    const watcher = this.watchers.get(tasksDir);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(tasksDir);
      logger.info(`[TaskFileWatcher] Stopped watching ${tasksDir}`);
    }
  }

  /** Stop all watchers (server shutdown). */
  async stopAll(): Promise<void> {
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();
  }

  private async handleFileChange(
    filePath: string,
    scope: 'project' | 'global',
    projectPath?: string
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const result = parseTaskFile(filePath, content, scope, projectPath);

      if ('error' in result) {
        logger.warn(`[TaskFileWatcher] Invalid task file ${filePath}: ${result.error}`);
        return;
      }

      this.store.upsertFromFile(result);
      this.onTaskChange(result.id);
    } catch (err) {
      logger.error(`[TaskFileWatcher] Failed to process ${filePath}`, err);
    }
  }

  private handleFileRemove(filePath: string): void {
    const slug = path.basename(filePath, '.md');
    this.store.markRemovedBySlug(slug);
    this.onTaskChange(slug);
    logger.info(`[TaskFileWatcher] Task file removed: ${slug}`);
  }
}
