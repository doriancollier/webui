/**
 * Middleware that delegates `/api/ext/:id/*` requests to extension-registered Express routers.
 *
 * Each server-side extension registers an Express Router via ExtensionManager.
 * This middleware extracts the extension ID from the URL, looks up the router,
 * and delegates the request. If no router exists, it returns 404.
 *
 * @module middleware/extension-routes
 */
import type { Request, Response, NextFunction } from 'express';
import type { ExtensionManager } from '../services/extensions/extension-manager.js';

/**
 * Create middleware that delegates requests to extension-registered routers.
 *
 * Mount at `/api/ext/:id` so that `req.params.id` contains the extension identifier
 * and the remaining path is forwarded to the extension's router.
 *
 * @param extensionManager - ExtensionManager instance for router lookup
 */
export function createExtensionRoutesMiddleware(
  extensionManager: ExtensionManager
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id;
    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Missing extension ID' });
      return;
    }

    const router = extensionManager.getServerRouter(id);
    if (!router) {
      res.status(404).json({ error: `Extension '${id}' has no server routes` });
      return;
    }

    // Delegate to the extension's router
    router(req, res, next);
  };
}
