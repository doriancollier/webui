import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { TopologyAgent } from '@dorkos/shared/mesh-schemas';
import { useSessions } from '@/layers/entities/session';
import { applySortAndFilter } from '@/layers/shared/lib';
import { useFilterState } from '@/layers/shared/model';
import { FilterBar } from '@/layers/shared/ui/filter-bar';
import { Skeleton } from '@/layers/shared/ui/skeleton';
import { ScrollArea } from '@/layers/shared/ui/scroll-area';
import { agentFilterSchema, agentSortOptions } from '../lib/agent-filter-schema';
import { AgentRow } from './AgentRow';
import { AgentEmptyFilterState } from './AgentEmptyFilterState';

/** Items beyond this index are rendered without stagger delay to keep animation snappy. */
const STAGGER_ITEM_LIMIT = 8;

/** Stagger container variants — orchestrates child entrance animations. */
const staggerContainerVariants = {
  visible: { transition: { staggerChildren: 0.04 } },
  hidden: {},
} as const;

/** Item entrance variants — fade in + slide up for the first N items. */
const staggerItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
} as const;

interface AgentsListProps {
  agents: TopologyAgent[];
  isLoading: boolean;
}

/**
 * Agent list container — renders expandable AgentRow components with
 * optional namespace grouping, composable filter bar, and entrance
 * animations that play once on mount.
 */
export function AgentsList({ agents, isLoading }: AgentsListProps) {
  const filterState = useFilterState(agentFilterSchema, {
    debounce: { search: 200 },
  });
  // staggerKey is intentionally never updated — keeping it stable prevents the
  // stagger container from remounting (and re-animating) on filter changes.
  const [staggerKey] = useState(0);

  const { sessions } = useSessions();

  // Derive dynamic namespace options from the agent list
  const namespaceOptions = useMemo(
    () => [...new Set(agents.map((a) => a.namespace).filter((ns): ns is string => Boolean(ns)))],
    [agents]
  );

  // Apply filters and sort
  const filteredAgents = useMemo(
    () =>
      applySortAndFilter(agents, agentFilterSchema, filterState.values, agentSortOptions, {
        field: filterState.sortField,
        direction: filterState.sortDirection,
      }),
    [agents, filterState.values, filterState.sortField, filterState.sortDirection]
  );

  // Auto-group when multiple namespaces exist
  const shouldGroup = namespaceOptions.length > 1;

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
      <FilterBar state={filterState}>
        <FilterBar.Search placeholder="Filter agents..." />
        <FilterBar.Primary name="status" />
        <FilterBar.AddFilter dynamicOptions={{ namespace: namespaceOptions }} />
        <FilterBar.Sort options={agentSortOptions} />
        <FilterBar.ResultCount count={filteredAgents.length} total={agents.length} noun="agent" />
        <FilterBar.ActiveFilters />
      </FilterBar>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-4 pt-0">
          {filteredAgents.length === 0 && agents.length > 0 ? (
            <AgentEmptyFilterState
              onClearFilters={filterState.clearAll}
              filterDescription={filterState.describeActive()}
            />
          ) : (
            Object.entries(grouped).map(([namespace, groupAgents]) => (
              <div key={namespace}>
                {shouldGroup && namespace && (
                  <h3 className="text-muted-foreground mt-4 mb-2 text-[10px] font-medium tracking-widest uppercase first:mt-0">
                    {namespace}
                  </h3>
                )}
                <motion.div
                  key={staggerKey}
                  initial="hidden"
                  animate="visible"
                  variants={staggerContainerVariants}
                  className="space-y-2"
                >
                  {groupAgents.map((agent, index) => (
                    <motion.div
                      key={agent.id}
                      variants={index < STAGGER_ITEM_LIMIT ? staggerItemVariants : undefined}
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
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
