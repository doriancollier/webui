/**
 * Discovery services — filesystem scanning for AI-configured projects.
 *
 * @module services/discovery
 */
export { scanForAgents, AGENT_MARKERS, DEFAULT_EXCLUDE_PATTERNS } from './discovery-scanner.js';
export type {
  DiscoveryCandidate,
  ScanProgress,
  ScanOptions,
  ScanEvent,
} from './discovery-scanner.js';
