import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { cn } from '@/layers/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/layers/shared/ui/dropdown-menu';
import { useFilterBar } from './FilterBarContext';

interface FilterBarSortProps {
  /** Sort options from createSortOptions — keys map to field names. */
  options: Record<string, { label: string }>;
  className?: string;
}

/** Dropdown for selecting sort field and toggling direction. */
function FilterBarSort({ options, className }: FilterBarSortProps) {
  const { sortField, sortDirection, setSort } = useFilterBar();

  const currentLabel = options[sortField]?.label ?? sortField;
  const DirectionIcon = sortDirection === 'asc' ? ArrowUpIcon : ArrowDownIcon;

  function toggleDirection(e: React.MouseEvent) {
    e.stopPropagation();
    setSort(sortField, sortDirection === 'asc' ? 'desc' : 'asc');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-slot="filter-bar-sort"
        className={cn(
          'border-input hover:bg-accent hover:text-accent-foreground inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs',
          className
        )}
      >
        Sort: {currentLabel}
        <span
          role="button"
          tabIndex={-1}
          onClick={toggleDirection}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleDirection(e as unknown as React.MouseEvent);
            }
          }}
          className="hover:bg-muted -mr-1 rounded p-0.5"
          aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
        >
          <DirectionIcon className="size-3" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {Object.entries(options).map(([key, opt]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => setSort(key, sortDirection)}
            className={cn(key === sortField && 'bg-accent font-medium')}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { FilterBarSort };
