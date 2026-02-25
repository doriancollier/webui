/**
 * Relay services — inter-agent messaging feature flag state, adapter lifecycle,
 * trace storage, and message dispatch.
 *
 * @module services/relay
 */
export { setRelayEnabled, isRelayEnabled } from './relay-state.js';
export { AdapterManager } from './adapter-manager.js';
export { TraceStore } from './trace-store.js';
export type { TraceStoreOptions, TraceSpanUpdate } from './trace-store.js';
