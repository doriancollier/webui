import { useMemo } from 'react';
import { Search } from 'lucide-react';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';
import { Button } from '@/layers/shared/ui/button';
import { Input } from '@/layers/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/layers/shared/ui/select';

export type StatusFilter = 'all' | 'active' | 'inactive' | 'stale';

export interface FilterState {
  searchQuery: string;
  statusFilter: StatusFilter;
  namespaceFilter: string;
}

interface AgentFilterBarProps {
  agents: AgentManifest[];
  /** Current filter state (controlled). */
  filterState: FilterState;
  /** Callback when any filter changes. */
  onFilterStateChange: (state: FilterState) => void;
  /** Number of agents after filtering (shown as result count). */
  filteredCount: number;
}

/**
 * Filter bar for the agents list — search input, status chips, namespace dropdown,
 * result count, and group-by toggle.
 */
export function AgentFilterBar({
  agents,
  filterState,
  onFilterStateChange,
  filteredCount,
}: AgentFilterBarProps) {
  const { searchQuery, statusFilter, namespaceFilter } = filterState;

  const namespaces = useMemo(
    () => [...new Set(agents.map((a) => a.namespace).filter((ns): ns is string => Boolean(ns)))],
    [agents]
  );

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      {/* Search input */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
        <Input
          className="h-8 w-48 pl-7 text-sm"
          placeholder="Filter agents..."
          value={searchQuery}
          onChange={(e) => onFilterStateChange({ ...filterState, searchQuery: e.target.value })}
        />
      </div>

      {/* Status chips */}
      {(['all', 'active', 'inactive', 'stale'] as const).map((status) => (
        <Button
          key={status}
          variant={statusFilter === status ? 'default' : 'outline'}
          size="sm"
          className="h-7 px-2.5 text-xs capitalize"
          onClick={() => onFilterStateChange({ ...filterState, statusFilter: status })}
        >
          {status}
        </Button>
      ))}

      {/* Namespace dropdown — only shown when >1 namespace */}
      {namespaces.length > 1 && (
        <Select
          value={namespaceFilter}
          onValueChange={(ns) => onFilterStateChange({ ...filterState, namespaceFilter: ns })}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="All namespaces" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All namespaces</SelectItem>
            {namespaces.map((ns) => (
              <SelectItem key={ns} value={ns}>
                {ns}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Result count */}
      <span className="text-muted-foreground text-xs">{filteredCount} agents</span>
    </div>
  );
}
