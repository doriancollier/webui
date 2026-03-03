// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TooltipProvider } from '@/layers/shared/ui';
import { AgentContextChips } from '../ui/AgentContextChips';

// Mock entity hooks
const mockUsePulseEnabled = vi.fn(() => true);
vi.mock('@/layers/entities/pulse/model/use-pulse-config', () => ({
  usePulseEnabled: () => mockUsePulseEnabled(),
}));

const mockActiveRunCount = vi.fn(() => ({ data: 0 }));
vi.mock('@/layers/entities/pulse/model/use-runs', () => ({
  useActiveRunCount: () => mockActiveRunCount(),
}));

const mockCompletedRunBadge = vi.fn(() => ({ unviewedCount: 0, clearBadge: vi.fn() }));
vi.mock('@/layers/entities/pulse/model/use-completed-run-badge', () => ({
  useCompletedRunBadge: () => mockCompletedRunBadge(),
}));

const mockUseRelayEnabled = vi.fn(() => true);
vi.mock('@/layers/entities/relay/model/use-relay-config', () => ({
  useRelayEnabled: () => mockUseRelayEnabled(),
}));

const mockUseRegisteredAgents = vi.fn(() => ({ data: { agents: [] } }));
vi.mock('@/layers/entities/mesh/model/use-mesh-agents', () => ({
  useRegisteredAgents: () => mockUseRegisteredAgents(),
}));

// Mock app store — capture panel-open calls
const mockSetPulseOpen = vi.fn();
const mockSetRelayOpen = vi.fn();
const mockSetMeshOpen = vi.fn();
vi.mock('@/layers/shared/model/app-store', () => ({
  useAppStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      setPulseOpen: mockSetPulseOpen,
      setRelayOpen: mockSetRelayOpen,
      setMeshOpen: mockSetMeshOpen,
    };
    return selector ? selector(state) : state;
  },
}));

// Mock icons to render simple spans
vi.mock('@dorkos/icons/registry', () => ({
  icons: {
    pulse: (props: Record<string, unknown>) => <span data-testid="icon-pulse" {...props} />,
    relay: (props: Record<string, unknown>) => <span data-testid="icon-relay" {...props} />,
    mesh: (props: Record<string, unknown>) => <span data-testid="icon-mesh" {...props} />,
  },
}));

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

function Wrapper({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

describe('AgentContextChips', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePulseEnabled.mockReturnValue(true);
    mockActiveRunCount.mockReturnValue({ data: 0 });
    mockCompletedRunBadge.mockReturnValue({ unviewedCount: 0, clearBadge: vi.fn() });
    mockUseRelayEnabled.mockReturnValue(true);
    mockUseRegisteredAgents.mockReturnValue({ data: { agents: [] } });
  });

  it('renders all three chips with aria-labels', () => {
    render(<AgentContextChips />, { wrapper: Wrapper });

    expect(screen.getByLabelText('Pulse scheduler')).toBeInTheDocument();
    expect(screen.getByLabelText('Relay messaging')).toBeInTheDocument();
    expect(screen.getByLabelText('Mesh discovery')).toBeInTheDocument();
  });

  it('clicking Pulse chip calls setPulseOpen(true)', () => {
    render(<AgentContextChips />, { wrapper: Wrapper });

    fireEvent.click(screen.getByLabelText('Pulse scheduler'));
    expect(mockSetPulseOpen).toHaveBeenCalledWith(true);
  });

  it('clicking Relay chip calls setRelayOpen(true)', () => {
    render(<AgentContextChips />, { wrapper: Wrapper });

    fireEvent.click(screen.getByLabelText('Relay messaging'));
    expect(mockSetRelayOpen).toHaveBeenCalledWith(true);
  });

  it('clicking Mesh chip calls setMeshOpen(true)', () => {
    render(<AgentContextChips />, { wrapper: Wrapper });

    fireEvent.click(screen.getByLabelText('Mesh discovery'));
    expect(mockSetMeshOpen).toHaveBeenCalledWith(true);
  });
});
