/**
 * Lightweight mesh feature state registry.
 *
 * Holds the runtime enabled/disabled state of the Mesh agent discovery subsystem
 * so that the config route can report it without a circular dependency on index.ts.
 * Set once during server startup by `index.ts` when MeshCore is initialized.
 *
 * @module services/mesh/mesh-state
 */

/** Mutable Mesh runtime state shared across the server process. */
const state = {
  enabled: false,
};

/**
 * Mark the Mesh subsystem as enabled.
 *
 * Called once from `index.ts` after `MeshCore` is successfully created.
 */
export function setMeshEnabled(enabled: boolean): void {
  state.enabled = enabled;
}

/**
 * Return whether the Mesh subsystem is currently enabled.
 *
 * Consumed by the config route to populate `mesh.enabled` in the GET response.
 */
export function isMeshEnabled(): boolean {
  return state.enabled;
}
