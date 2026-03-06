import type { AgentRuntime, RuntimeCapabilities } from '@dorkos/shared/agent-runtime';

/**
 * Registry of available agent runtimes, keyed by type string.
 *
 * Initialized at server startup with one or more runtime implementations.
 * Routes and services use `runtimeRegistry.getDefault()` to get the active runtime.
 * Future multi-runtime support can use `resolveForAgent()` to select per-agent.
 */
export class RuntimeRegistry {
  private runtimes = new Map<string, AgentRuntime>();
  private defaultType: string = 'claude-code';

  /**
   * Register a runtime implementation.
   *
   * @param runtime - The runtime to register. Replaces any existing registration for the same type.
   */
  register(runtime: AgentRuntime): void {
    this.runtimes.set(runtime.type, runtime);
  }

  /**
   * Get a runtime by type.
   *
   * @param type - The runtime type string (e.g. 'claude-code')
   * @throws If the type is not registered
   */
  get(type: string): AgentRuntime {
    const runtime = this.runtimes.get(type);
    if (!runtime) throw new Error(`Runtime '${type}' not registered`);
    return runtime;
  }

  /** Get the default runtime (claude-code unless changed via setDefault). */
  getDefault(): AgentRuntime {
    return this.get(this.defaultType);
  }

  /**
   * Resolve the runtime for a specific agent by looking up the agent manifest's runtime field.
   * Falls back to the default runtime if the agent has no runtime specified or meshCore is unavailable.
   *
   * @param agentId - The mesh agent ID to resolve runtime for
   * @param meshCore - Optional MeshCore instance for agent manifest lookup
   */
  resolveForAgent(
    agentId: string,
    meshCore?: { getAgent(id: string): { runtime?: string } | undefined }
  ): AgentRuntime {
    if (meshCore) {
      const agent = meshCore.getAgent(agentId);
      if (agent?.runtime) {
        const runtime = this.runtimes.get(agent.runtime);
        if (runtime) return runtime;
      }
    }
    return this.getDefault();
  }

  /**
   * Set the default runtime type.
   *
   * @param type - The runtime type to use as default
   * @throws If the type is not registered
   */
  setDefault(type: string): void {
    if (!this.runtimes.has(type)) throw new Error(`Runtime '${type}' not registered`);
    this.defaultType = type;
  }

  /** List all registered runtimes. */
  listRuntimes(): AgentRuntime[] {
    return Array.from(this.runtimes.values());
  }

  /** Get capabilities for all registered runtimes, keyed by type. */
  getAllCapabilities(): Record<string, RuntimeCapabilities> {
    const caps: Record<string, RuntimeCapabilities> = {};
    for (const [type, runtime] of this.runtimes) {
      caps[type] = runtime.getCapabilities();
    }
    return caps;
  }

  /**
   * Check if a runtime type is registered.
   *
   * @param type - The runtime type to check
   */
  has(type: string): boolean {
    return this.runtimes.has(type);
  }

  /** Get the current default runtime type string. */
  getDefaultType(): string {
    return this.defaultType;
  }
}

/** Singleton — initialized at server startup. */
export const runtimeRegistry = new RuntimeRegistry();
