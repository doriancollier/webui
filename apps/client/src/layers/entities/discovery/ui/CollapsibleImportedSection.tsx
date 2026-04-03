import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/layers/shared/lib';
import type { ExistingAgent } from '@dorkos/shared/mesh-schemas';
import { ExistingAgentCard } from './ExistingAgentCard';

/** Threshold above which the imported list starts collapsed. */
const COLLAPSE_THRESHOLD = 2;

interface CollapsibleImportedSectionProps {
  agents: ExistingAgent[];
}

/**
 * Collapsible section showing already-imported projects.
 *
 * Collapses by default when more than 2 agents are present, keeping
 * focus on actionable new candidates. Always visible as a summary line.
 */
export function CollapsibleImportedSection({ agents }: CollapsibleImportedSectionProps) {
  const [expanded, setExpanded] = useState(agents.length <= COLLAPSE_THRESHOLD);

  if (agents.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 py-1.5 text-xs transition-colors"
      >
        <ChevronRight className={cn('size-3 transition-transform', expanded && 'rotate-90')} />
        {agents.length} project{agents.length === 1 ? '' : 's'} already in DorkOS
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {agents.map((agent) => (
            <ExistingAgentCard key={agent.path} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
