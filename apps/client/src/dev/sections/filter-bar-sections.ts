import type { PlaygroundSection } from '../playground-registry';

/**
 * FilterBar component sections from FilterBarPage.
 *
 * Sources: FilterBarShowcase (full filter bar, individual sub-components, responsive).
 */
export const FILTER_BAR_SECTIONS: PlaygroundSection[] = [
  {
    id: 'filterbar-full-demo',
    title: 'FilterBar — Full Demo',
    page: 'filter-bar',
    category: 'FilterBar',
    keywords: ['filter', 'bar', 'search', 'sort', 'enum', 'date', 'active', 'agents', 'mock'],
  },
  {
    id: 'filterbar-responsive',
    title: 'FilterBar — Responsive',
    page: 'filter-bar',
    category: 'FilterBar',
    keywords: ['filter', 'bar', 'responsive', 'mobile', 'tablet', 'wrap', 'viewport'],
  },
  {
    id: 'filterbar-empty-filter-state',
    title: 'FilterBar — Empty Filter State',
    page: 'filter-bar',
    category: 'FilterBar',
    keywords: ['filter', 'empty', 'state', 'no results', 'clear', 'active filters'],
  },
];
