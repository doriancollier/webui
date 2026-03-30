/**
 * Safety-net reconciler for file→DB sync.
 *
 * Runs every 5 minutes to catch changes missed by the file watcher
 * (e.g., during network filesystem hiccups or race conditions).
 *
 * @module services/tasks/task-reconciler
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { TaskStore } from './task-store.js';
import { parseTaskFile } from './task-file-parser.js';
import { logger } from '../../lib/logger.js';

/** 5-minute reconciliation interval. */
const RECONCILE_INTERVAL_MS = 300_000;

/** 24-hour grace period before removing orphan DB entries. */
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

interface TaskDirectory {
  tasksDir: string;
  scope: 'project' | 'global';
  projectPath?: string;
}

/**
 * Periodically reconciles task files on disk with the DB cache.
 *
 * Follows the agent reconciler pattern from packages/mesh.
 */
export class TaskReconciler {
  private interval: ReturnType<typeof setInterval> | null = null;
  private directories: TaskDirectory[] = [];

  constructor(private store: TaskStore) {}

  /** Register a directory to reconcile. */
  addDirectory(tasksDir: string, scope: 'project' | 'global', projectPath?: string): void {
    this.directories.push({ tasksDir, scope, projectPath });
  }

  /** Remove a directory from reconciliation (e.g., on agent unregister). */
  removeDirectory(tasksDir: string): void {
    this.directories = this.directories.filter((d) => d.tasksDir !== tasksDir);
  }

  /** Start periodic reconciliation. */
  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.reconcile().catch((err) => {
        logger.error('[TaskReconciler] Reconciliation failed', err);
      });
    }, RECONCILE_INTERVAL_MS);
    logger.info('[TaskReconciler] Started (interval: 5m)');
  }

  /** Stop periodic reconciliation. */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('[TaskReconciler] Stopped');
    }
  }

  /** Run a single reconciliation pass. */
  async reconcile(): Promise<{ upserted: number; orphaned: number }> {
    let upserted = 0;
    let orphaned = 0;
    const seenFilePaths = new Set<string>();

    for (const dir of this.directories) {
      try {
        const files = await this.listTaskFiles(dir.tasksDir);
        for (const filePath of files) {
          seenFilePaths.add(filePath);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const result = parseTaskFile(filePath, content, dir.scope, dir.projectPath);
            if ('error' in result) {
              logger.warn(`[TaskReconciler] Invalid file ${filePath}: ${result.error}`);
              continue;
            }
            this.store.upsertFromFile(result);
            upserted++;
          } catch (err) {
            logger.warn(`[TaskReconciler] Failed to read ${filePath}`, err);
          }
        }
      } catch {
        // Directory may not exist yet — that's fine
      }
    }

    // Mark DB entries as paused if their file is gone (24h grace period)
    const allTasks = this.store.getTasks();
    const now = Date.now();
    for (const task of allTasks) {
      if (task.filePath && !seenFilePaths.has(task.filePath)) {
        const updatedAt = new Date(task.updatedAt).getTime();
        if (now - updatedAt > ORPHAN_GRACE_MS) {
          this.store.deleteTask(task.id);
          orphaned++;
        } else if (task.status !== 'paused') {
          this.store.markRemovedBySlug(path.basename(task.filePath, '.md'));
        }
      }
    }

    if (upserted > 0 || orphaned > 0) {
      logger.info(
        `[TaskReconciler] Reconciled: ${upserted} upserted, ${orphaned} orphaned removed`
      );
    }

    return { upserted, orphaned };
  }

  private async listTaskFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.'))
      .map((e) => path.join(dir, e.name));
  }
}
