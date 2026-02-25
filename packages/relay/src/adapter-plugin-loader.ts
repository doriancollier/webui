/**
 * Dynamic adapter plugin loader.
 *
 * Loads RelayAdapter instances from three sources:
 * 1. Built-in adapters (from a provided factory map)
 * 2. npm packages (via dynamic import)
 * 3. Local file paths (via dynamic import with pathToFileURL)
 *
 * Loading errors are non-fatal — logs a warning and skips the failing adapter.
 *
 * @module relay/adapter-plugin-loader
 */
import { pathToFileURL } from 'node:url';
import { resolve, isAbsolute } from 'node:path';
import type { RelayAdapter } from './types.js';

/** Configuration entry for a single adapter to load. */
export interface PluginAdapterConfig {
  id: string;
  type: string;
  enabled?: boolean;
  builtin?: boolean;
  plugin?: { package?: string; path?: string };
  config: Record<string, unknown>;
}

/** Expected module shape from a plugin package. */
export interface AdapterPluginModule {
  default: (config: Record<string, unknown>) => RelayAdapter;
}

/**
 * Load adapter instances from config entries.
 *
 * Handles three sources:
 * 1. builtin: true — imported from built-in adapter map
 * 2. plugin.package — dynamic import(packageName)
 * 3. plugin.path — dynamic import(pathToFileURL(absolutePath))
 *
 * Loading errors are non-fatal — logs and skips.
 *
 * @param configs - Array of adapter configuration entries
 * @param builtinMap - Map of type string to factory function for built-in adapters
 * @param configDir - Base directory for resolving relative plugin paths
 * @returns Array of successfully loaded adapter instances
 */
export async function loadAdapters(
  configs: PluginAdapterConfig[],
  builtinMap: Map<string, (config: Record<string, unknown>) => RelayAdapter>,
  configDir: string,
): Promise<RelayAdapter[]> {
  const adapters: RelayAdapter[] = [];

  for (const entry of configs) {
    if (entry.enabled === false) continue;

    try {
      let adapter: RelayAdapter | null = null;

      if (entry.builtin && builtinMap.has(entry.type)) {
        // Built-in adapter from the provided factory map
        const factory = builtinMap.get(entry.type)!;
        adapter = factory(entry.config);
      } else if (entry.plugin?.package) {
        // npm package via dynamic import
        const mod = (await import(entry.plugin.package)) as AdapterPluginModule;
        adapter = validateAndCreate(mod, entry);
      } else if (entry.plugin?.path) {
        // Local file via dynamic import with pathToFileURL
        const absPath = isAbsolute(entry.plugin.path)
          ? entry.plugin.path
          : resolve(configDir, entry.plugin.path);
        const mod = (await import(pathToFileURL(absPath).href)) as AdapterPluginModule;
        adapter = validateAndCreate(mod, entry);
      }

      if (adapter) {
        adapters.push(adapter);
      }
    } catch (err) {
      // Non-fatal: log warning and continue loading remaining adapters
      console.warn(`[PluginLoader] Failed to load adapter '${entry.id}':`, err);
    }
  }

  return adapters;
}

/**
 * Duck-type validate and create adapter from a loaded module.
 *
 * @param mod - The dynamically imported module
 * @param entry - The config entry for error reporting
 * @returns A validated RelayAdapter instance
 * @throws If the module doesn't export a default factory function
 */
function validateAndCreate(
  mod: unknown,
  entry: PluginAdapterConfig,
): RelayAdapter {
  const m = mod as Record<string, unknown>;
  if (typeof m.default !== 'function') {
    throw new Error(
      `Module for '${entry.id}' does not export a default factory function`,
    );
  }
  const factory = m.default as (config: Record<string, unknown>) => RelayAdapter;
  const adapter = factory(entry.config);
  validateAdapterShape(adapter, entry.id);
  return adapter;
}

/**
 * Validate that an object implements the RelayAdapter interface shape.
 *
 * Uses duck-type checking to verify required properties and methods
 * exist without relying on TypeScript's structural typing at runtime.
 *
 * @param obj - The object to validate
 * @param id - The adapter ID for error messages
 * @throws If the object is missing required RelayAdapter members
 */
export function validateAdapterShape(
  obj: unknown,
  id: string,
): asserts obj is RelayAdapter {
  const a = obj as Record<string, unknown>;
  if (typeof a.id !== 'string')
    throw new Error(`Adapter '${id}': missing 'id' property`);
  if (typeof a.subjectPrefix !== 'string' && !Array.isArray(a.subjectPrefix))
    throw new Error(`Adapter '${id}': missing 'subjectPrefix'`);
  if (typeof a.displayName !== 'string')
    throw new Error(`Adapter '${id}': missing 'displayName'`);
  if (typeof a.start !== 'function')
    throw new Error(`Adapter '${id}': missing 'start()' method`);
  if (typeof a.stop !== 'function')
    throw new Error(`Adapter '${id}': missing 'stop()' method`);
  if (typeof a.deliver !== 'function')
    throw new Error(`Adapter '${id}': missing 'deliver()' method`);
  if (typeof a.getStatus !== 'function')
    throw new Error(`Adapter '${id}': missing 'getStatus()' method`);
}
