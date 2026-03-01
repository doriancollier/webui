import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiReference } from '@scalar/express-api-reference';
import sessionRoutes from './routes/sessions.js';
import commandRoutes from './routes/commands.js';
import healthRoutes from './routes/health.js';
import directoryRoutes from './routes/directory.js';
import configRoutes from './routes/config.js';
import fileRoutes from './routes/files.js';
import gitRoutes from './routes/git.js';
import tunnelRoutes from './routes/tunnel.js';
import modelRoutes from './routes/models.js';
import { createAgentsRouter } from './routes/agents.js';
import { generateOpenAPISpec } from './services/core/openapi-registry.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Build the CORS origin allowlist from env vars and common DorkOS ports. */
function buildCorsOrigin(): cors.CorsOptions['origin'] {
  const envOrigin = process.env.DORKOS_CORS_ORIGIN;

  // Explicit wildcard opt-in
  if (envOrigin === '*') return '*';

  // User-specified origins (comma-separated)
  if (envOrigin) {
    return envOrigin.split(',').map((o) => o.trim());
  }

  // Default: localhost on common DorkOS ports
  const port = process.env.DORKOS_PORT || '4242';
  const vitePort = process.env.VITE_PORT || '4241';
  return [
    `http://localhost:${port}`,
    `http://localhost:${vitePort}`,
    `http://127.0.0.1:${port}`,
    `http://127.0.0.1:${vitePort}`,
  ];
}

export function createApp() {
  const app = express();

  app.use(cors({ origin: buildCorsOrigin() }));

  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // API routes
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/commands', commandRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/directory', directoryRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/git', gitRoutes);
  app.use('/api/tunnel', tunnelRoutes);
  app.use('/api/models', modelRoutes);

  // Always mounted — not behind any feature flag
  app.use('/api/agents', createAgentsRouter());

  // OpenAPI spec + interactive docs
  const spec = generateOpenAPISpec();
  app.get('/api/openapi.json', (_req, res) => res.json(spec));
  app.use('/api/docs', apiReference({ content: spec }));

  return app;
}

/**
 * Finalize the Express app by adding the API 404 catch-all, error handler,
 * and production SPA serving. Must be called after all API routes are mounted.
 */
export function finalizeApp(app: express.Express): void {
  // API 404 -- must come after all /api routes, before SPA catch-all
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'API_NOT_FOUND' });
  });

  // Error handler (must be after routes)
  app.use(errorHandler);

  // In production, serve the built React app
  if (env.NODE_ENV === 'production') {
    const distPath = env.CLIENT_DIST_PATH ?? path.join(__dirname, '../../client/dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}
