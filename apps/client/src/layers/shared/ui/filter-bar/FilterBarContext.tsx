import { createContext, useContext } from 'react';
import type { UseFilterStateReturn } from '@/layers/shared/model';
import type { FilterDefinition } from '@/layers/shared/lib/filter-engine';

type FilterBarContextValue = UseFilterStateReturn<
  Record<string, FilterDefinition<unknown, unknown>>
>;

const FilterBarContext = createContext<FilterBarContextValue | null>(null);

/** Access the FilterBar context — must be used within a FilterBar. */
export function useFilterBar(): FilterBarContextValue {
  const ctx = useContext(FilterBarContext);
  if (!ctx) {
    throw new Error('useFilterBar must be used within a <FilterBar> component.');
  }
  return ctx;
}

export { FilterBarContext };
