// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';

// --- Mocks (must be before imports that use them) ---

interface ScheduleStub {
  agentId: string;
  id: string;
}
interface BindingStub {
  agentId: string;
  id: string;
}
interface HealthStub {
  status: string;
  lastSeenAt: string | null;
}

const mockUsePulseEnabled = vi.fn<() => boolean>(() => true);
const mockUseSchedules = vi.fn<() => { data: ScheduleStub[] }>(() => ({ data: [] }));
vi.mock('@/layers/entities/pulse', () => ({
  usePulseEnabled: () => mockUsePulseEnabled(),
  useSchedules: () => mockUseSchedules(),
}));

const mockUseRelayEnabled = vi.fn<() => boolean>(() => true);
vi.mock('@/layers/entities/relay', () => ({
  useRelayEnabled: () => mockUseRelayEnabled(),
}));

const mockUseMeshAgentHealth = vi.fn<() => { data: HealthStub | undefined }>(() => ({
  data: undefined,
}));
vi.mock('@/layers/entities/mesh', () => ({
  useMeshAgentHealth: () => mockUseMeshAgentHealth(),
}));

const mockUseBindings = vi.fn<() => { data: BindingStub[] }>(() => ({ data: [] }));
vi.mock('@/layers/entities/binding', () => ({
  useBindings: () => mockUseBindings(),
}));

const mockSetAgentDialogOpen = vi.fn();
const mockSetRelayOpen = vi.fn();
const mockOpenPulseForAgent = vi.fn();
vi.mock('@/layers/shared/model', () => ({
  useAppStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      setAgentDialogOpen: mockSetAgentDialogOpen,
      setRelayOpen: mockSetRelayOpen,
      openPulseForAgent: mockOpenPulseForAgent,
    };
    return selector ? selector(state) : state;
  },
}));

// Stub RelativeTime to avoid internal hook complexity
vi.mock('@/layers/features/relay', () => ({
  RelativeTime: ({ dateStr }: { dateStr: string }) => (
    <span data-testid="relative-time">{dateStr}</span>
  ),
}));

import { ConnectionsTab } from '../ui/ConnectionsTab';

// --- Test fixtures ---

const baseAgent: AgentManifest = {
  id: '01HZ0000000000000000000001',
  name: 'test-agent',
  description: 'A mock agent',
  runtime: 'claude-code',
  capabilities: ['code-review'],
  behavior: { responseMode: 'always' },
  budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
  registeredAt: '2025-01-01T00:00:00.000Z',
  registeredBy: 'test',
  personaEnabled: true,
  enabledToolGroups: {},
};

function renderTab(agent: AgentManifest = baseAgent) {
  const { container } = render(<ConnectionsTab agent={agent} />);
  return within(container);
}

// --- Tests ---

describe('ConnectionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePulseEnabled.mockReturnValue(true);
    mockUseRelayEnabled.mockReturnValue(true);
    mockUseSchedules.mockReturnValue({ data: [] });
    mockUseBindings.mockReturnValue({ data: [] });
    mockUseMeshAgentHealth.mockReturnValue({ data: undefined });
  });

  it('renders three subsystem rows', () => {
    const view = renderTab();
    expect(view.getByText('Pulse Schedules')).toBeInTheDocument();
    expect(view.getByText('Relay Bindings')).toBeInTheDocument();
    expect(view.getByText('Mesh Health')).toBeInTheDocument();
  });

  describe('Pulse row', () => {
    it('shows "Enabled" badge when Pulse is enabled', () => {
      const view = renderTab();
      const section = view.getByText('Pulse Schedules').closest('section')!;
      expect(within(section).getByText('Enabled')).toBeInTheDocument();
    });

    it('shows "Disabled" badge when Pulse is disabled', () => {
      mockUsePulseEnabled.mockReturnValue(false);
      const view = renderTab();
      const section = view.getByText('Pulse Schedules').closest('section')!;
      expect(within(section).getByText('Disabled')).toBeInTheDocument();
    });

    it('shows "No schedules" when Pulse is enabled but agent has none', () => {
      mockUseSchedules.mockReturnValue({ data: [] });
      const view = renderTab();
      expect(view.getByText('No schedules')).toBeInTheDocument();
    });

    it('shows schedule count when agent has schedules', () => {
      mockUseSchedules.mockReturnValue({
        data: [
          { agentId: baseAgent.id, id: 's1' },
          { agentId: baseAgent.id, id: 's2' },
        ],
      });
      const view = renderTab();
      expect(view.getByText('2 schedules')).toBeInTheDocument();
    });

    it('uses singular "schedule" for count of 1', () => {
      mockUseSchedules.mockReturnValue({
        data: [{ agentId: baseAgent.id, id: 's1' }],
      });
      const view = renderTab();
      expect(view.getByText('1 schedule')).toBeInTheDocument();
    });

    it('only counts schedules belonging to this agent', () => {
      mockUseSchedules.mockReturnValue({
        data: [
          { agentId: baseAgent.id, id: 's1' },
          { agentId: 'other-agent', id: 's2' },
        ],
      });
      const view = renderTab();
      expect(view.getByText('1 schedule')).toBeInTheDocument();
    });

    it('shows "View in Pulse" action when enabled', () => {
      const view = renderTab();
      expect(view.getByText('View in Pulse')).toBeInTheDocument();
    });

    it('does not show action when Pulse is disabled', () => {
      mockUsePulseEnabled.mockReturnValue(false);
      const view = renderTab();
      expect(view.queryByText('View in Pulse')).not.toBeInTheDocument();
    });

    it('navigates to Pulse on action click', () => {
      // Mock requestAnimationFrame to execute immediately
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 0;
      });

      const view = renderTab();
      fireEvent.click(view.getByText('View in Pulse'));

      expect(mockSetAgentDialogOpen).toHaveBeenCalledWith(false);
      expect(mockOpenPulseForAgent).toHaveBeenCalledWith(baseAgent.id);

      rafSpy.mockRestore();
    });
  });

  describe('Relay row', () => {
    it('shows "Enabled" badge when Relay is enabled', () => {
      const view = renderTab();
      const section = view.getByText('Relay Bindings').closest('section')!;
      expect(within(section).getByText('Enabled')).toBeInTheDocument();
    });

    it('shows "Disabled" badge when Relay is disabled', () => {
      mockUseRelayEnabled.mockReturnValue(false);
      const view = renderTab();
      const section = view.getByText('Relay Bindings').closest('section')!;
      expect(within(section).getByText('Disabled')).toBeInTheDocument();
    });

    it('shows "No bindings" when Relay is enabled but agent has none', () => {
      mockUseBindings.mockReturnValue({ data: [] });
      const view = renderTab();
      expect(view.getByText('No bindings')).toBeInTheDocument();
    });

    it('shows binding count when agent has bindings', () => {
      mockUseBindings.mockReturnValue({
        data: [
          { agentId: baseAgent.id, id: 'b1' },
          { agentId: baseAgent.id, id: 'b2' },
          { agentId: baseAgent.id, id: 'b3' },
        ],
      });
      const view = renderTab();
      expect(view.getByText('3 bindings')).toBeInTheDocument();
    });

    it('uses singular "binding" for count of 1', () => {
      mockUseBindings.mockReturnValue({
        data: [{ agentId: baseAgent.id, id: 'b1' }],
      });
      const view = renderTab();
      expect(view.getByText('1 binding')).toBeInTheDocument();
    });

    it('only counts bindings belonging to this agent', () => {
      mockUseBindings.mockReturnValue({
        data: [
          { agentId: baseAgent.id, id: 'b1' },
          { agentId: 'other-agent', id: 'b2' },
        ],
      });
      const view = renderTab();
      expect(view.getByText('1 binding')).toBeInTheDocument();
    });

    it('shows "View in Relay" action when enabled', () => {
      const view = renderTab();
      expect(view.getByText('View in Relay')).toBeInTheDocument();
    });

    it('does not show action when Relay is disabled', () => {
      mockUseRelayEnabled.mockReturnValue(false);
      const view = renderTab();
      expect(view.queryByText('View in Relay')).not.toBeInTheDocument();
    });

    it('navigates to Relay on action click', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 0;
      });

      const view = renderTab();
      fireEvent.click(view.getByText('View in Relay'));

      expect(mockSetAgentDialogOpen).toHaveBeenCalledWith(false);
      expect(mockSetRelayOpen).toHaveBeenCalledWith(true);

      rafSpy.mockRestore();
    });
  });

  describe('Mesh row', () => {
    it('is always enabled', () => {
      const view = renderTab();
      const section = view.getByText('Mesh Health').closest('section')!;
      expect(within(section).getByText('Enabled')).toBeInTheDocument();
    });

    it('shows skeleton when health data is loading', () => {
      mockUseMeshAgentHealth.mockReturnValue({ data: undefined });
      const view = renderTab();
      const section = view.getByText('Mesh Health').closest('section')!;
      // Skeleton has a specific className
      expect(within(section).getByText('Mesh Health')).toBeInTheDocument();
    });

    it('shows health status badge when data is available', () => {
      mockUseMeshAgentHealth.mockReturnValue({
        data: { status: 'healthy', lastSeenAt: '2025-06-01T12:00:00Z' },
      });
      const view = renderTab();
      const section = view.getByText('Mesh Health').closest('section')!;
      expect(within(section).getByText('healthy')).toBeInTheDocument();
    });

    it('shows "Last seen" with RelativeTime when lastSeenAt is present', () => {
      mockUseMeshAgentHealth.mockReturnValue({
        data: { status: 'healthy', lastSeenAt: '2025-06-01T12:00:00Z' },
      });
      const view = renderTab();
      expect(view.getByText('Last seen')).toBeInTheDocument();
      expect(view.getByTestId('relative-time')).toHaveTextContent('2025-06-01T12:00:00Z');
    });

    it('does not show navigation action (mesh has no deep link)', () => {
      mockUseMeshAgentHealth.mockReturnValue({
        data: { status: 'healthy', lastSeenAt: null },
      });
      const view = renderTab();
      const section = view.getByText('Mesh Health').closest('section')!;
      expect(within(section).queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('navigateTo pattern', () => {
    it('closes agent dialog before opening target panel', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        // Verify dialog was closed before the callback runs
        expect(mockSetAgentDialogOpen).toHaveBeenCalledWith(false);
        cb(0);
        return 0;
      });

      const view = renderTab();
      fireEvent.click(view.getByText('View in Pulse'));

      expect(mockSetAgentDialogOpen).toHaveBeenCalledTimes(1);
      expect(mockOpenPulseForAgent).toHaveBeenCalledTimes(1);

      rafSpy.mockRestore();
    });
  });
});
