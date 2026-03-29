/**
 * Pulse scheduler routes — CRUD for schedules and runs.
 *
 * @module routes/pulse
 */
import { Router } from 'express';
import {
  CreateScheduleRequestSchema,
  UpdateScheduleRequestSchema,
  ListRunsQuerySchema,
} from '@dorkos/shared/schemas';
import type { MeshCore } from '@dorkos/mesh';
import type { PulseStore } from '../services/pulse/pulse-store.js';
import type { SchedulerService } from '../services/pulse/scheduler-service.js';
import type { ActivityService } from '../services/activity/activity-service.js';
import { loadPresets } from '../services/pulse/pulse-presets.js';
import { isWithinBoundary } from '../lib/boundary.js';
import { parseBody } from '../lib/route-utils.js';

/**
 * Create the Pulse router with schedule and run management endpoints.
 *
 * @param store - PulseStore for data persistence
 * @param scheduler - SchedulerService for cron management and dispatch
 * @param dorkHome - Resolved data directory path
 * @param meshCore - Optional MeshCore for validating agentId on create/update
 * @param activityService - Optional ActivityService for emitting activity events
 */
export function createPulseRouter(
  store: PulseStore,
  scheduler: SchedulerService,
  dorkHome: string,
  meshCore?: MeshCore,
  activityService?: ActivityService
): Router {
  const router = Router();

  // === Preset endpoints ===

  router.get('/presets', async (_req, res) => {
    const presets = await loadPresets(dorkHome);
    return res.json(presets);
  });

  // === Schedule endpoints ===

  router.get('/schedules', (_req, res) => {
    const schedules = store.getSchedules().map((s) => ({
      ...s,
      nextRun: scheduler.getNextRun(s.id)?.toISOString() ?? null,
    }));
    res.json(schedules);
  });

  router.post('/schedules', async (req, res) => {
    const data = parseBody(CreateScheduleRequestSchema, req.body, res);
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

    const schedule = store.createSchedule(data);
    if (schedule.enabled && schedule.status === 'active') {
      scheduler.registerSchedule(schedule);
    }

    activityService?.emit({
      actorType: 'user',
      actorLabel: 'You',
      category: 'pulse',
      eventType: 'pulse.schedule_created',
      resourceType: 'schedule',
      resourceId: schedule.id,
      resourceLabel: schedule.name,
      summary: `Created schedule ${schedule.name}`,
      linkPath: '/',
    });

    return res.status(201).json(schedule);
  });

  router.patch('/schedules/:id', async (req, res) => {
    const data = parseBody(UpdateScheduleRequestSchema, req.body, res);
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

    const updated = store.updateSchedule(req.params.id, data);
    if (!updated) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Re-register or unregister cron job based on new state
    if (updated.enabled && updated.status === 'active') {
      scheduler.registerSchedule(updated);
    } else {
      scheduler.unregisterSchedule(updated.id);
    }

    // Emit pause event when a schedule is disabled
    if (data.enabled === false && activityService) {
      activityService.emit({
        actorType: 'user',
        actorLabel: 'You',
        category: 'pulse',
        eventType: 'pulse.schedule_paused',
        resourceType: 'schedule',
        resourceId: req.params.id,
        resourceLabel: updated.name,
        summary: `Paused schedule ${updated.name}`,
        linkPath: '/',
      });
    }

    return res.json(updated);
  });

  router.delete('/schedules/:id', (_req, res) => {
    const { id } = _req.params;
    // Capture schedule name before deletion for the activity event
    const schedule = store.getSchedule(id);
    scheduler.unregisterSchedule(id);
    const deleted = store.deleteSchedule(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    activityService?.emit({
      actorType: 'user',
      actorLabel: 'You',
      category: 'pulse',
      eventType: 'pulse.schedule_deleted',
      resourceType: 'schedule',
      resourceId: id,
      resourceLabel: schedule?.name ?? id,
      summary: `Deleted schedule ${schedule?.name ?? id}`,
    });

    return res.json({ success: true });
  });

  router.post('/schedules/:id/trigger', async (_req, res) => {
    const run = await scheduler.triggerManualRun(_req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    return res.status(201).json({ runId: run.id });
  });

  // === Run endpoints ===

  router.get('/runs', (req, res) => {
    const data = parseBody(ListRunsQuerySchema, req.query, res);
    if (!data) return;

    const runs = store.listRuns({
      scheduleId: data.scheduleId,
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
      const schedule = store.getSchedule(run.scheduleId);
      activityService.emit({
        actorType: 'user',
        actorLabel: 'You',
        category: 'pulse',
        eventType: 'pulse.ran_cancelled',
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
