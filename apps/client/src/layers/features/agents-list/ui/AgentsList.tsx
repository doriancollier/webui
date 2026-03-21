import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { TopologyAgent } from '@dorkos/shared/mesh-schemas';
import { useSessions } from '@/layers/entities/session';
import { Skeleton } from '@/layers/shared/ui/skeleton';
import { ScrollArea } from '@/layers/shared/ui/scroll-area';
import { AgentRow } from './AgentRow';
import { AgentFilterBar, type FilterState } from './AgentFilterBar';

interface AgentsListProps {
  agents: TopologyAgent[];
  isLoading: boolean;
}

const defaultFilterState: FilterState = {
  searchQuery: '',
  statusFilter: 'all',
  namespaceFilter: 'all',
};

/** Apply filter state to a topology agent array. Pure function — no side effects. */
function applyFilters(agents: TopologyAgent[], filterState: FilterState): TopologyAgent[] {
  let result = agents;

  if (filterState.searchQuery.trim()) {
    const q = filterState.searchQuery.toLowerCase();
    result = result.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description?.toLowerCase().includes(q) ?? false) ||
        a.capabilities.some((c) => c.toLowerCase().includes(q))
    );
  }

  if (filterState.statusFilter !== 'all') {
    result = result.filter((a) => a.healthStatus === filterState.statusFilter);
  }

  if (filterState.namespaceFilter !== 'all') {
    result = result.filter((a) => a.namespace === filterState.namespaceFilter);
  }

  return result;
}

/**
 * Agent list container — renders expandable AgentRow components with
 * optional namespace grouping, integrated filter bar, and entrance animations.
 */
export function AgentsList({ agents, isLoading }: AgentsListProps) {
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterState);
  const { sessions } = useSessions();

  // Derive filtered agents from filter state (no useEffect, no callback loop)
  const filteredAgents = useMemo(() => applyFilters(agents, filterState), [agents, filterState]);

  // Auto-group when multiple namespaces exist
  const namespaces = useMemo(
    () => [...new Set(agents.map((a) => a.namespace).filter((ns): ns is string => Boolean(ns)))],
    [agents]
  );
  const shouldGroup = namespaces.length > 1;

  // Group filtered agents by namespace
  const grouped = useMemo(() => {
    if (!shouldGroup) return { '': filteredAgents };
    return filteredAgents.reduce<Record<string, TopologyAgent[]>>((acc, agent) => {
      const ns = agent.namespace ?? 'default';
      (acc[ns] ??= []).push(agent);
      return acc;
    }, {});
  }, [filteredAgents, shouldGroup]);

  // Compute session counts per agent (matched by projectPath)
  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const agent of agents) {
      const path = agent.projectPath;
      counts[agent.id] = path ? sessions.filter((s) => s.cwd === path).length : 0;
    }
    return counts;
  }, [agents, sessions]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <AgentFilterBar
        agents={agents}
        filterState={filterState}
        onFilterStateChange={setFilterState}
        filteredCount={filteredAgents.length}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-4 pt-0">
          {Object.entries(grouped).map(([namespace, groupAgents]) => (
            <div key={namespace}>
              {shouldGroup && namespace && (
                <h3 className="text-muted-foreground mt-4 mb-2 text-[10px] font-medium tracking-widest uppercase first:mt-0">
                  {namespace}
                </h3>
              )}
              <AnimatePresence initial={false}>
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.04 } },
                    hidden: {},
                  }}
                  className="space-y-2"
                >
                  {groupAgents.map((agent) => (
                    <motion.div
                      key={agent.id}
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      transition={{ duration: 0.15 }}
                    >
                      <AgentRow
                        agent={agent}
                        projectPath={agent.projectPath ?? ''}
                        sessionCount={sessionCounts[agent.id] ?? 0}
                        healthStatus={agent.healthStatus}
                        lastActive={agent.lastSeenAt}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
