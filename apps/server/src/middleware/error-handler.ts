import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error('[DorkOS Error]', err.message, err.stack);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: isDev ? (err.message || 'Internal Server Error') : 'Internal Server Error',
    code: 'INTERNAL_ERROR',
  });
}
