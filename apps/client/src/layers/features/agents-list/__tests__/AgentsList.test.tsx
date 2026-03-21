/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { TopologyAgent } from '@dorkos/shared/mesh-schemas';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/layers/entities/session', () => ({
  useSessions: () => ({ sessions: [], isLoading: false }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/layers/entities/mesh', () => ({
  useUnregisterAgent: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/layers/features/agent-settings', () => ({
  AgentDialog: () => null,
}));

// Mock AgentRow to isolate AgentsList logic
vi.mock('../ui/AgentRow', () => ({
  AgentRow: ({ agent }: { agent: TopologyAgent }) => (
    <div data-testid={`agent-row-${agent.id}`}>{agent.name}</div>
  ),
}));

// Mock SessionLaunchPopover
vi.mock('../ui/SessionLaunchPopover', () => ({
  SessionLaunchPopover: () => <button>Start Session</button>,
}));

// ---------------------------------------------------------------------------
// Browser API mocks
// ---------------------------------------------------------------------------

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------

import { AgentsList } from '../ui/AgentsList';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const makeAgent = (overrides: Partial<TopologyAgent> & { id: string }): TopologyAgent => {
  const base: TopologyAgent = {
    id: overrides.id,
    name: overrides.name ?? `Agent ${overrides.id}`,
    description: '',
    runtime: 'claude-code',
    capabilities: [],
    behavior: { responseMode: 'always' },
    budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
    namespace: overrides.namespace,
    registeredAt: new Date().toISOString(),
    registeredBy: 'user',
    personaEnabled: true,
    enabledToolGroups: {},
    projectPath: overrides.projectPath ?? `/${overrides.id}`,
    healthStatus: overrides.healthStatus ?? 'active',
    relayAdapters: [],
    relaySubject: null,
    pulseScheduleCount: 0,
    lastSeenAt: null,
    lastSeenEvent: null,
  };
  return { ...base, ...overrides };
};

const multiNsAgents: TopologyAgent[] = [
  makeAgent({ id: '1', name: 'Agent A', namespace: 'web', projectPath: '/a' }),
  makeAgent({ id: '2', name: 'Agent B', namespace: 'web', projectPath: '/b' }),
  makeAgent({ id: '3', name: 'Agent C', namespace: 'api', projectPath: '/c' }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(cleanup);

describe('AgentsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(<AgentsList agents={[]} isLoading={true} />, {
      wrapper: createWrapper(),
    });

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders an AgentRow for each agent', () => {
    render(<AgentsList agents={multiNsAgents} isLoading={false} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('agent-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('agent-row-2')).toBeInTheDocument();
    expect(screen.getByTestId('agent-row-3')).toBeInTheDocument();
  });

  it('groups by namespace when >1 namespace exists', () => {
    render(<AgentsList agents={multiNsAgents} isLoading={false} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.getByText('api')).toBeInTheDocument();
  });

  it('shows flat list (no namespace headers) for single namespace', () => {
    const singleNsAgents = multiNsAgents.map((a) => ({ ...a, namespace: 'web' }));

    render(<AgentsList agents={singleNsAgents} isLoading={false} />, {
      wrapper: createWrapper(),
    });

    // No namespace group headers should be shown
    expect(screen.queryByText('web')).not.toBeInTheDocument();
    expect(screen.queryByText('api')).not.toBeInTheDocument();
  });
});
