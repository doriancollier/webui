import type { PlaygroundSection } from '../playground-registry';

/**
 * Topology graph component sections from TopologyPage.
 *
 * Sources: TopologyShowcases (AgentNode, AdapterNode, NamespaceGroupNode, edges, legend).
 */
export const TOPOLOGY_SECTIONS: PlaygroundSection[] = [
  {
    id: 'agentnode',
    title: 'AgentNode',
    page: 'topology',
    category: 'Nodes',
    keywords: ['agent', 'node', 'lod', 'compact', 'expanded', 'health', 'status', 'topology'],
  },
  {
    id: 'adapternode',
    title: 'AdapterNode',
    page: 'topology',
    category: 'Nodes',
    keywords: ['adapter', 'node', 'relay', 'ghost', 'platform', 'binding', 'topology'],
  },
  {
    id: 'namespacegroupnode',
    title: 'NamespaceGroupNode',
    page: 'topology',
    category: 'Nodes',
    keywords: ['namespace', 'group', 'container', 'compound', 'color', 'topology'],
  },
  {
    id: 'edge-styles',
    title: 'Edge Styles',
    page: 'topology',
    category: 'Edges',
    keywords: ['edge', 'binding', 'cross-namespace', 'deny', 'allow', 'line', 'topology'],
  },
  {
    id: 'topologylegend',
    title: 'TopologyLegend',
    page: 'topology',
    category: 'Chrome',
    keywords: ['legend', 'key', 'status', 'indicator', 'namespace', 'color', 'topology'],
  },
];
