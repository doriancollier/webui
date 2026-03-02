/**
 * Tunnel entity — domain hooks for tunnel status and cross-tab/device sync.
 *
 * @module entities/tunnel
 */
export { useTunnelStatus } from './model/use-tunnel-status';
export { useTunnelSync, broadcastTunnelChange } from './model/use-tunnel-sync';
