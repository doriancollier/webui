/**
 * Agent identity routes -- always available, independent of Mesh.
 *
 * Provides CRUD for `.dork/agent.json` files via the shared manifest module.
 * All path parameters are boundary-validated.
 *
 * ADR-0043: when MeshCore is provided, POST and PATCH handlers call
 * `meshCore.syncFromDisk()` after writing the manifest to keep the
 * Mesh DB cache in sync without waiting for the 5-min reconciler.
 *
 * @module routes/agents
 */
import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { ulid } from 'ulidx';
import { readManifest, writeManifest } from '@dorkos/shared/manifest';
import {
  ResolveAgentsRequestSchema,
  CreateAgentRequestSchema,
  CreateAgentOptionsSchema,
  UpdateAgentRequestSchema,
  UpdateAgentConventionsSchema,
} from '@dorkos/shared/mesh-schemas';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';
import {
  buildSoulContent,
  defaultSoulTemplate,
  defaultNopeTemplate,
} from '@dorkos/shared/convention-files';
import { readConventionFile, writeConventionFile } from '@dorkos/shared/convention-files-io';
import { renderTraits, DEFAULT_TRAITS } from '@dorkos/shared/trait-renderer';
import { dorkbotClaudeMdTemplate } from '@dorkos/shared/dorkbot-templates';
import { validateBoundary, BoundaryError } from '../lib/boundary.js';
import { configManager } from '../services/core/config-manager.js';
import { logger } from '../lib/logger.js';

/**
 * Check whether a directory contains a package.json with post-install hooks.
 *
 * Detects `postinstall`, `setup`, and `prepare` scripts that the user
 * may need to run after template download.
 *
 * @param dir - Directory to check for package.json
 * @returns True if a post-install hook script is present
 */
async function checkForPostInstallHook(dir: string): Promise<boolean> {
  try {
    const pkgPath = path.join(dir, 'package.json');
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    return !!(pkg.scripts?.postinstall || pkg.scripts?.setup || pkg.scripts?.prepare);
  } catch {
    return false;
  }
}

/** Minimal MeshCore interface for sync-on-write. */
interface MeshCoreLike {
  syncFromDisk(projectPath: string): Promise<boolean>;
}

/**
 * Create the agents router for agent identity CRUD.
 *
 * @param meshCore - Optional MeshCore instance for DB sync after writes
 * @returns Express Router with agent identity endpoints
 */
export function createAgentsRouter(meshCore?: MeshCoreLike): Router {
  const router = Router();

  // GET /api/agents/current?path=/path/to/project
  // Returns the agent manifest for the given directory, or 404
  router.get('/current', async (req, res) => {
    try {
      const agentPath = req.query.path as string;
      if (!agentPath) {
        return res.status(400).json({ error: 'path query parameter required' });
      }
      await validateBoundary(agentPath);
      const manifest = await readManifest(agentPath);
      if (!manifest) {
        return res.status(404).json({ error: 'No agent registered at this path' });
      }

      // Include convention file contents alongside manifest data
      const soulContent = await readConventionFile(agentPath, 'SOUL.md');
      const nopeContent = await readConventionFile(agentPath, 'NOPE.md');

      return res.json({ ...manifest, soulContent, nopeContent });
    } catch (err) {
      if (err instanceof BoundaryError) {
        return res.status(403).json({ error: err.message, code: err.code });
      }
      logger.error('[agents] GET /current failed', { err });
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/agents/resolve
  // Batch resolve agents for multiple paths (avoids N+1 in DirectoryPicker)
  router.post('/resolve', async (req, res) => {
    try {
      const result = ResolveAgentsRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({ error: 'Validation failed', details: result.error.flatten() });
      }
      const agents: Record<string, AgentManifest | null> = {};
      await Promise.all(
        result.data.paths.map(async (p) => {
          try {
            await validateBoundary(p);
            agents[p] = await readManifest(p);
          } catch {
            agents[p] = null;
          }
        })
      );
      return res.json({ agents });
    } catch (err) {
      logger.error('[agents] POST /resolve failed', { err });
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/agents
  // Create a new agent (writes .dork/agent.json)
  router.post('/', async (req, res) => {
    try {
      const result = CreateAgentRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({ error: 'Validation failed', details: result.error.flatten() });
      }
      const { path: agentPath, name, description, runtime } = result.data;
      await validateBoundary(agentPath);

      // Check if agent already exists
      const existing = await readManifest(agentPath);
      if (existing) {
        return res
          .status(409)
          .json({ error: 'Agent already exists at this path', agent: existing });
      }

      const manifest: AgentManifest = {
        id: ulid(),
        name: name ?? path.basename(agentPath),
        description: description ?? '',
        runtime: runtime ?? 'claude-code',
        capabilities: [],
        behavior: { responseMode: 'always' },
        budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
        registeredAt: new Date().toISOString(),
        registeredBy: 'dorkos-ui',
        personaEnabled: true,
        enabledToolGroups: {},
      };

      await writeManifest(agentPath, manifest);

      // Scaffold convention files with sensible defaults
      const traitBlock = renderTraits(DEFAULT_TRAITS);
      const soulContent = defaultSoulTemplate(manifest.name ?? 'agent', traitBlock);
      const nopeContent = defaultNopeTemplate();

      await writeConventionFile(agentPath, 'SOUL.md', soulContent);
      await writeConventionFile(agentPath, 'NOPE.md', nopeContent);

      // ADR-0043: sync to Mesh DB cache (best-effort)
      try {
        await meshCore?.syncFromDisk(agentPath);
      } catch {
        /* non-fatal */
      }

      return res.status(201).json(manifest);
    } catch (err) {
      if (err instanceof BoundaryError) {
        return res.status(403).json({ error: err.message, code: err.code });
      }
      logger.error('[agents] POST / failed', { err });
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/agents/create
  // Full creation pipeline: mkdir + scaffold + optional template + register
  router.post('/create', async (req, res) => {
    try {
      const result = CreateAgentOptionsSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({ error: 'Validation failed', details: result.error.flatten() });
      }

      const opts = result.data;
      const agentsConfig = configManager.get('agents');
      const resolvedPath = opts.directory
        ? path.resolve(opts.directory)
        : path.resolve(
            agentsConfig.defaultDirectory.replace(/^~/, process.env.HOME || ''),
            opts.name
          );

      await validateBoundary(resolvedPath);

      // Check collision — 409 if directory already exists
      try {
        await fs.stat(resolvedPath);
        return res.status(409).json({ error: 'Directory already exists', path: resolvedPath });
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        // ENOENT is expected — directory doesn't exist yet
      }

      // Create parent directory (recursive) then agent directory (non-recursive)
      const parentDir = path.dirname(resolvedPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(resolvedPath);

      // Template download (git clone with giget fallback)
      let hasPostInstall = false;
      let templateMethod: string | undefined;

      if (opts.template) {
        try {
          const { downloadTemplate } = await import('../services/core/template-downloader.js');
          await downloadTemplate(opts.template, resolvedPath);
          templateMethod = 'git'; // downloadTemplate tries git first, giget fallback
          hasPostInstall = await checkForPostInstallHook(resolvedPath);
        } catch (templateErr) {
          // Rollback: remove the created directory on template failure
          try {
            await fs.rm(resolvedPath, { recursive: true, force: true });
          } catch {
            /* best-effort cleanup */
          }
          const message = templateErr instanceof Error ? templateErr.message : String(templateErr);
          return res.status(500).json({ error: `Template download failed: ${message}` });
        }
      }

      try {
        // Create .dork/ subdirectory
        const dorkDir = path.join(resolvedPath, '.dork');
        await fs.mkdir(dorkDir);

        // Scaffold agent.json
        const traits = opts.traits ?? {
          tone: 3,
          autonomy: 3,
          caution: 3,
          communication: 3,
          creativity: 3,
        };
        const conventions = opts.conventions ?? {
          soul: true,
          nope: true,
          dorkosKnowledge: true,
        };

        const manifest: AgentManifest = {
          id: ulid(),
          name: opts.name,
          description: opts.description ?? '',
          runtime: opts.runtime ?? 'claude-code',
          capabilities: [],
          behavior: { responseMode: 'always' },
          budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
          traits,
          conventions,
          registeredAt: new Date().toISOString(),
          registeredBy: 'dorkos-ui',
          personaEnabled: true,
          enabledToolGroups: {},
        };

        await writeManifest(resolvedPath, manifest);

        // Scaffold SOUL.md
        const traitBlock = renderTraits(traits);
        const soulContent = defaultSoulTemplate(manifest.name, traitBlock);
        await writeConventionFile(resolvedPath, 'SOUL.md', soulContent);

        // Scaffold NOPE.md
        const nopeContent = defaultNopeTemplate();
        await writeConventionFile(resolvedPath, 'NOPE.md', nopeContent);

        // DorkBot gets an additional CLAUDE.md
        if (opts.name === 'dorkbot') {
          const claudeMd = dorkbotClaudeMdTemplate();
          await fs.writeFile(path.join(dorkDir, 'CLAUDE.md'), claudeMd, 'utf-8');
        }

        // ADR-0043: sync to Mesh DB cache (best-effort)
        try {
          await meshCore?.syncFromDisk(resolvedPath);
        } catch {
          /* non-fatal */
        }

        // Auto-set as default agent when it's the first agent created
        try {
          const currentDefault = agentsConfig.defaultAgent;
          const defaultAgentDir = path.resolve(
            agentsConfig.defaultDirectory.replace(/^~/, process.env.HOME || ''),
            currentDefault
          );
          // If the current default agent directory doesn't exist, adopt the new agent
          await fs.stat(path.join(defaultAgentDir, '.dork', 'agent.json'));
        } catch {
          // Default agent doesn't exist on disk — adopt the newly created agent
          configManager.set('agents', { ...agentsConfig, defaultAgent: opts.name });
          logger.debug(`[agents] Auto-set default agent to "${opts.name}"`);
        }

        return res.status(201).json({
          ...manifest,
          ...(opts.template ? { _meta: { hasPostInstall, templateMethod } } : {}),
        });
      } catch (scaffoldErr) {
        // Rollback: remove the created directory on scaffold failure
        try {
          await fs.rm(resolvedPath, { recursive: true, force: true });
        } catch {
          /* best-effort cleanup */
        }
        throw scaffoldErr;
      }
    } catch (err) {
      if (err instanceof BoundaryError) {
        return res.status(403).json({ error: err.message, code: err.code });
      }
      logger.error('[agents] POST /create failed', { err });
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PATCH /api/agents/current?path=/path/to/project
  // Update agent fields by path
  router.patch('/current', async (req, res) => {
    try {
      const agentPath = req.query.path as string;
      if (!agentPath) {
        return res.status(400).json({ error: 'path query parameter required' });
      }
      await validateBoundary(agentPath);

      const result = UpdateAgentRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({ error: 'Validation failed', details: result.error.flatten() });
      }

      const existing = await readManifest(agentPath);
      if (!existing) {
        return res.status(404).json({ error: 'No agent registered at this path' });
      }

      // Write convention files if provided alongside manifest fields
      const conventionsResult = UpdateAgentConventionsSchema.safeParse(req.body);
      const conventionUpdates = conventionsResult.success ? conventionsResult.data : {};

      if (conventionUpdates.soulContent !== undefined) {
        await writeConventionFile(agentPath, 'SOUL.md', conventionUpdates.soulContent);
      }
      if (conventionUpdates.nopeContent !== undefined) {
        await writeConventionFile(agentPath, 'NOPE.md', conventionUpdates.nopeContent);
      }

      // traits and conventions go into agent.json via the manifest update
      const updated: AgentManifest = { ...existing, ...result.data };
      await writeManifest(agentPath, updated);

      // ADR-0043: sync to Mesh DB cache (best-effort)
      try {
        await meshCore?.syncFromDisk(agentPath);
      } catch {
        /* non-fatal */
      }

      return res.json(updated);
    } catch (err) {
      if (err instanceof BoundaryError) {
        return res.status(403).json({ error: err.message, code: err.code });
      }
      logger.error('[agents] PATCH /current failed', { err });
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/agents/current/migrate-persona?path=/path/to/project
  // Migrates legacy persona field to SOUL.md convention file
  router.post('/current/migrate-persona', async (req, res) => {
    try {
      const agentPath = req.query.path as string;
      if (!agentPath) {
        return res.status(400).json({ error: 'path query parameter required' });
      }
      await validateBoundary(agentPath);

      const manifest = await readManifest(agentPath);
      if (!manifest) {
        return res.status(404).json({ error: 'No agent registered at this path' });
      }

      // Check if already migrated
      const existingSoul = await readConventionFile(agentPath, 'SOUL.md');
      if (existingSoul) {
        return res.json({ migrated: false, reason: 'SOUL.md already exists' });
      }

      const { persona } = manifest as { persona?: string };
      if (!persona) {
        return res.json({ migrated: false, reason: 'No persona to migrate' });
      }

      // Migrate persona text to SOUL.md custom prose
      const traits = (manifest as { traits?: Record<string, number> }).traits;
      const traitBlock = renderTraits({ ...DEFAULT_TRAITS, ...traits });
      const soulContent = buildSoulContent(traitBlock, persona);
      await writeConventionFile(agentPath, 'SOUL.md', soulContent);

      // Scaffold NOPE.md if missing
      const existingNope = await readConventionFile(agentPath, 'NOPE.md');
      if (!existingNope) {
        await writeConventionFile(agentPath, 'NOPE.md', defaultNopeTemplate());
      }

      return res.json({ migrated: true });
    } catch (err) {
      if (err instanceof BoundaryError) {
        return res.status(403).json({ error: err.message, code: err.code });
      }
      logger.error('[agents] POST /current/migrate-persona failed', { err });
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
