/**
 * Lightweight mesh feature state registry.
 *
 * Holds the runtime enabled/disabled state of the Mesh agent discovery subsystem
 * so that the config route can report it without a circular dependency on index.ts.
 * Set once during server startup by `index.ts` when MeshCore is initialized.
 *
 * @module services/mesh/mesh-state
 */
import { createFeatureFlag } from '../../lib/feature-flag.js';

const meshFlag = createFeatureFlag();

/** Mark the Mesh subsystem as enabled or disabled. */
export const setMeshEnabled = meshFlag.setEnabled;

/** Return whether the Mesh subsystem is currently enabled. */
export const isMeshEnabled = meshFlag.isEnabled;
