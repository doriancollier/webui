/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { FilterState } from '../ui/AgentFilterBar';

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------

import { AgentFilterBar } from '../ui/AgentFilterBar';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const makeAgents = () => [
  {
    id: '1',
    name: 'Frontend Agent',
    description: 'Handles UI',
    capabilities: ['code', 'review'],
    namespace: 'web',
    runtime: 'claude-code' as const,
    registeredAt: new Date().toISOString(),
    registeredBy: 'user',
    behavior: { responseMode: 'always' as const },
    budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
    personaEnabled: true,
    enabledToolGroups: {},
  },
  {
    id: '2',
    name: 'Backend Agent',
    description: 'API work',
    capabilities: ['code'],
    namespace: 'api',
    runtime: 'claude-code' as const,
    registeredAt: new Date().toISOString(),
    registeredBy: 'user',
    behavior: { responseMode: 'always' as const },
    budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
    personaEnabled: true,
    enabledToolGroups: {},
  },
  {
    id: '3',
    name: 'DevOps Agent',
    description: 'CI/CD pipeline work',
    capabilities: ['deploy'],
    namespace: 'web',
    runtime: 'claude-code' as const,
    registeredAt: new Date().toISOString(),
    registeredBy: 'user',
    behavior: { responseMode: 'always' as const },
    budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
    personaEnabled: true,
    enabledToolGroups: {},
  },
  {
    id: '4',
    name: 'Docs Agent',
    description: 'Documentation',
    capabilities: ['write'],
    namespace: 'docs',
    runtime: 'claude-code' as const,
    registeredAt: new Date().toISOString(),
    registeredBy: 'user',
    behavior: { responseMode: 'always' as const },
    budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
    personaEnabled: true,
    enabledToolGroups: {},
  },
];

const defaultFilterState: FilterState = {
  searchQuery: '',
  statusFilter: 'all',
  namespaceFilter: 'all',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(cleanup);

describe('AgentFilterBar', () => {
  let onFilterStateChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onFilterStateChange = vi.fn();
  });

  it('renders search input with placeholder', () => {
    render(
      <AgentFilterBar
        agents={makeAgents()}
        filterState={defaultFilterState}
        onFilterStateChange={onFilterStateChange}
        filteredCount={4}
      />
    );

    expect(screen.getByPlaceholderText('Filter agents...')).toBeInTheDocument();
  });

  it('calls onFilterStateChange with updated searchQuery when typing', () => {
    render(
      <AgentFilterBar
        agents={makeAgents()}
        filterState={defaultFilterState}
        onFilterStateChange={onFilterStateChange}
        filteredCount={4}
      />
    );

    const input = screen.getByPlaceholderText('Filter agents...');
    fireEvent.change(input, { target: { value: 'Frontend' } });

    expect(onFilterStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ searchQuery: 'Frontend' })
    );
  });

  it('calls onFilterStateChange with updated statusFilter on chip click', () => {
    render(
      <AgentFilterBar
        agents={makeAgents()}
        filterState={defaultFilterState}
        onFilterStateChange={onFilterStateChange}
        filteredCount={4}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^active$/i }));

    expect(onFilterStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ statusFilter: 'active' })
    );
  });

  it('shows namespace dropdown only when >1 unique namespace', () => {
    render(
      <AgentFilterBar
        agents={makeAgents()}
        filterState={defaultFilterState}
        onFilterStateChange={onFilterStateChange}
        filteredCount={4}
      />
    );

    // 3 namespaces (web, api, docs) — dropdown should appear
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('hides namespace dropdown when agents have only 1 namespace', () => {
    const singleNsAgents = makeAgents().map((a) => ({ ...a, namespace: 'web' }));

    render(
      <AgentFilterBar
        agents={singleNsAgents}
        filterState={defaultFilterState}
        onFilterStateChange={onFilterStateChange}
        filteredCount={4}
      />
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('displays the result count', () => {
    render(
      <AgentFilterBar
        agents={makeAgents()}
        filterState={defaultFilterState}
        onFilterStateChange={onFilterStateChange}
        filteredCount={3}
      />
    );

    expect(screen.getByText('3 agents')).toBeInTheDocument();
  });

  it('renders all 4 status filter chips', () => {
    render(
      <AgentFilterBar
        agents={makeAgents()}
        filterState={defaultFilterState}
        onFilterStateChange={onFilterStateChange}
        filteredCount={4}
      />
    );

    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^active$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^inactive$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^stale$/i })).toBeInTheDocument();
  });
});
