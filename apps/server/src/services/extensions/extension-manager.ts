import fs from 'fs/promises';
import { createRequire } from 'node:module';
import path from 'path';
import { Router } from 'express';
import type {
  ExtensionRecord,
  ExtensionRecordPublic,
  ExtensionPointId,
  ExtensionReadableState,
  ExtensionStatus,
} from '@dorkos/extension-api';
import { ExtensionDiscovery } from './extension-discovery.js';
import { ExtensionCompiler } from './extension-compiler.js';
import { createProxyRouter } from './extension-proxy.js';
import { createDataProviderContext } from './extension-server-api-factory.js';
import { configManager } from '../core/config-manager.js';
import {
  generateManifest,
  generateTemplate,
  generateServerTemplate,
} from './extension-templates.js';
import type { ExtensionTemplate } from './extension-templates.js';
import { logger } from '../../lib/logger.js';

const require = createRequire(import.meta.url);

/** Tracks an active server-side extension instance. */
interface ActiveServerExtension {
  extensionId: string;
  router: Router;
  cleanup: (() => void) | null;
  scheduledCleanups: Array<() => void>;
}

/** Result of creating a new extension. */
export interface CreateExtensionResult {
  id: string;
  path: string;
  scope: 'global' | 'local';
  template: string;
  status: ExtensionStatus;
  bundleReady: boolean;
  files: string[];
  error?: {
    code: string;
    message: string;
    errors?: Array<{
      text: string;
      location?: { file: string; line: number; column: number };
    }>;
  };
}

/** Result of reloading a single extension. */
export interface ReloadExtensionResult {
  id: string;
  status: ExtensionStatus;
  bundleReady: boolean;
  sourceHash?: string;
  error?: {
    code: string;
    message: string;
    errors?: Array<{
      text: string;
      location?: { file: string; line: number; column: number };
    }>;
  };
}

/** Result of headless extension testing via `testExtension()`. */
export interface TestExtensionResult {
  status: 'ok' | 'error';
  id: string;
  phase?: 'compilation' | 'activation';
  contributions?: Record<ExtensionPointId, number>;
  errors?: Array<{
    text: string;
    location?: { file: string; line: number; column: number };
  }>;
  error?: string;
  stack?: string;
  message?: string;
}

/** All known extension slot IDs for contribution counting. */
const ALL_EXTENSION_SLOTS: ExtensionPointId[] = [
  'dashboard.sections',
  'command-palette.items',
  'settings.tabs',
  'sidebar.footer',
  'sidebar.tabs',
  'header.actions',
  'dialog',
  'session.canvas',
];

/**
 * Lightweight ExtensionAPI stub for headless server-side testing.
 * Implements all methods as no-ops while counting registrations per slot.
 *
 * @internal Exported for testing only.
 */
export class MockExtensionAPI {
  readonly id: string;
  private counts: Record<string, number> = {};

  constructor(id: string) {
    this.id = id;
  }

  /** Register a component in a UI slot (counted, returns cleanup no-op). */
  registerComponent(slot: ExtensionPointId, _id: string, _component: unknown): () => void {
    this.counts[slot] = (this.counts[slot] ?? 0) + 1;
    return () => {};
  }

  /** Register a command palette item (counted, returns cleanup no-op). */
  registerCommand(_id: string, _label: string, _callback: () => void): () => void {
    this.counts['command-palette.items'] = (this.counts['command-palette.items'] ?? 0) + 1;
    return () => {};
  }

  /** Register a dialog component (counted, returns open/close no-ops). */
  registerDialog(_id: string, _component: unknown): { open: () => void; close: () => void } {
    this.counts['dialog'] = (this.counts['dialog'] ?? 0) + 1;
    return { open: () => {}, close: () => {} };
  }

  /** Register a settings tab (counted, returns cleanup no-op). */
  registerSettingsTab(_id: string, _label: string, _component: unknown): () => void {
    this.counts['settings.tabs'] = (this.counts['settings.tabs'] ?? 0) + 1;
    return () => {};
  }

  /** No-op: UI command execution. */
  executeCommand(): void {}

  /** No-op: canvas opening. */
  openCanvas(): void {}

  /** No-op: client-side navigation. */
  navigate(): void {}

  /** Returns stub state with all nulls. */
  getState(): ExtensionReadableState {
    return { currentCwd: null, activeSessionId: null, agentId: null };
  }

  /** No-op: state subscription. */
  subscribe(): () => void {
    return () => {};
  }

  /** No-op: returns null (no persisted data). */
  async loadData(): Promise<null> {
    return null;
  }

  /** No-op: data persistence. */
  async saveData(): Promise<void> {}

  /** No-op: toast notification. */
  notify(): void {}

  /** Returns true (all slots available in test context). */
  isSlotAvailable(): boolean {
    return true;
  }

  /** Return registration counts for all known slots (zero for unused). */
  getContributions(): Record<ExtensionPointId, number> {
    return Object.fromEntries(
      ALL_EXTENSION_SLOTS.map((slot) => [slot, this.counts[slot] ?? 0])
    ) as Record<ExtensionPointId, number>;
  }
}

/** Strip server-internal fields from ExtensionRecord for client consumption. */
function toPublic(record: ExtensionRecord): ExtensionRecordPublic {
  return {
    id: record.id,
    manifest: record.manifest,
    status: record.status,
    scope: record.scope,
    error: record.error,
    bundleReady: record.bundleReady,
    hasServerEntry: record.hasServerEntry,
    hasDataProxy: record.hasDataProxy,
  };
}

/**
 * Orchestrates the extension lifecycle by combining discovery, compilation,
 * and enable/disable persistence via ConfigManager.
 *
 * Acts as the facade for the extension system — routes, middleware, and other
 * services interact with extensions exclusively through this class.
 */
export class ExtensionManager {
  private dorkHome: string;
  private discovery: ExtensionDiscovery;
  private compiler: ExtensionCompiler;
  private extensions: Map<string, ExtensionRecord> = new Map();
  private serverExtensions: Map<string, ActiveServerExtension> = new Map();
  private currentCwd: string | null = null;

  constructor(dorkHome: string) {
    this.dorkHome = dorkHome;
    this.discovery = new ExtensionDiscovery(dorkHome);
    this.compiler = new ExtensionCompiler(dorkHome);
  }

  /**
   * Initialize the extension system: clean stale cache, discover, and compile.
   *
   * @param cwd - Current working directory (null if none active)
   */
  async initialize(cwd: string | null): Promise<void> {
    this.currentCwd = cwd;

    // Clean stale cache entries on startup
    await this.compiler.cleanStaleCache();

    // Discover all extensions and compile enabled ones
    await this.reload();

    // Initialize server-side extensions (server entry or proxy-only) for compiled extensions
    for (const record of this.extensions.values()) {
      const needsServer =
        (record.hasServerEntry || record.hasDataProxy) &&
        ['compiled', 'active'].includes(record.status);
      if (needsServer) {
        const result = await this.initializeServer(record.id);
        if (!result.ok) {
          logger.warn(`[Extensions] Server init skipped for ${record.id}: ${result.error}`);
        }
      }
    }
  }

  /**
   * Re-scan filesystem and recompile changed extensions.
   * Called on startup, after CWD change, or via POST /api/extensions/reload.
   */
  async reload(): Promise<ExtensionRecordPublic[]> {
    const enabledIds = configManager.get('extensions').enabled;
    const records = await this.discovery.discover(this.currentCwd, enabledIds);

    // Clear existing extensions and re-populate
    this.extensions.clear();
    for (const rec of records) {
      this.extensions.set(rec.id, rec);
    }

    // Compile all enabled extensions
    await this.compileEnabled();

    return this.listPublic();
  }

  /**
   * Reload a single extension: recompile and update its record.
   * Used for per-extension hot reload when the agent edits one extension.
   *
   * @param id - Extension identifier
   * @returns Structured reload result for the single extension
   */
  async reloadExtension(id: string): Promise<ReloadExtensionResult> {
    const record = this.extensions.get(id);
    if (!record) {
      throw new Error(`Extension '${id}' not found`);
    }

    // Recompile the extension
    const compileResult = await this.compiler.compile(record);

    if ('error' in compileResult) {
      record.status = 'compile_error';
      record.error = {
        code: compileResult.error.code,
        message: compileResult.error.message,
        details: compileResult.error.errors.map((e) => e.text).join('\n'),
      };
      record.sourceHash = compileResult.sourceHash;
      record.bundleReady = false;

      return {
        id,
        status: 'compile_error',
        bundleReady: false,
        sourceHash: compileResult.sourceHash,
        error: {
          code: compileResult.error.code,
          message: compileResult.error.message,
          errors: compileResult.error.errors,
        },
      };
    }

    // Compilation succeeded
    record.status = 'compiled';
    record.sourceHash = compileResult.sourceHash;
    record.bundleReady = true;
    record.error = undefined;

    // Re-initialize server-side extension if it has a server entry or data proxy
    if (record.hasServerEntry || record.hasDataProxy) {
      await this.shutdownServer(id);
      const serverResult = await this.initializeServer(id);
      if (!serverResult.ok) {
        logger.warn(`[Extensions] Server reload failed for ${id}: ${serverResult.error}`);
      }
    }

    return {
      id,
      status: 'compiled',
      bundleReady: true,
      sourceHash: compileResult.sourceHash,
    };
  }

  /**
   * Compile an extension and activate it against a mock API to verify
   * it loads without errors. Returns the contribution counts per slot.
   *
   * @param id - Extension identifier
   * @returns Test result with contribution counts or error details
   */
  async testExtension(id: string): Promise<TestExtensionResult> {
    const record = this.extensions.get(id);
    if (!record) {
      throw new Error(`Extension '${id}' not found`);
    }

    // Step 1: Compile
    const compileResult = await this.compiler.compile(record);
    if ('error' in compileResult) {
      return {
        status: 'error',
        id,
        phase: 'compilation',
        errors: compileResult.error.errors,
      };
    }

    // Step 2: Read the compiled bundle
    const bundle = await this.compiler.readBundle(id, compileResult.sourceHash);
    if (!bundle) {
      return {
        status: 'error',
        id,
        phase: 'compilation',
        error: 'Compiled bundle not found in cache',
      };
    }

    // Step 3: Evaluate the bundle and extract activate()
    try {
      const dataUri = `data:text/javascript;base64,${Buffer.from(bundle).toString('base64')}`;
      const module = await import(/* webpackIgnore: true */ dataUri);

      if (typeof module.activate !== 'function') {
        return {
          status: 'error',
          id,
          phase: 'activation',
          error: 'Extension does not export an activate() function',
        };
      }

      // Step 4: Activate against mock API
      const mockApi = new MockExtensionAPI(id);
      module.activate(mockApi);

      const contributions = mockApi.getContributions();
      const totalContributions = Object.values(contributions).reduce(
        (sum, count) => sum + count,
        0
      );

      logger.info(
        `[Extensions] Test passed for ${id}: ${totalContributions} contribution(s) registered`
      );

      return {
        status: 'ok',
        id,
        contributions,
        message: `Extension activated successfully. Registered ${totalContributions} contribution(s).`,
      };
    } catch (err) {
      return {
        status: 'error',
        id,
        phase: 'activation',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      };
    }
  }

  /**
   * Test server-side compilation for an extension without loading it.
   *
   * Compiles the server.ts entry point and reports success or failure.
   * Used by the MCP test_extension tool to verify server-side code.
   *
   * @param id - Extension identifier
   * @returns Status string describing the result, or null if no server entry
   */
  async testServerCompilation(id: string): Promise<string | null> {
    const record = this.extensions.get(id);
    if (!record || !record.hasServerEntry) return null;

    try {
      const result = await this.compiler.compileServer(record);
      if ('error' in result) {
        return `Server compilation failed: ${result.error.message}`;
      }
      return 'Server compilation successful';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Server compilation failed: ${message}`;
    }
  }

  /**
   * Scaffold a new extension directory with manifest and starter code.
   *
   * @param options - Creation parameters
   * @returns Created extension info including compilation result
   */
  async createExtension(options: {
    name: string;
    description?: string;
    template: ExtensionTemplate;
    scope: 'global' | 'local';
  }): Promise<CreateExtensionResult> {
    const { name, description, template, scope } = options;

    // 1. Resolve target directory
    let targetDir: string;
    if (scope === 'local') {
      if (!this.currentCwd) {
        throw new Error('Cannot create local extension: no working directory is active');
      }
      targetDir = path.join(this.currentCwd, '.dork', 'extensions', name);
    } else {
      targetDir = path.join(this.dorkHome, 'extensions', name);
    }

    // 2. Check directory does not exist
    try {
      await fs.access(targetDir);
      throw new Error(`Extension '${name}' already exists at ${targetDir}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) throw err;
      // ENOENT is expected — directory doesn't exist yet
    }

    // 3. Create directory
    await fs.mkdir(targetDir, { recursive: true });

    // 4. Write extension.json
    const manifest = generateManifest(name, description, template);
    await fs.writeFile(
      path.join(targetDir, 'extension.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // 5. Write index.ts from template
    const indexContent = generateTemplate(name, description ?? '', template);
    await fs.writeFile(path.join(targetDir, 'index.ts'), indexContent, 'utf-8');

    // 6. Write server.ts for data-provider template
    const files = ['extension.json', 'index.ts'];
    if (template === 'data-provider') {
      const serverContent = generateServerTemplate(name, description ?? '');
      await fs.writeFile(path.join(targetDir, 'server.ts'), serverContent, 'utf-8');
      files.push('server.ts');
    }

    // 7. Reload to discover the new extension
    await this.reload();

    // 8. Enable (compile + add to config)
    await this.enable(name);

    // 9. Build result
    const record = this.extensions.get(name);
    const result: CreateExtensionResult = {
      id: name,
      path: targetDir,
      scope,
      template,
      status: record?.status ?? 'compile_error',
      bundleReady: record?.bundleReady ?? false,
      files,
    };

    if (record?.error) {
      result.error = {
        code: record.error.code,
        message: record.error.message,
        ...(record.error.details && {
          errors: record.error.details.split('\n').map((text) => ({ text })),
        }),
      };
    }

    return result;
  }

  /**
   * Get all extensions as public records (for API responses).
   */
  listPublic(): ExtensionRecordPublic[] {
    return Array.from(this.extensions.values()).map(toPublic);
  }

  /**
   * Get a single extension by ID.
   */
  get(id: string): ExtensionRecord | undefined {
    return this.extensions.get(id);
  }

  /**
   * Enable an extension: add to config, trigger compilation.
   *
   * @param id - Extension identifier
   * @returns Updated public record and reload flag, or null if not found / not enableable
   */
  async enable(
    id: string
  ): Promise<{ extension: ExtensionRecordPublic; reloadRequired: boolean } | null> {
    const record = this.extensions.get(id);
    if (!record) return null;

    // Reject if incompatible or invalid
    if (record.status === 'incompatible' || record.status === 'invalid') {
      return null;
    }

    // Trigger compilation before persisting to config — only persist on success
    record.status = 'enabled';
    const compileResult = await this.compiler.compile(record);

    if ('error' in compileResult) {
      record.status = 'compile_error';
      record.error = {
        code: compileResult.error.code,
        message: compileResult.error.message,
        details: compileResult.error.errors.map((e) => e.text).join('\n'),
      };
      record.sourceHash = compileResult.sourceHash;
      record.bundleReady = false;
      // Do NOT persist to config — compilation failed
    } else {
      record.status = 'compiled';
      record.sourceHash = compileResult.sourceHash;
      record.bundleReady = true;
      record.error = undefined;

      // Only persist to config on successful compilation
      const config = configManager.get('extensions');
      if (!config.enabled.includes(id)) {
        configManager.set('extensions', {
          enabled: [...config.enabled, id],
        });
      }

      // Initialize server-side extension if it has a server entry or data proxy
      if (record.hasServerEntry || record.hasDataProxy) {
        const serverResult = await this.initializeServer(id);
        if (!serverResult.ok) {
          logger.warn(`[Extensions] Server init failed for ${id}: ${serverResult.error}`);
        }
      }
    }

    return { extension: toPublic(record), reloadRequired: true };
  }

  /**
   * Disable an extension: remove from config.
   *
   * @param id - Extension identifier
   * @returns Updated public record and reload flag, or null if not found
   */
  async disable(
    id: string
  ): Promise<{ extension: ExtensionRecordPublic; reloadRequired: boolean } | null> {
    const record = this.extensions.get(id);
    if (!record) return null;

    // Shut down server-side extension before disabling
    await this.shutdownServer(id);

    // Remove from enabled list in config
    const config = configManager.get('extensions');
    configManager.set('extensions', {
      enabled: config.enabled.filter((eid: string) => eid !== id),
    });

    record.status = 'disabled';
    record.bundleReady = false;
    record.error = undefined;

    return { extension: toPublic(record), reloadRequired: true };
  }

  /**
   * Initialize server-side extension code: compile, load, and register routes.
   *
   * @param id - Extension identifier
   * @returns Result with ok flag and optional error message
   */
  async initializeServer(id: string): Promise<{ ok: boolean; error?: string }> {
    const record = this.extensions.get(id);
    if (!record) return { ok: false, error: 'Extension not found' };

    const hasServerCapability = record.hasServerEntry || record.hasDataProxy;
    if (!hasServerCapability || !['enabled', 'compiled', 'active'].includes(record.status)) {
      return { ok: false, error: 'Extension has no server entry or is not enabled' };
    }

    // Shut down existing server instance if reloading
    await this.shutdownServer(id);

    // Proxy-only extensions (dataProxy without server.ts) — no compilation needed
    if (record.hasDataProxy && !record.hasServerEntry) {
      const proxyRouter = createProxyRouter(id, record.manifest.dataProxy!, this.dorkHome);
      this.serverExtensions.set(id, {
        extensionId: id,
        router: proxyRouter,
        cleanup: null,
        scheduledCleanups: [],
      });
      logger.info(`[Extensions] Proxy router mounted for ${id}`);
      return { ok: true };
    }

    // Compile server bundle
    const compiled = await this.compiler.compileServer(record);
    if ('error' in compiled) {
      return { ok: false, error: compiled.error.message };
    }

    // Write temp file for require()
    const tempDir = path.join(this.dorkHome, 'cache', 'extensions', 'server', '_run');
    await fs.mkdir(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `${id}.js`);
    await fs.writeFile(tempFile, compiled.code, 'utf-8');

    try {
      // Clear require cache for hot-reload
      delete require.cache[require.resolve(tempFile)];
    } catch {
      // Not in cache yet
    }

    try {
      const mod = require(tempFile);
      const registerFn = mod.default ?? mod;
      if (typeof registerFn !== 'function') {
        return { ok: false, error: 'Server entry does not export a register function' };
      }

      const router = Router();
      const { ctx, getScheduledCleanups } = createDataProviderContext({
        extensionId: id,
        extensionDir: record.path,
        dorkHome: this.dorkHome,
      });

      const result = await registerFn(router, ctx);
      const cleanup = typeof result === 'function' ? result : null;

      // If extension also has dataProxy, mount proxy routes alongside custom routes
      if (record.hasDataProxy && record.manifest.dataProxy) {
        const proxyRouter = createProxyRouter(id, record.manifest.dataProxy, this.dorkHome);
        router.use(proxyRouter);
      }

      this.serverExtensions.set(id, {
        extensionId: id,
        router,
        cleanup,
        scheduledCleanups: getScheduledCleanups(),
      });

      logger.info(`[Extensions] Server initialized for ${id}`);
      return { ok: true };
    } catch (err) {
      logger.error(`[Extensions] Server init failed for ${id}:`, err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Shut down a server-side extension: cancel scheduled tasks, call cleanup, remove router.
   *
   * @param id - Extension identifier
   */
  async shutdownServer(id: string): Promise<void> {
    const active = this.serverExtensions.get(id);
    if (!active) return;

    // Cancel all scheduled tasks
    for (const cancel of active.scheduledCleanups) {
      try {
        cancel();
      } catch {
        /* swallow cancellation errors */
      }
    }

    // Call extension's cleanup function
    if (active.cleanup) {
      try {
        active.cleanup();
      } catch (err) {
        logger.warn(`[Extensions] Cleanup error for ${id}:`, err);
      }
    }

    this.serverExtensions.delete(id);
    logger.info(`[Extensions] Server shutdown for ${id}`);
  }

  /**
   * Get the Express router for a server-side extension (used by route delegation).
   *
   * @param id - Extension identifier
   * @returns The extension's router, or null if no server extension is active
   */
  getServerRouter(id: string): Router | null {
    return this.serverExtensions.get(id)?.router ?? null;
  }

  /**
   * Read a compiled bundle for serving to the client.
   *
   * @param id - Extension identifier
   * @returns Compiled JS string, or null if not available
   */
  async readBundle(id: string): Promise<string | null> {
    const record = this.extensions.get(id);
    if (!record) return null;
    if (record.status !== 'compiled' && record.status !== 'active') return null;
    if (!record.sourceHash) return null;

    return this.compiler.readBundle(id, record.sourceHash);
  }

  /**
   * Report that a client has activated an extension.
   *
   * @param id - Extension identifier
   */
  reportActivated(id: string): void {
    const record = this.extensions.get(id);
    if (record && record.status === 'compiled') {
      record.status = 'active';
    }
  }

  /**
   * Report that activation failed for an extension.
   *
   * @param id - Extension identifier
   * @param error - Error message from the client
   */
  reportActivateError(id: string, error: string): void {
    const record = this.extensions.get(id);
    if (record) {
      record.status = 'activate_error';
      record.error = { code: 'activate_error', message: error };
    }
  }

  /**
   * Update the CWD and return the diff of extension IDs (added/removed).
   *
   * @param newCwd - New working directory (null to clear)
   * @returns Object with arrays of added and removed extension IDs
   */
  async updateCwd(newCwd: string | null): Promise<{ added: string[]; removed: string[] }> {
    const oldIds = new Set(this.extensions.keys());
    this.currentCwd = newCwd;
    await this.reload();
    const newIds = new Set(this.extensions.keys());

    const added = [...newIds].filter((id) => !oldIds.has(id));
    const removed = [...oldIds].filter((id) => !newIds.has(id));

    return { added, removed };
  }

  /** Compile all enabled extensions, updating their records with results. */
  private async compileEnabled(): Promise<void> {
    const enabled = Array.from(this.extensions.values()).filter((r) => r.status === 'enabled');

    for (const record of enabled) {
      const result = await this.compiler.compile(record);
      if ('error' in result) {
        record.status = 'compile_error';
        record.error = {
          code: result.error.code,
          message: result.error.message,
          details: result.error.errors.map((e) => e.text).join('\n'),
        };
        record.sourceHash = result.sourceHash;
        record.bundleReady = false;
      } else {
        record.status = 'compiled';
        record.sourceHash = result.sourceHash;
        record.bundleReady = true;
        record.error = undefined;
      }
    }
  }
}
