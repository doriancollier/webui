/**
 * Tasks scheduler routes — CRUD for schedules and runs.
 *
 * @module routes/tasks
 */
import { Router } from 'express';
import {
  CreateTaskRequestSchema,
  UpdateTaskRequestSchema,
  ListTaskRunsQuerySchema,
} from '@dorkos/shared/schemas';
import type { MeshCore } from '@dorkos/mesh';
import type { TaskStore } from '../services/tasks/task-store.js';
import type { TaskSchedulerService } from '../services/tasks/task-scheduler-service.js';
import type { ActivityService } from '../services/activity/activity-service.js';
import { loadPresets } from '../services/tasks/task-presets.js';
import { isWithinBoundary } from '../lib/boundary.js';
import { parseBody } from '../lib/route-utils.js';

/**
 * Create the Tasks router with schedule and run management endpoints.
 *
 * @param store - TaskStore for data persistence
 * @param scheduler - TaskSchedulerService for cron management and dispatch
 * @param dorkHome - Resolved data directory path
 * @param meshCore - Optional MeshCore for validating agentId on create/update
 * @param activityService - Optional ActivityService for emitting activity events
 */
export function createTasksRouter(
  store: TaskStore,
  scheduler: TaskSchedulerService,
  dorkHome: string,
  meshCore?: MeshCore,
  activityService?: ActivityService
): Router {
  const router = Router();

  // === Preset endpoints ===

  router.get('/templates', async (_req, res) => {
    const templates = await loadPresets(dorkHome);
    return res.json(templates);
  });

  // === Schedule endpoints ===

  router.get('/', (_req, res) => {
    const schedules = store.getTasks().map((s) => ({
      ...s,
      nextRun: scheduler.getNextRun(s.id)?.toISOString() ?? null,
    }));
    res.json(schedules);
  });

  router.post('/', async (req, res) => {
    const data = parseBody(CreateTaskRequestSchema, req.body, res);
    if (!data) return;

    if (data.cwd) {
      const withinBoundary = await isWithinBoundary(data.cwd);
      if (!withinBoundary) {
        return res.status(403).json({ error: 'CWD outside directory boundary' });
      }
    }

    if (data.agentId && meshCore) {
      const agent = meshCore.get(data.agentId);
      if (!agent) {
        return res.status(400).json({ error: `Agent ${data.agentId} not found in registry` });
      }
    }

    const schedule = store.createTask(data);
    if (schedule.enabled && schedule.status === 'active') {
      scheduler.registerTask(schedule);
    }

    activityService?.emit({
      actorType: 'user',
      actorLabel: 'You',
      category: 'tasks',
      eventType: 'tasks.task_created',
      resourceType: 'schedule',
      resourceId: schedule.id,
      resourceLabel: schedule.name,
      summary: `Created schedule ${schedule.name}`,
      linkPath: '/',
    });

    return res.status(201).json(schedule);
  });

  router.patch('/:id', async (req, res) => {
    const data = parseBody(UpdateTaskRequestSchema, req.body, res);
    if (!data) return;

    if (data.cwd) {
      const withinBoundary = await isWithinBoundary(data.cwd);
      if (!withinBoundary) {
        return res.status(403).json({ error: 'CWD outside directory boundary' });
      }
    }

    if (data.agentId && meshCore) {
      const agent = meshCore.get(data.agentId);
      if (!agent) {
        return res.status(400).json({ error: `Agent ${data.agentId} not found in registry` });
      }
    }

    const updated = store.updateTask(req.params.id, data);
    if (!updated) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Re-register or unregister cron job based on new state
    if (updated.enabled && updated.status === 'active') {
      scheduler.registerTask(updated);
    } else {
      scheduler.unregisterTask(updated.id);
    }

    // Emit pause event when a schedule is disabled
    if (data.enabled === false && activityService) {
      activityService.emit({
        actorType: 'user',
        actorLabel: 'You',
        category: 'tasks',
        eventType: 'tasks.task_paused',
        resourceType: 'schedule',
        resourceId: req.params.id,
        resourceLabel: updated.name,
        summary: `Paused schedule ${updated.name}`,
        linkPath: '/',
      });
    }

    return res.json(updated);
  });

  router.delete('/:id', (_req, res) => {
    const { id } = _req.params;
    // Capture schedule name before deletion for the activity event
    const schedule = store.getTask(id);
    scheduler.unregisterTask(id);
    const deleted = store.deleteTask(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    activityService?.emit({
      actorType: 'user',
      actorLabel: 'You',
      category: 'tasks',
      eventType: 'tasks.task_deleted',
      resourceType: 'schedule',
      resourceId: id,
      resourceLabel: schedule?.name ?? id,
      summary: `Deleted schedule ${schedule?.name ?? id}`,
    });

    return res.json({ success: true });
  });

  router.post('/:id/trigger', async (_req, res) => {
    const run = await scheduler.triggerManualRun(_req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    return res.status(201).json({ runId: run.id });
  });

  // === Run endpoints ===

  router.get('/runs', (req, res) => {
    const data = parseBody(ListTaskRunsQuerySchema, req.query, res);
    if (!data) return;

    const runs = store.listRuns({
      taskId: data.scheduleId,
      status: data.status,
      limit: data.limit,
      offset: data.offset,
    });
    return res.json(runs);
  });

  router.get('/runs/:id', (req, res) => {
    const run = store.getRun(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(run);
  });

  router.post('/runs/:id/cancel', (req, res) => {
    const run = store.getRun(req.params.id);
    const cancelled = scheduler.cancelRun(req.params.id);
    if (!cancelled) {
      return res.status(404).json({ error: 'Run not found or not active' });
    }

    if (activityService && run) {
      const schedule = store.getTask(run.scheduleId);
      activityService.emit({
        actorType: 'user',
        actorLabel: 'You',
        category: 'tasks',
        eventType: 'tasks.run_cancelled',
        resourceType: 'schedule',
        resourceId: run.scheduleId,
        resourceLabel: schedule?.name ?? run.scheduleId,
        summary: `${schedule?.name ?? run.scheduleId} was cancelled`,
        linkPath: '/',
      });
    }

    return res.json({ success: true });
  });

  return router;
}
