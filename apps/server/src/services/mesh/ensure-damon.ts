import type { MeshCore } from '@dorkos/mesh';

/**
 * Ensure the Damon system agent is registered.
 * Idempotent — no-op if already registered.
 *
 * @param meshCore - MeshCore instance for agent registration
 * @param dorkHome - Resolved data directory path used as the project path
 */
export async function ensureDamon(meshCore: MeshCore, dorkHome: string): Promise<void> {
  const existing = meshCore.get('damon');
  if (existing) return;

  await meshCore.registerByPath(dorkHome, {
    id: 'damon',
    name: 'Damon',
    runtime: 'claude-code',
    namespace: 'system',
    isSystem: true,
    capabilities: ['tasks', 'summaries'],
    behavior: { responseMode: 'silent' },
    budget: { maxHopsPerMessage: 1, maxCallsPerHour: 20 },
  });
}
