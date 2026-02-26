import { lazy, Suspense, useState } from 'react';
import { Loader2, Network, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/layers/shared/ui';
import { Badge } from '@/layers/shared/ui/badge';
import {
  useMeshEnabled,
  useRegisteredAgents,
  useDeniedAgents,
  useUnregisterAgent,
} from '@/layers/entities/mesh';
import type { AgentManifest, DenialRecord } from '@dorkos/shared/mesh-schemas';
import { MeshStatsHeader } from './MeshStatsHeader';
import { AgentHealthDetail } from './AgentHealthDetail';
import { TopologyPanel } from './TopologyPanel';
import { DiscoveryView } from './DiscoveryView';
import { MeshEmptyState } from './MeshEmptyState';

const LazyTopologyGraph = lazy(() =>
  import('./TopologyGraph').then((m) => ({ default: m.TopologyGraph })),
);

// -- Agents Tab --

interface AgentsTabProps {
  agents: AgentManifest[];
  isLoading: boolean;
  onGoToDiscovery: () => void;
}

function AgentsTab({ agents, isLoading, onGoToDiscovery }: AgentsTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <MeshEmptyState
        icon={Network}
        headline="No agents registered yet"
        description="Discover agents in your filesystem and register them to the mesh."
        action={{ label: 'Go to Discovery', onClick: onGoToDiscovery }}
      />
    );
  }

  return (
    <div className="space-y-2 p-4">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentManifest }) {
  const { mutate: unregister } = useUnregisterAgent();

  return (
    <div className="space-y-1 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{agent.name}</p>
          <Badge variant="secondary">{agent.runtime}</Badge>
        </div>
        <button
          type="button"
          onClick={() => unregister(agent.id)}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Unregister ${agent.name}`}
        >
          <X className="size-3.5" />
        </button>
      </div>
      {agent.description && (
        <p className="text-xs text-muted-foreground">{agent.description}</p>
      )}
      {agent.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {agent.capabilities.map((cap) => (
            <Badge key={cap} variant="outline" className="text-xs">
              {cap}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Denied Tab --

interface DeniedTabProps {
  denied: DenialRecord[];
  isLoading: boolean;
}

function DeniedTab({ denied, isLoading }: DeniedTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (denied.length === 0) {
    return (
      <MeshEmptyState
        icon={ShieldCheck}
        headline="No blocked paths"
        description="When you deny agent paths during discovery, they appear here. This is a healthy state."
      />
    );
  }

  return (
    <div className="space-y-2 p-4">
      {denied.map((d) => (
        <div key={d.path} className="flex items-center justify-between rounded-xl border px-4 py-3">
          <div>
            <p className="font-mono text-sm">{d.path}</p>
            {d.reason && <p className="text-xs text-muted-foreground">{d.reason}</p>}
          </div>
          <Badge variant="outline" className="text-xs">
            {d.strategy}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// -- Main Panel --

/** Main Mesh panel — progressive disclosure with Mode A (empty) and Mode B (populated). */
export function MeshPanel() {
  const meshEnabled = useMeshEnabled();
  const { data: agentsResult, isLoading: agentsLoading } = useRegisteredAgents(undefined, meshEnabled);
  const agents = agentsResult?.agents ?? [];
  const { data: deniedResult, isLoading: deniedLoading } = useDeniedAgents(meshEnabled);
  const denied = deniedResult?.denied ?? [];
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('topology');

  const hasAgents = agents.length > 0;
  const isModeA = !hasAgents && !agentsLoading;

  if (!meshEnabled) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Network className="size-8 text-muted-foreground/50" />
        <div>
          <p className="font-medium">Mesh is not enabled</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mesh provides agent discovery and registry. Start DorkOS with mesh enabled.
          </p>
        </div>
        <code className="mt-2 rounded-md bg-muted px-3 py-1.5 font-mono text-sm">
          DORKOS_MESH_ENABLED=true dorkos
        </code>
      </div>
    );
  }

  const switchToDiscovery = () => setActiveTab('discovery');

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isModeA ? (
        <motion.div
          key="mode-a"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex h-full flex-col"
        >
          <DiscoveryView fullBleed />
        </motion.div>
      ) : (
        <motion.div
          key="mode-b"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex h-full flex-col"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
            <MeshStatsHeader />
            <TabsList className="mx-4 mt-3 shrink-0">
              <TabsTrigger value="topology">Topology</TabsTrigger>
              <TabsTrigger value="discovery">Discovery</TabsTrigger>
              <TabsTrigger value="agents">Agents</TabsTrigger>
              <TabsTrigger value="denied">Denied</TabsTrigger>
              <TabsTrigger value="access">Access</TabsTrigger>
            </TabsList>

            <TabsContent value="topology" className="flex flex-1 overflow-hidden">
              <div className="flex-1">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Loading topology...
                    </div>
                  }
                >
                  <LazyTopologyGraph onSelectAgent={setSelectedAgentId} />
                </Suspense>
              </div>
              {selectedAgentId && (
                <AgentHealthDetail
                  agentId={selectedAgentId}
                  onClose={() => setSelectedAgentId(null)}
                />
              )}
            </TabsContent>

            <TabsContent value="discovery" className="min-h-0 flex-1 overflow-y-auto">
              <DiscoveryView />
            </TabsContent>

            <TabsContent value="agents" className="min-h-0 flex-1 overflow-y-auto">
              <AgentsTab agents={agents} isLoading={agentsLoading} onGoToDiscovery={switchToDiscovery} />
            </TabsContent>

            <TabsContent value="denied" className="min-h-0 flex-1 overflow-y-auto">
              <DeniedTab denied={denied} isLoading={deniedLoading} />
            </TabsContent>

            <TabsContent value="access" className="min-h-0 flex-1 overflow-y-auto">
              <TopologyPanel onGoToDiscovery={switchToDiscovery} />
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
