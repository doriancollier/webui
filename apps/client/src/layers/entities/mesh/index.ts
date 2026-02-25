/**
 * Mesh entity — domain hooks for mesh agent discovery and registry.
 *
 * @module entities/mesh
 */
export { useMeshEnabled } from './model/use-mesh-config';
export { useRegisteredAgents } from './model/use-mesh-agents';
export { useDiscoverAgents } from './model/use-mesh-discover';
export { useRegisterAgent } from './model/use-mesh-register';
export { useDenyAgent } from './model/use-mesh-deny';
export { useUnregisterAgent } from './model/use-mesh-unregister';
export { useUpdateAgent } from './model/use-mesh-update';
export { useDeniedAgents } from './model/use-mesh-denied';
