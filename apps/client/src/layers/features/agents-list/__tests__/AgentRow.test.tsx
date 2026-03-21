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

const mockUnregisterMutate = vi.fn();
vi.mock('@/layers/entities/mesh', () => ({
  useUnregisterAgent: () => ({ mutate: mockUnregisterMutate }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/layers/entities/session', () => ({
  useSessions: () => ({ sessions: [], isLoading: false }),
}));

// Mock AgentDialog to isolate AgentRow
vi.mock('@/layers/features/agent-settings', () => ({
  AgentDialog: () => null,
}));

// Mock SessionLaunchPopover to isolate AgentRow
vi.mock('../ui/SessionLaunchPopover', () => ({
  SessionLaunchPopover: ({ projectPath }: { projectPath: string }) => (
    <button data-testid="session-launch-popover" data-project-path={projectPath}>
      Start Session
    </button>
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

const agentFixture = {
  id: 'agent-1',
  name: 'Frontend Agent',
  description: 'Handles UI tasks',
  runtime: 'claude-code' as const,
  capabilities: ['code', 'review', 'test', 'deploy', 'docs'],
  behavior: { responseMode: 'always' as const, escalationThreshold: undefined },
  budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
  namespace: 'web',
  registeredAt: new Date().toISOString(),
  registeredBy: 'test-user',
  personaEnabled: true,
  enabledToolGroups: {},
};

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------

import { AgentRow } from '../ui/AgentRow';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(cleanup);

describe('AgentRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders collapsed row with name, runtime badge, and truncated path', () => {
    render(
      <AgentRow
        agent={agentFixture}
        projectPath="/home/user/projects/frontend"
        sessionCount={0}
        healthStatus="active"
        lastActive={null}
      />,
      { wrapper: createWrapper() }
    );

    // Radix Collapsible may render content in multiple DOM nodes
    expect(screen.getAllByText('Frontend Agent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('claude-code').length).toBeGreaterThanOrEqual(1);
    // Truncated path: last 2 segments
    expect(screen.getAllByText('projects/frontend').length).toBeGreaterThanOrEqual(1);
  });

  it('shows health status dot with correct color class for active', () => {
    const { container } = render(
      <AgentRow
        agent={agentFixture}
        projectPath="/projects/frontend"
        sessionCount={0}
        healthStatus="active"
        lastActive={null}
      />,
      { wrapper: createWrapper() }
    );

    const dot = container.querySelector('.bg-emerald-500');
    expect(dot).toBeInTheDocument();
  });

  it('shows health status dot with correct color class for inactive', () => {
    const { container } = render(
      <AgentRow
        agent={agentFixture}
        projectPath="/projects/frontend"
        sessionCount={0}
        healthStatus="inactive"
        lastActive={null}
      />,
      { wrapper: createWrapper() }
    );

    const dot = container.querySelector('.bg-amber-500');
    expect(dot).toBeInTheDocument();
  });

  it('expands on click revealing full description', () => {
    const { container } = render(
      <AgentRow
        agent={agentFixture}
        projectPath="/projects/frontend"
        sessionCount={0}
        healthStatus="active"
        lastActive={null}
      />,
      { wrapper: createWrapper() }
    );

    // Click the CollapsibleTrigger (the flex row div inside)
    const trigger = container.querySelector('[data-slot="collapsible-trigger"]') as HTMLElement;
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);

    // After expansion, description should be visible
    expect(screen.getByText('Handles UI tasks')).toBeInTheDocument();
  });

  it('truncates capabilities at 3 with +N more badge', () => {
    render(
      <AgentRow
        agent={agentFixture}
        projectPath="/projects/frontend"
        sessionCount={0}
        healthStatus="active"
        lastActive={null}
      />,
      { wrapper: createWrapper() }
    );

    // Overflow badge visible in collapsed state
    expect(screen.getAllByText('+2 more').length).toBeGreaterThanOrEqual(1);
  });

  it('shows session count badge when sessions exist', () => {
    render(
      <AgentRow
        agent={agentFixture}
        projectPath="/projects/frontend"
        sessionCount={3}
        healthStatus="active"
        lastActive={null}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('3 active')).toBeInTheDocument();
  });

  it('does not show session count badge when sessionCount is 0', () => {
    render(
      <AgentRow
        agent={agentFixture}
        projectPath="/projects/frontend"
        sessionCount={0}
        healthStatus="active"
        lastActive={null}
      />,
      { wrapper: createWrapper() }
    );

    // "N active" badge should not appear when sessionCount is 0
    expect(screen.queryByText(/\d+ active/)).not.toBeInTheDocument();
  });

  it('calls unregister mutation on unregister confirm', () => {
    const { container } = render(
      <AgentRow
        agent={agentFixture}
        projectPath="/projects/frontend"
        sessionCount={0}
        healthStatus="active"
        lastActive={null}
      />,
      { wrapper: createWrapper() }
    );

    // Expand the row first via CollapsibleTrigger
    const trigger = container.querySelector('[data-slot="collapsible-trigger"]') as HTMLElement;
    fireEvent.click(trigger);

    // Click Unregister
    const unregisterBtns = screen.getAllByRole('button', { name: /unregister/i });
    fireEvent.click(unregisterBtns[0]);

    // Confirmation appears
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();

    // Confirm
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmBtn);

    expect(mockUnregisterMutate).toHaveBeenCalledWith('agent-1');
  });
});
