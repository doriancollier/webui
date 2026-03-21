/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefetch = vi.fn();
const mockUseTopology = vi.fn();
vi.mock('@/layers/entities/mesh', () => ({
  useTopology: () => mockUseTopology(),
}));

vi.mock('@/layers/features/agents-list', () => ({
  AgentsList: ({ agents }: { agents: unknown[] }) => (
    <div data-testid="agents-list" data-count={agents.length}>
      AgentsList
    </div>
  ),
}));

vi.mock('@/layers/features/mesh', () => ({
  DiscoveryView: ({ fullBleed }: { fullBleed?: boolean }) => (
    <div data-testid="discovery-view" data-full-bleed={String(fullBleed ?? false)}>
      DiscoveryView
    </div>
  ),
}));

vi.mock('@/layers/features/mesh/ui/TopologyGraph', () => ({
  TopologyGraph: () => <div data-testid="topology-graph">TopologyGraph</div>,
}));

vi.mock('@radix-ui/react-tabs', () => ({
  Root: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  List: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) => (
    <div role="tablist" {...props}>
      {children}
    </div>
  ),
  Trigger: ({
    children,
    value,
    ...props
  }: Record<string, unknown> & { children?: ReactNode; value?: string }) => (
    <button role="tab" data-value={value} {...props}>
      {children}
    </button>
  ),
  Content: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) => (
    <div role="tabpanel" {...props}>
      {children}
    </div>
  ),
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

import { AgentsPage } from '../ui/AgentsPage';

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

const makeTopologyResult = (agentCount: number) => ({
  namespaces:
    agentCount > 0
      ? [
          {
            namespace: 'web',
            agentCount,
            agents: Array.from({ length: agentCount }, (_, i) => ({
              id: `agent-${i + 1}`,
              name: `Agent ${i + 1}`,
              description: '',
              runtime: 'claude-code',
              capabilities: [],
              behavior: { responseMode: 'always' },
              budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
              namespace: 'web',
              registeredAt: new Date().toISOString(),
              registeredBy: 'user',
              personaEnabled: true,
              enabledToolGroups: {},
              projectPath: `/project-${i + 1}`,
              healthStatus: 'active',
              relayAdapters: [],
              relaySubject: null,
              pulseScheduleCount: 0,
              lastSeenAt: null,
              lastSeenEvent: null,
            })),
          },
        ]
      : [],
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefetch.mockResolvedValue(undefined);
  });

  it('renders DiscoveryView in Mode A when zero agents', () => {
    mockUseTopology.mockReturnValue({
      data: makeTopologyResult(0),
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<AgentsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('discovery-view')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('renders Agents and Topology tabs in Mode B when agents exist', () => {
    mockUseTopology.mockReturnValue({
      data: makeTopologyResult(2),
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<AgentsPage />, { wrapper: createWrapper() });

    expect(screen.getByRole('tab', { name: /agents/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /topology/i })).toBeInTheDocument();
  });

  it('renders AgentsList in agents tab', () => {
    mockUseTopology.mockReturnValue({
      data: makeTopologyResult(3),
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<AgentsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('agents-list')).toBeInTheDocument();
  });

  it('renders error state with retry button on isError', () => {
    mockUseTopology.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    render(<AgentsPage />, { wrapper: createWrapper() });

    expect(screen.getByText(/could not load agents/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls refetch on retry button click', () => {
    mockUseTopology.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    render(<AgentsPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(mockRefetch).toHaveBeenCalled();
  });
});
