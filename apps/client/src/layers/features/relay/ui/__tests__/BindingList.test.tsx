/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// ---------------------------------------------------------------------------
// Mock entity hooks
// ---------------------------------------------------------------------------

const mockUseBindings = vi.fn();
const mockDeleteBinding = vi.fn();
const mockUseDeleteBinding = vi.fn();
const mockUpdateBinding = vi.fn();
const mockUseUpdateBinding = vi.fn();

vi.mock('@/layers/entities/binding', () => ({
  useBindings: (...args: unknown[]) => mockUseBindings(...args),
  useDeleteBinding: (...args: unknown[]) => mockUseDeleteBinding(...args),
  useUpdateBinding: (...args: unknown[]) => mockUseUpdateBinding(...args),
}));

const mockUseAdapterCatalog = vi.fn();

vi.mock('@/layers/entities/relay', () => ({
  useAdapterCatalog: (...args: unknown[]) => mockUseAdapterCatalog(...args),
}));

const mockUseRegisteredAgents = vi.fn();

vi.mock('@/layers/entities/mesh', () => ({
  useRegisteredAgents: (...args: unknown[]) => mockUseRegisteredAgents(...args),
}));

// Mock the BindingDialog to simplify testing — we verify it renders with correct props
const mockBindingDialog = vi.fn();
vi.mock('@/layers/features/mesh/ui/BindingDialog', () => ({
  BindingDialog: (props: Record<string, unknown>) => {
    mockBindingDialog(props);
    if (!props.open) return null;
    return (
      <div data-testid="binding-dialog">
        <span data-testid="dialog-mode">{props.mode as string}</span>
        <span data-testid="dialog-adapter">{props.adapterName as string}</span>
        <span data-testid="dialog-agent">{props.agentName as string}</span>
        <button
          data-testid="dialog-confirm"
          onClick={() =>
            (props.onConfirm as (opts: { sessionStrategy: string; label: string }) => void)({
              sessionStrategy: 'per-user',
              label: 'Updated',
            })
          }
        >
          Confirm
        </button>
      </div>
    );
  },
}));

import { BindingList } from '../BindingList';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeBinding = (overrides: Record<string, unknown> = {}) => ({
  id: 'binding-1',
  adapterId: 'telegram-1',
  agentId: 'agent-alpha',
  projectPath: '/projects/alpha',
  sessionStrategy: 'per-chat',
  label: '',
  createdAt: '2026-03-11T10:00:00Z',
  updatedAt: '2026-03-11T10:00:00Z',
  ...overrides,
});

const makeCatalogEntry = (
  type: string,
  instanceId: string,
  displayName: string,
  iconEmoji?: string,
) => ({
  manifest: {
    type,
    displayName,
    description: 'Test adapter',
    iconEmoji,
    category: 'messaging',
    builtin: false,
    configFields: [],
    multiInstance: false,
  },
  instances: [
    {
      id: instanceId,
      enabled: true,
      status: {
        state: 'running',
        displayName,
        messageCount: { inbound: 0, outbound: 0 },
        errorCount: 0,
        lastError: null,
      },
      config: {},
    },
  ],
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Opens the Radix DropdownMenu trigger using the full pointer sequence required in jsdom. */
async function openKebabMenu() {
  const trigger = screen.getByLabelText('Binding actions');
  await act(async () => {
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  mockUseBindings.mockReturnValue({ data: [], isLoading: false });
  mockUseDeleteBinding.mockReturnValue({ mutate: mockDeleteBinding });
  mockUseUpdateBinding.mockReturnValue({ mutate: mockUpdateBinding });
  mockUseAdapterCatalog.mockReturnValue({ data: [], isLoading: false });
  mockUseRegisteredAgents.mockReturnValue({ data: { agents: [] } });
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BindingList', () => {
  describe('loading state', () => {
    it('shows skeleton placeholders while loading', () => {
      mockUseBindings.mockReturnValue({ data: [], isLoading: true });
      const { container } = render(<BindingList />);
      expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    });

    it('does not render binding content while loading', () => {
      mockUseBindings.mockReturnValue({ data: [], isLoading: true });
      render(<BindingList />);
      expect(screen.queryByText('No bindings configured')).not.toBeInTheDocument();
      expect(screen.queryByText('alpha')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no bindings exist', () => {
      render(<BindingList />);
      expect(screen.getByText('No bindings configured')).toBeInTheDocument();
    });

    it('shows helper text in empty state', () => {
      render(<BindingList />);
      expect(
        screen.getByText(
          'Create your first binding to route messages from adapters to agents.',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('binding row rendering', () => {
    it('renders adapter name and agent name from mesh', () => {
      mockUseBindings.mockReturnValue({
        data: [makeBinding()],
        isLoading: false,
      });
      mockUseAdapterCatalog.mockReturnValue({
        data: [makeCatalogEntry('telegram', 'telegram-1', 'Telegram')],
        isLoading: false,
      });
      mockUseRegisteredAgents.mockReturnValue({
        data: { agents: [{ id: 'agent-alpha', name: 'Alpha Bot', icon: '🤖' }] },
      });
      render(<BindingList />);
      expect(screen.getByText('Telegram')).toBeInTheDocument();
      expect(screen.getByText('Alpha Bot')).toBeInTheDocument();
    });

    it('falls back to project path name when agent is not in mesh', () => {
      mockUseBindings.mockReturnValue({
        data: [makeBinding()],
        isLoading: false,
      });
      render(<BindingList />);
      // projectPath is '/projects/alpha' → last segment 'alpha'
      expect(screen.getByText('alpha')).toBeInTheDocument();
    });

    it('falls back to adapterId when adapter is not in catalog', () => {
      mockUseBindings.mockReturnValue({
        data: [makeBinding({ adapterId: 'unknown-adapter' })],
        isLoading: false,
      });
      render(<BindingList />);
      expect(screen.getByText('unknown-adapter')).toBeInTheDocument();
    });

    it('renders adapter icon emoji when available', () => {
      mockUseBindings.mockReturnValue({
        data: [makeBinding()],
        isLoading: false,
      });
      mockUseAdapterCatalog.mockReturnValue({
        data: [makeCatalogEntry('telegram', 'telegram-1', 'Telegram', '📨')],
        isLoading: false,
      });
      render(<BindingList />);
      expect(screen.getByText('📨')).toBeInTheDocument();
    });

    it('renders session strategy badge', () => {
      mockUseBindings.mockReturnValue({
        data: [makeBinding({ sessionStrategy: 'per-user' })],
        isLoading: false,
      });
      render(<BindingList />);
      expect(screen.getByText('Per User')).toBeInTheDocument();
    });

    it('renders chatId badge when present', () => {
      mockUseBindings.mockReturnValue({
        data: [makeBinding({ chatId: '12345', channelType: 'group' })],
        isLoading: false,
      });
      render(<BindingList />);
      expect(screen.getByText('group:12345')).toBeInTheDocument();
    });

    it('renders multiple binding rows', () => {
      mockUseBindings.mockReturnValue({
        data: [
          makeBinding({ id: 'b1', agentId: 'agent-one', projectPath: '/projects/one' }),
          makeBinding({ id: 'b2', agentId: 'agent-two', projectPath: '/projects/two' }),
        ],
        isLoading: false,
      });
      mockUseRegisteredAgents.mockReturnValue({
        data: {
          agents: [
            { id: 'agent-one', name: 'Agent One' },
            { id: 'agent-two', name: 'Agent Two' },
          ],
        },
      });
      render(<BindingList />);
      expect(screen.getByText('Agent One')).toBeInTheDocument();
      expect(screen.getByText('Agent Two')).toBeInTheDocument();
    });
  });

  describe('delete action', () => {
    it('shows delete confirmation dialog when Delete is clicked', async () => {
      mockUseBindings.mockReturnValue({
        data: [makeBinding()],
        isLoading: false,
      });
      render(<BindingList />);

      await openKebabMenu();

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Delete/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem', { name: /Delete/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Delete binding')).toBeInTheDocument();
        expect(
          screen.getByText(
            'Are you sure you want to delete this binding? Messages from the adapter will no longer be routed to the agent.',
          ),
        ).toBeInTheDocument();
      });
    });

    it('calls deleteBinding when confirmation is accepted', async () => {
      mockUseBindings.mockReturnValue({
        data: [makeBinding()],
        isLoading: false,
      });
      render(<BindingList />);

      await openKebabMenu();

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Delete/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem', { name: /Delete/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Confirm the deletion in the AlertDialog
      const dialog = screen.getByRole('alertdialog');
      const buttons = dialog.querySelectorAll('button');
      // AlertDialogFooter order: Cancel, then Action (Delete)
      const confirmBtn = buttons[buttons.length - 1];

      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(mockDeleteBinding).toHaveBeenCalledWith('binding-1');
    });

    it('closes delete dialog on cancel', async () => {
      mockUseBindings.mockReturnValue({
        data: [makeBinding()],
        isLoading: false,
      });
      render(<BindingList />);

      await openKebabMenu();

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Delete/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem', { name: /Delete/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Delete binding')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Cancel'));
      });

      await waitFor(() => {
        expect(screen.queryByText('Delete binding')).not.toBeInTheDocument();
      });
    });
  });

  describe('edit action', () => {
    it('opens BindingDialog in edit mode when Edit is clicked', async () => {
      mockUseBindings.mockReturnValue({
        data: [makeBinding({ sessionStrategy: 'stateless', label: 'My binding' })],
        isLoading: false,
      });
      mockUseAdapterCatalog.mockReturnValue({
        data: [makeCatalogEntry('telegram', 'telegram-1', 'Telegram')],
        isLoading: false,
      });
      mockUseRegisteredAgents.mockReturnValue({
        data: { agents: [{ id: 'agent-alpha', name: 'Alpha Bot' }] },
      });
      render(<BindingList />);

      await openKebabMenu();

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Edit/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem', { name: /Edit/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('binding-dialog')).toBeInTheDocument();
        expect(screen.getByTestId('dialog-mode')).toHaveTextContent('edit');
        expect(screen.getByTestId('dialog-adapter')).toHaveTextContent('Telegram');
        expect(screen.getByTestId('dialog-agent')).toHaveTextContent('Alpha Bot');
      });
    });

    it('calls updateBinding when edit dialog is confirmed', async () => {
      mockUseBindings.mockReturnValue({
        data: [makeBinding()],
        isLoading: false,
      });
      render(<BindingList />);

      await openKebabMenu();

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Edit/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem', { name: /Edit/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dialog-confirm')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('dialog-confirm'));
      });

      expect(mockUpdateBinding).toHaveBeenCalledWith({
        id: 'binding-1',
        updates: { sessionStrategy: 'per-user', label: 'Updated' },
      });
    });
  });
});
