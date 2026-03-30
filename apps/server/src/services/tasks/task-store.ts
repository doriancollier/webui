import { eq, desc, and, count, notInArray, like } from 'drizzle-orm';
import { pulseSchedules, pulseRuns, type Db } from '@dorkos/db';
import { ulid } from 'ulidx';
import type {
  Task,
  TaskRun,
  TaskRunStatus,
  TaskRunTrigger,
  CreateTaskInput,
  UpdateTaskRequest,
} from '@dorkos/shared/types';
import { logger } from '../../lib/logger.js';
import type { TaskDefinition } from './task-file-parser.js';
import { parseDuration } from './task-file-parser.js';

/** Options for listing runs. */
interface ListRunsOptions {
  taskId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

/** Extended create input with server-side fields not in the shared API type. */
interface CreateTaskStoreInput extends CreateTaskInput {
  /** Absolute path to the .md task file on disk. */
  filePath?: string;
  /** Freeform tags for filtering. */
  tags?: string[];
}

/** Fields that can be updated on a run. */
interface RunUpdate {
  status?: TaskRunStatus;
  finishedAt?: string;
  durationMs?: number;
  outputSummary?: string;
  error?: string;
  sessionId?: string;
}

/**
 * Persistence layer for Task scheduler data.
 *
 * Uses the shared Drizzle database for both task definitions and run history.
 * Replaces the former dual-backend approach (SQLite + JSON file).
 */
export class TaskStore {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  // === Task CRUD ===

  /** Read all tasks from the database. */
  getTasks(): Task[] {
    const rows = this.db.select().from(pulseSchedules).all();
    return rows.map(mapTaskRow);
  }

  /** Get a single task by ID. */
  getTask(id: string): Task | null {
    const row = this.db.select().from(pulseSchedules).where(eq(pulseSchedules.id, id)).get();
    return row ? mapTaskRow(row) : null;
  }

  /** Create a new task and persist to the database. */
  createTask(input: CreateTaskStoreInput): Task {
    const now = new Date().toISOString();
    const id = ulid();

    this.db
      .insert(pulseSchedules)
      .values({
        id,
        name: input.name,
        prompt: input.prompt,
        cron: input.cron ?? '',
        timezone: input.timezone ?? 'UTC',
        cwd: input.cwd ?? null,
        agentId: input.agentId ?? null,
        enabled: input.enabled ?? true,
        maxRuntime: input.maxRuntime ?? null,
        permissionMode: input.permissionMode ?? 'acceptEdits',
        status: 'active',
        filePath: input.filePath ?? '',
        tags: JSON.stringify(input.tags ?? []),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return this.getTask(id)!;
  }

  /** Update an existing task. Returns the updated task or null if not found. */
  updateTask(id: string, input: UpdateTaskRequest): Task | null {
    const existing = this.getTask(id);
    if (!existing) return null;

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.prompt !== undefined) updates.prompt = input.prompt;
    if (input.cron !== undefined) updates.cron = input.cron;
    if (input.timezone !== undefined) updates.timezone = input.timezone ?? 'UTC';
    if (input.cwd !== undefined) updates.cwd = input.cwd ?? null;
    if (input.agentId !== undefined) updates.agentId = input.agentId ?? null;
    if (input.enabled !== undefined) updates.enabled = input.enabled;
    if (input.maxRuntime !== undefined) updates.maxRuntime = input.maxRuntime ?? null;
    if (input.permissionMode !== undefined) updates.permissionMode = input.permissionMode;
    if (input.status !== undefined) updates.status = input.status;
    if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);

    this.db.update(pulseSchedules).set(updates).where(eq(pulseSchedules.id, id)).run();

    return this.getTask(id);
  }

  /** Delete a task by ID. Returns true if found and deleted. */
  deleteTask(id: string): boolean {
    const result = this.db.delete(pulseSchedules).where(eq(pulseSchedules.id, id)).run();
    return result.changes > 0;
  }

  // === Run CRUD ===

  /** Create a new run record. Returns the created run. */
  createRun(taskId: string, trigger: TaskRunTrigger): TaskRun {
    const id = ulid();
    const now = new Date().toISOString();

    this.db
      .insert(pulseRuns)
      .values({
        id,
        scheduleId: taskId,
        status: 'running',
        startedAt: now,
        trigger,
        createdAt: now,
      })
      .run();

    return this.getRun(id)!;
  }

  /** Update fields on an existing run. Returns the updated run or null. */
  updateRun(id: string, update: RunUpdate): TaskRun | null {
    const existing = this.getRun(id);
    if (!existing) return null;

    this.db
      .update(pulseRuns)
      .set({
        status: update.status ?? existing.status,
        finishedAt: update.finishedAt ?? existing.finishedAt,
        durationMs: update.durationMs ?? existing.durationMs,
        output: update.outputSummary ?? existing.outputSummary,
        error: update.error ?? existing.error,
        sessionId: update.sessionId ?? existing.sessionId,
      })
      .where(eq(pulseRuns.id, id))
      .run();

    return this.getRun(id);
  }

  /** Get a single run by ID. */
  getRun(id: string): TaskRun | null {
    const row = this.db.select().from(pulseRuns).where(eq(pulseRuns.id, id)).get();
    return row ? mapRunRow(row) : null;
  }

  /** List runs with optional task/status filter and pagination. */
  listRuns(opts: ListRunsOptions = {}): TaskRun[] {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    const conditions = [];
    if (opts.taskId) {
      conditions.push(eq(pulseRuns.scheduleId, opts.taskId));
    }
    if (opts.status) {
      conditions.push(
        eq(pulseRuns.status, opts.status as (typeof pulseRuns.status.enumValues)[number])
      );
    }

    const query = this.db
      .select()
      .from(pulseRuns)
      .orderBy(desc(pulseRuns.createdAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      const rows = query.where(and(...conditions)).all();
      return rows.map(mapRunRow);
    }

    return query.all().map(mapRunRow);
  }

  /** Get all currently running runs. */
  getRunningRuns(): TaskRun[] {
    const rows = this.db.select().from(pulseRuns).where(eq(pulseRuns.status, 'running')).all();
    return rows.map(mapRunRow);
  }

  /** Count total runs, optionally filtered by task. */
  countRuns(taskId?: string): number {
    if (taskId) {
      const result = this.db
        .select({ count: count() })
        .from(pulseRuns)
        .where(eq(pulseRuns.scheduleId, taskId))
        .get();
      return result?.count ?? 0;
    }
    const result = this.db.select({ count: count() }).from(pulseRuns).get();
    return result?.count ?? 0;
  }

  /** Prune old runs, keeping only the most recent `retentionCount` per task. */
  pruneRuns(taskId: string, retentionCount: number): number {
    // Get the IDs to keep (most recent N runs for this task)
    const keepers = this.db
      .select({ id: pulseRuns.id })
      .from(pulseRuns)
      .where(eq(pulseRuns.scheduleId, taskId))
      .orderBy(desc(pulseRuns.createdAt))
      .limit(retentionCount)
      .all();

    const keeperIds = keepers.map((r) => r.id);

    if (keeperIds.length === 0) {
      // Delete all runs for this task
      const result = this.db.delete(pulseRuns).where(eq(pulseRuns.scheduleId, taskId)).run();
      return result.changes;
    }

    // Delete runs not in the keeper list
    const result = this.db
      .delete(pulseRuns)
      .where(and(eq(pulseRuns.scheduleId, taskId), notInArray(pulseRuns.id, keeperIds)))
      .run();
    return result.changes;
  }

  /** Mark all currently running runs as failed (used on startup for crash recovery). */
  markRunningAsFailed(): number {
    const now = new Date().toISOString();
    const result = this.db
      .update(pulseRuns)
      .set({
        status: 'failed',
        finishedAt: now,
        error: 'Interrupted by server restart',
      })
      .where(eq(pulseRuns.status, 'running'))
      .run();
    return result.changes;
  }

  /**
   * Disable all tasks linked to a specific agent ID.
   *
   * Sets enabled=0 and status='paused' for matching tasks that are currently enabled.
   * Used by the cascade-disable flow when an agent is unregistered from Mesh.
   *
   * @param agentId - The agent ULID whose linked tasks should be disabled
   * @returns The number of tasks that were disabled
   */
  disableTasksByAgentId(agentId: string): number {
    const now = new Date().toISOString();
    const result = this.db
      .update(pulseSchedules)
      .set({ enabled: false, status: 'paused', updatedAt: now })
      .where(and(eq(pulseSchedules.agentId, agentId), eq(pulseSchedules.enabled, true)))
      .run();
    return result.changes;
  }

  // === File-based task sync ===

  /**
   * Upsert a task from a parsed file definition.
   *
   * Looks up existing tasks by `filePath`. If found, updates in place.
   * If not found, inserts a new row with a fresh ULID.
   *
   * @param def - Parsed task definition from a `.md` file
   * @returns The upserted Task
   */
  upsertFromFile(def: TaskDefinition): Task {
    const now = new Date().toISOString();
    const maxRuntimeMs = def.meta.maxRuntime ? parseDuration(def.meta.maxRuntime) : null;

    // Check for existing task by filePath
    const existing = this.db
      .select()
      .from(pulseSchedules)
      .where(eq(pulseSchedules.filePath, def.filePath))
      .get();

    if (existing) {
      this.db
        .update(pulseSchedules)
        .set({
          name: def.meta.name,
          description: def.meta.description ?? null,
          prompt: def.prompt,
          cron: def.meta.cron ?? '',
          timezone: def.meta.timezone,
          cwd: def.meta.cwd ?? null,
          agentId: def.meta.agent ?? null,
          enabled: def.meta.enabled,
          maxRuntime: maxRuntimeMs,
          permissionMode: def.meta.permissions,
          tags: JSON.stringify(def.meta.tags),
          updatedAt: now,
        })
        .where(eq(pulseSchedules.id, existing.id))
        .run();
      return this.getTask(existing.id)!;
    }

    // Insert new task
    const id = ulid();
    this.db
      .insert(pulseSchedules)
      .values({
        id,
        name: def.meta.name,
        description: def.meta.description ?? null,
        prompt: def.prompt,
        cron: def.meta.cron ?? '',
        timezone: def.meta.timezone,
        cwd: def.meta.cwd ?? null,
        agentId: def.meta.agent ?? null,
        enabled: def.meta.enabled,
        maxRuntime: maxRuntimeMs,
        permissionMode: def.meta.permissions,
        status: 'active',
        filePath: def.filePath,
        tags: JSON.stringify(def.meta.tags),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return this.getTask(id)!;
  }

  /**
   * Mark a task as paused by its filename slug.
   *
   * Matches tasks whose `filePath` ends with `/{slug}.md`.
   * Used when a task file is removed from disk.
   *
   * @param slug - Kebab-case filename without extension
   * @returns The number of tasks marked as paused
   */
  markRemovedBySlug(slug: string): number {
    const now = new Date().toISOString();
    const result = this.db
      .update(pulseSchedules)
      .set({ enabled: false, status: 'paused', updatedAt: now })
      .where(like(pulseSchedules.filePath, `%/${slug}.md`))
      .run();
    return result.changes;
  }

  /**
   * Find a task by its filename slug.
   *
   * Matches tasks whose `filePath` ends with `/{slug}.md`.
   *
   * @param slug - Kebab-case filename without extension
   * @returns The matching Task or null
   */
  getBySlug(slug: string): Task | null {
    const row = this.db
      .select()
      .from(pulseSchedules)
      .where(like(pulseSchedules.filePath, `%/${slug}.md`))
      .get();
    return row ? mapTaskRow(row) : null;
  }

  /** Close the database connection. No-op since the shared Db lifecycle is managed externally. */
  close(): void {
    logger.debug('TaskStore: close() called (no-op — db lifecycle managed externally)');
  }
}

/** Convert a Drizzle schedule row to a Task object. */
function mapTaskRow(row: typeof pulseSchedules.$inferSelect): Task {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    cron: row.cron,
    timezone: row.timezone,
    cwd: row.cwd,
    agentId: row.agentId ?? null,
    enabled: row.enabled,
    maxRuntime: row.maxRuntime,
    permissionMode: row.permissionMode,
    status: row.status as Task['status'],
    filePath: row.filePath,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    nextRun: null,
  } as Task;
}

/** Convert a Drizzle run row to a TaskRun object. */
function mapRunRow(row: typeof pulseRuns.$inferSelect): TaskRun {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    status: row.status as TaskRunStatus,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs,
    outputSummary: row.output,
    error: row.error,
    sessionId: row.sessionId,
    trigger: row.trigger as TaskRunTrigger,
    createdAt: row.createdAt,
  };
}
