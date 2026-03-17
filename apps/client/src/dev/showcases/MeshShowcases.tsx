import { Search } from 'lucide-react';
import { PlaygroundSection } from '../PlaygroundSection';
import { ShowcaseLabel } from '../ShowcaseLabel';
import { ShowcaseDemo } from '../ShowcaseDemo';
import { AgentCard } from '@/layers/features/mesh/ui/AgentCard';
import { MeshEmptyState, TopologyPreview } from '@/layers/features/mesh/ui/MeshEmptyState';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';

const AGENT_ONE: AgentManifest = {
  id: '01HQXYZ1234567890ABCDE',
  name: 'code-reviewer',
  description: 'Reviews pull requests and suggests improvements based on project conventions.',
  runtime: 'claude-code',
  capabilities: ['code-review', 'testing', 'documentation'],
  behavior: {
    responseMode: 'always',
    escalationThreshold: 0.8,
  },
  budget: {
    maxHopsPerMessage: 3,
    maxCallsPerHour: 60,
  },
  registeredAt: '2026-03-15T10:30:00Z',
  registeredBy: 'kai',
  personaEnabled: false,
  enabledToolGroups: {},
  icon: '🔍',
  color: '#6366f1',
};

const AGENT_TWO: AgentManifest = {
  id: '01HQXYZ1234567890FGHIJ',
  name: 'deploy-bot',
  description: 'Handles CI/CD pipeline orchestration and deployment verification.',
  runtime: 'cursor',
  capabilities: ['deployment', 'monitoring'],
  behavior: {
    responseMode: 'direct-only',
  },
  budget: {
    maxHopsPerMessage: 1,
    maxCallsPerHour: 30,
  },
  registeredAt: '2026-03-16T14:00:00Z',
  registeredBy: 'priya',
  personaEnabled: true,
  enabledToolGroups: {},
  icon: '🚀',
  color: '#f59e0b',
};

/** Mesh feature component showcases: AgentCard, MeshEmptyState. */
export function MeshShowcases() {
  return (
    <>
      <PlaygroundSection
        title="AgentCard"
        description="Agent manifest card with capabilities, budget, and actions."
      >
        <ShowcaseDemo>
          <div className="grid gap-4 sm:grid-cols-2">
            <AgentCard agent={AGENT_ONE} onEdit={() => {}} onUnregister={() => {}} />
            <AgentCard agent={AGENT_TWO} onEdit={() => {}} onUnregister={() => {}} />
          </div>
        </ShowcaseDemo>
      </PlaygroundSection>

      <PlaygroundSection
        title="MeshEmptyState"
        description="Empty state for the mesh panel with optional topology preview."
      >
        <ShowcaseLabel>With action CTA</ShowcaseLabel>
        <ShowcaseDemo>
          <MeshEmptyState
            icon={Search}
            headline="No agents discovered"
            description="Register an agent to start building your mesh network."
            action={{ label: 'Register Agent', onClick: () => {} }}
          />
        </ShowcaseDemo>

        <ShowcaseLabel>With topology preview</ShowcaseLabel>
        <ShowcaseDemo>
          <MeshEmptyState
            icon={Search}
            headline="No agents discovered"
            description="Register an agent to start building your mesh network."
            action={{ label: 'Register Agent', onClick: () => {} }}
            preview={<TopologyPreview />}
          />
        </ShowcaseDemo>
      </PlaygroundSection>
    </>
  );
}
