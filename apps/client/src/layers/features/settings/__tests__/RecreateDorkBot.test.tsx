/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { createMockTransport } from '@dorkos/test-utils';
import { TransportProvider } from '@/layers/shared/model';
import { AgentsTab } from '../ui/AgentsTab';
import { RecreateDorkBotDialog } from '../ui/RecreateDorkBotDialog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPlaySliderTick = vi.fn();

vi.mock('@/layers/shared/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/layers/shared/lib')>();
  return {
    ...actual,
    playSliderTick: (...args: unknown[]) => mockPlaySliderTick(...args),
  };
});

vi.mock('sonner', () => {
  const successFn = vi.fn();
  const errorFn = vi.fn();
  return {
    toast: Object.assign(vi.fn(), { success: successFn, error: errorFn }),
  };
});

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

  // Radix Slider uses ResizeObserver internally
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper(transport: Transport) {
  const queryClient = createTestQueryClient();
  return {
    queryClient,
    Wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <TransportProvider transport={transport}>{children}</TransportProvider>
      </QueryClientProvider>
    ),
  };
}

function mockTransportWithAgents(agents: Array<{ name: string; id: string }>) {
  const transport = createMockTransport();
  vi.mocked(transport.listMeshAgents).mockResolvedValue({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: '',
      runtime: 'claude-code',
      registeredAt: new Date().toISOString(),
      registeredBy: 'test',
      personaEnabled: true,
      traits: { tone: 3, autonomy: 3, caution: 3, communication: 3, creativity: 3 },
      conventions: { soul: true, nope: true, dorkosKnowledge: true },
      enabledToolGroups: {},
    })) as never,
  });
  return transport;
}

// ---------------------------------------------------------------------------
// Tests: AgentsTab
// ---------------------------------------------------------------------------

describe('AgentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('shows Recreate DorkBot card when no agent named dorkbot exists', async () => {
    const transport = mockTransportWithAgents([{ name: 'other-agent', id: '1' }]);
    const { Wrapper } = createWrapper(transport);

    render(<AgentsTab />, { wrapper: Wrapper });

    expect(await screen.findByTestId('recreate-dorkbot-card')).toBeInTheDocument();
    expect(screen.getByText('Recreate DorkBot')).toBeInTheDocument();
    expect(
      screen.getByText(
        'DorkBot is the default DorkOS agent. It was deleted or not created during onboarding.'
      )
    ).toBeInTheDocument();
  });

  it('hides recreation card when dorkbot exists', async () => {
    const transport = mockTransportWithAgents([{ name: 'dorkbot', id: '1' }]);
    const { Wrapper } = createWrapper(transport);

    render(<AgentsTab />, { wrapper: Wrapper });

    // Wait for query to resolve and component to re-render with null
    await waitFor(() => {
      expect(screen.queryByTestId('recreate-dorkbot-card')).not.toBeInTheDocument();
    });
  });

  it('shows recreation card when agent list is empty', async () => {
    const transport = mockTransportWithAgents([]);
    const { Wrapper } = createWrapper(transport);

    render(<AgentsTab />, { wrapper: Wrapper });

    expect(await screen.findByTestId('recreate-dorkbot-card')).toBeInTheDocument();
  });

  it('clicking Recreate DorkBot opens dialog', async () => {
    const user = userEvent.setup();
    const transport = mockTransportWithAgents([]);
    const { Wrapper } = createWrapper(transport);

    render(<AgentsTab />, { wrapper: Wrapper });

    const button = await screen.findByText('Recreate DorkBot');
    await user.click(button);

    expect(await screen.findByTestId('recreate-dorkbot-dialog')).toBeInTheDocument();
    expect(
      screen.getByText("Configure DorkBot's personality. All settings can be changed later.")
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: RecreateDorkBotDialog
// ---------------------------------------------------------------------------

describe('RecreateDorkBotDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders personality sliders defaulting to level 3', () => {
    const transport = createMockTransport();
    const { Wrapper } = createWrapper(transport);

    render(<RecreateDorkBotDialog open={true} onOpenChange={vi.fn()} />, { wrapper: Wrapper });

    expect(screen.getByLabelText('tone trait level')).toBeInTheDocument();
    expect(screen.getByLabelText('autonomy trait level')).toBeInTheDocument();
    expect(screen.getByLabelText('caution trait level')).toBeInTheDocument();
    expect(screen.getByLabelText('communication trait level')).toBeInTheDocument();
    expect(screen.getByLabelText('creativity trait level')).toBeInTheDocument();

    // All should show "3/5" in their labels
    const levelLabels = screen.getAllByText(/3\/5/);
    expect(levelLabels.length).toBe(5);
  });

  it('calls transport.createAgent with name dorkbot and selected traits on Recreate', async () => {
    const user = userEvent.setup();
    const transport = createMockTransport();
    vi.mocked(transport.createAgent).mockResolvedValue({ id: 'new-id', name: 'dorkbot' } as never);
    const onOpenChange = vi.fn();

    const { queryClient, Wrapper } = createWrapper(transport);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(<RecreateDorkBotDialog open={true} onOpenChange={onOpenChange} />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: 'Recreate' }));

    await waitFor(() => {
      expect(transport.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'dorkbot',
          traits: { tone: 3, autonomy: 3, caution: 3, communication: 3, creativity: 3 },
          conventions: { soul: true, nope: true, dorkosKnowledge: true },
        })
      );
    });

    // Should show success toast
    const { toast } = await import('sonner');
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('DorkBot recreated');
    });

    // Should close dialog
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    // Should invalidate agent queries
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['agents'] }));
    });
  });

  it('shows error toast on failed recreation and keeps dialog open', async () => {
    const user = userEvent.setup();
    const transport = createMockTransport();
    vi.mocked(transport.createAgent).mockRejectedValue(new Error('Directory already exists'));
    const onOpenChange = vi.fn();

    const { Wrapper } = createWrapper(transport);

    render(<RecreateDorkBotDialog open={true} onOpenChange={onOpenChange} />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: 'Recreate' }));

    const { toast } = await import('sonner');
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Directory already exists');
    });

    // Dialog should stay open (onOpenChange not called with false)
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('closes dialog via Cancel button', async () => {
    const user = userEvent.setup();
    const transport = createMockTransport();
    const onOpenChange = vi.fn();

    const { Wrapper } = createWrapper(transport);

    render(<RecreateDorkBotDialog open={true} onOpenChange={onOpenChange} />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows Recreating... text while mutation is pending', async () => {
    const user = userEvent.setup();
    const transport = createMockTransport();

    // Never-resolving promise to keep mutation in pending state
    vi.mocked(transport.createAgent).mockReturnValue(new Promise(() => {}));

    const { Wrapper } = createWrapper(transport);

    render(<RecreateDorkBotDialog open={true} onOpenChange={vi.fn()} />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: 'Recreate' }));

    await waitFor(() => {
      expect(screen.getByText('Recreating...')).toBeInTheDocument();
    });
  });
});
