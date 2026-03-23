/**
 * Agent workspace creation service — shared pipeline for creating new agent
 * workspaces with scaffolded config files.
 *
 * Used by both the HTTP POST /api/agents/create endpoint and the MCP
 * `create_agent` tool. Extracts the full creation pipeline (mkdir, scaffold,
 * mesh sync) into a reusable service function.
 *
 * @module services/core/agent-creator
 */
import fs from 'fs/promises';
import path from 'path';
import { ulid } from 'ulidx';
import { writeManifest } from '@dorkos/shared/manifest';
import { CreateAgentOptionsSchema } from '@dorkos/shared/mesh-schemas';
import type { AgentManifest, CreateAgentOptions } from '@dorkos/shared/mesh-schemas';
import { defaultSoulTemplate, defaultNopeTemplate } from '@dorkos/shared/convention-files';
import { writeConventionFile } from '@dorkos/shared/convention-files-io';
import { renderTraits } from '@dorkos/shared/trait-renderer';
import { dorkbotClaudeMdTemplate } from '@dorkos/shared/dorkbot-templates';
import { validateBoundary, BoundaryError } from '../../lib/boundary.js';
import { configManager } from './config-manager.js';

/** Minimal MeshCore interface for sync-on-write. */
interface MeshCoreLike {
  syncFromDisk(projectPath: string): Promise<boolean>;
}

/** Error thrown when agent creation fails due to a known condition. */
export class AgentCreationError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION' | 'COLLISION' | 'BOUNDARY' | 'SCAFFOLD',
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AgentCreationError';
  }
}

/** Result of a successful agent creation. */
export interface AgentCreationResult {
  manifest: AgentManifest;
  path: string;
}

/**
 * Create a new agent workspace with scaffolded config files.
 *
 * Validates input, resolves directory, creates workspace directory, scaffolds
 * agent.json/SOUL.md/NOPE.md, and optionally syncs to Mesh DB. Rolls back
 * the created directory on scaffold failure.
 *
 * @param input - Raw input to validate with CreateAgentOptionsSchema
 * @param meshCore - Optional MeshCore instance for DB sync after creation
 * @returns The created agent manifest and resolved path
 * @throws AgentCreationError on validation, collision, or boundary failures
 */
export async function createAgentWorkspace(
  input: unknown,
  meshCore?: MeshCoreLike
): Promise<AgentCreationResult> {
  // Validate input
  const parseResult = CreateAgentOptionsSchema.safeParse(input);
  if (!parseResult.success) {
    const flat = parseResult.error.flatten();
    const messages = [
      ...Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`),
      ...flat.formErrors,
    ].join('; ');
    throw new AgentCreationError(messages || 'Validation failed', 'VALIDATION', 400);
  }

  const opts: CreateAgentOptions = parseResult.data;
  const agentsConfig = configManager.get('agents');
  const resolvedPath = opts.directory
    ? path.resolve(opts.directory)
    : path.resolve(agentsConfig.defaultDirectory.replace(/^~/, process.env.HOME || ''), opts.name);

  // Boundary validation
  try {
    await validateBoundary(resolvedPath);
  } catch (err) {
    if (err instanceof BoundaryError) {
      throw new AgentCreationError(err.message, 'BOUNDARY', 403);
    }
    throw err;
  }

  // Check collision — directory must not already exist
  try {
    await fs.stat(resolvedPath);
    throw new AgentCreationError('Directory already exists', 'COLLISION', 409);
  } catch (err: unknown) {
    if (err instanceof AgentCreationError) throw err;
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    // ENOENT is expected — directory doesn't exist yet
  }

  // Create parent directory (recursive) then agent directory (non-recursive)
  const parentDir = path.dirname(resolvedPath);
  await fs.mkdir(parentDir, { recursive: true });
  await fs.mkdir(resolvedPath);

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

    return { manifest, path: resolvedPath };
  } catch (scaffoldErr) {
    // Rollback: remove the created directory on scaffold failure
    if (!(scaffoldErr instanceof AgentCreationError)) {
      try {
        await fs.rm(resolvedPath, { recursive: true, force: true });
      } catch {
        /* best-effort cleanup */
      }
    }
    throw scaffoldErr;
  }
}
