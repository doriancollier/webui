/**
 * Activity feed routes — query paginated activity events.
 *
 * @module routes/activity
 */
import { Router } from 'express';
import { ListActivityQuerySchema } from '@dorkos/shared/activity-schemas';
import { parseBody } from '../lib/route-utils.js';
import type { ActivityService } from '../services/activity/activity-service.js';

/**
 * Create the activity router with the list endpoint.
 *
 * @param activityService - ActivityService instance for querying events
 */
export function createActivityRouter(activityService: ActivityService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parseBody(ListActivityQuerySchema, req.query, res);
    if (!query) return;

    const result = await activityService.list(query);
    return res.json(result);
  });

  return router;
}
