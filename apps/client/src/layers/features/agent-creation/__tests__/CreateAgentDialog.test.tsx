/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '@/layers/shared/model';
import { createMockTransport } from '@dorkos/test-utils';
import { CreateAgentDialog } from '../ui/CreateAgentDialog';
import { useAgentCreationStore } from '../model/store';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPlayCelebration = vi.fn();
const mockPlaySliderTick = vi.fn();

vi.mock('@/layers/shared/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/layers/shared/lib')>();
  return {
    ...actual,
    playCelebration: (...args: unknown[]) => mockPlayCelebration(...args),
    playSliderTick: (...args: unknown[]) => mockPlaySliderTick(...args),
  };
});

vi.mock('sonner', () => {
  const errorFn = vi.fn();
  return {
    toast: Object.assign(vi.fn(), { error: errorFn }),
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

  // Radix Collapsible uses ResizeObserver internally
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

function renderDialog(transport = createMockTransport()) {
  const queryClient = createTestQueryClient();

  // Provide default config response
  if (!vi.isMockFunction(transport.getConfig)) {
    transport.getConfig = vi.fn();
  }
  vi.mocked(transport.getConfig).mockResolvedValue({
    version: 1,
    agents: { defaultDirectory: '~/.dork/agents', defaultAgent: 'dorkbot' },
  } as never);

  const result = render(
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>
        <CreateAgentDialog />
      </TransportProvider>
    </QueryClientProvider>
  );

  return { ...result, queryClient, transport };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateAgentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentCreationStore.setState({ isOpen: false });
  });

  afterEach(cleanup);

  it('opens via store.open() and closes on Cancel', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Dialog should not be visible initially
    expect(screen.queryByText('Create Agent')).not.toBeInTheDocument();

    // Open via store
    useAgentCreationStore.getState().open();
    expect(await screen.findByText('Create Agent')).toBeInTheDocument();

    // Close via Cancel button
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByText('Create Agent')).not.toBeInTheDocument();
    });
  });

  it('shows inline validation error for invalid name', async () => {
    const user = userEvent.setup();
    renderDialog();
    useAgentCreationStore.getState().open();

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'INVALID_NAME');

    expect(
      screen.getByText('Lowercase letters, numbers, and hyphens only. Must start with a letter.')
    ).toBeInTheDocument();
  });

  it('does not show error for valid kebab-case name', async () => {
    const user = userEvent.setup();
    renderDialog();
    useAgentCreationStore.getState().open();

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'my-agent');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables Create button when name is empty', async () => {
    renderDialog();
    useAgentCreationStore.getState().open();

    const createBtn = await screen.findByRole('button', { name: 'Create' });
    expect(createBtn).toBeDisabled();
  });

  it('disables Create button when name is invalid', async () => {
    const user = userEvent.setup();
    renderDialog();
    useAgentCreationStore.getState().open();

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, '123bad');

    const createBtn = screen.getByRole('button', { name: 'Create' });
    expect(createBtn).toBeDisabled();
  });

  it('enables Create button when name is valid', async () => {
    const user = userEvent.setup();
    renderDialog();
    useAgentCreationStore.getState().open();

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'my-agent');

    const createBtn = screen.getByRole('button', { name: 'Create' });
    expect(createBtn).toBeEnabled();
  });

  it('successful creation closes dialog, invalidates queries, and plays celebration', async () => {
    const user = userEvent.setup();
    const transport = createMockTransport();
    vi.mocked(transport.createAgent).mockResolvedValue({
      id: 'test-id',
      name: 'my-agent',
    } as never);

    const { queryClient } = renderDialog(transport);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    useAgentCreationStore.getState().open();

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'my-agent');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(transport.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'my-agent' })
      );
    });

    await waitFor(() => {
      expect(mockPlayCelebration).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['agents'] }));
    });

    await waitFor(() => {
      expect(screen.queryByText('Create Agent')).not.toBeInTheDocument();
    });
  });

  it('shows error toast on failed creation', async () => {
    const user = userEvent.setup();
    const transport = createMockTransport();
    vi.mocked(transport.createAgent).mockRejectedValue(new Error('Agent already exists'));

    renderDialog(transport);
    useAgentCreationStore.getState().open();

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'my-agent');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    const { toast } = await import('sonner');
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Agent already exists');
    });
  });

  it('toggles personality section via collapsible', async () => {
    const user = userEvent.setup();
    renderDialog();
    useAgentCreationStore.getState().open();

    await screen.findByText('Personality');

    // Personality section should be collapsed initially
    expect(screen.queryByTestId('personality-section')).not.toBeInTheDocument();

    // Expand
    await user.click(screen.getByTestId('personality-toggle'));
    expect(screen.getByTestId('personality-section')).toBeInTheDocument();

    // Should show trait sliders
    expect(screen.getByLabelText('tone trait level')).toBeInTheDocument();
    expect(screen.getByLabelText('autonomy trait level')).toBeInTheDocument();
    expect(screen.getByLabelText('caution trait level')).toBeInTheDocument();
    expect(screen.getByLabelText('communication trait level')).toBeInTheDocument();
    expect(screen.getByLabelText('creativity trait level')).toBeInTheDocument();
  });

  it('displays auto-generated directory path based on name', async () => {
    const user = userEvent.setup();
    renderDialog();
    useAgentCreationStore.getState().open();

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'scout');

    expect(screen.getByTestId('directory-preview')).toHaveTextContent('~/.dork/agents/scout');
  });
});
