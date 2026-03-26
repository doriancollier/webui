import { PlaygroundPageLayout } from '../PlaygroundPageLayout';
import { TOPOLOGY_SECTIONS } from '../playground-registry';
import { TopologyShowcases } from '../showcases/TopologyShowcases';

/** Topology graph component showcase page for the dev playground. */
export function TopologyPage() {
  return (
    <PlaygroundPageLayout
      title="Topology Components"
      description="React Flow custom nodes, edges, and chrome used in the agent mesh topology graph."
      sections={TOPOLOGY_SECTIONS}
    >
      <TopologyShowcases />
    </PlaygroundPageLayout>
  );
}
