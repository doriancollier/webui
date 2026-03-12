/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { AdapterCard } from '../ui/AdapterCard';
import type { AdapterManifest, CatalogInstance } from '@dorkos/shared/relay-schemas';

// ---------------------------------------------------------------------------
// Mock entity hooks — AdapterCard now calls useBindings and useRegisteredAgents
// ---------------------------------------------------------------------------

const mockUseBindings = vi.fn();
const mockUseRegisteredAgents = vi.fn();

vi.mock('@/layers/entities/binding', () => ({
  useBindings: (...args: unknown[]) => mockUseBindings(...args),
}));

vi.mock('@/layers/entities/mesh', () => ({
  useRegisteredAgents: (...args: unknown[]) => mockUseRegisteredAgents(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseManifest: AdapterManifest = {
  type: 'telegram',
  displayName: 'Telegram',
  description: 'Telegram messaging adapter',
  iconEmoji: '📨',
  category: 'messaging',
  builtin: false,
  configFields: [],
  multiInstance: false,
};

const claudeManifest: AdapterManifest = {
  type: 'claude-code',
  displayName: 'Claude Code',
  description: 'Built-in Claude Code adapter',
  iconEmoji: '🤖',
  category: 'internal',
  builtin: true,
  configFields: [],
  multiInstance: false,
};

const connectedInstance: CatalogInstance = {
  id: 'tg-main',
  enabled: true,
  status: {
    id: 'tg-main',
    type: 'telegram',
    displayName: 'Main Telegram',
    state: 'connected',
    messageCount: { inbound: 42, outbound: 18 },
    errorCount: 0,
  },
};

const errorInstance: CatalogInstance = {
  id: 'tg-err',
  enabled: true,
  status: {
    id: 'tg-err',
    type: 'telegram',
    displayName: 'Error Telegram',
    state: 'error',
    messageCount: { inbound: 5, outbound: 0 },
    errorCount: 3,
    lastError: 'Connection timed out',
  },
};

const disabledInstance: CatalogInstance = {
  id: 'tg-disabled',
  enabled: false,
  status: {
    id: 'tg-disabled',
    type: 'telegram',
    displayName: 'Disabled Telegram',
    state: 'disconnected',
    messageCount: { inbound: 0, outbound: 0 },
    errorCount: 0,
  },
};

const claudeInstance: CatalogInstance = {
  id: 'claude-code',
  enabled: true,
  status: {
    id: 'claude-code',
    type: 'claude-code',
    displayName: 'Claude Code',
    state: 'connected',
    messageCount: { inbound: 10, outbound: 5 },
    errorCount: 0,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides: Partial<Parameters<typeof AdapterCard>[0]> = {}) {
  return {
    instance: connectedInstance,
    manifest: baseManifest,
    onToggle: vi.fn(),
    onConfigure: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
}

/** Opens the Radix DropdownMenu trigger using the full pointer sequence required in jsdom. */
async function openKebabMenu() {
  const trigger = screen.getByLabelText('Adapter actions');
  await act(async () => {
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdapterCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no bindings, no agents — tests that need them override per-case
    mockUseBindings.mockReturnValue({ data: [] });
    mockUseRegisteredAgents.mockReturnValue({ data: { agents: [] } });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the adapter display name', () => {
    render(<AdapterCard {...defaultProps()} />);
    expect(screen.getByText('Main Telegram')).toBeTruthy();
  });

  it('renders the category badge', () => {
    render(<AdapterCard {...defaultProps()} />);
    expect(screen.getByText('messaging')).toBeTruthy();
  });

  it('renders the icon emoji', () => {
    render(<AdapterCard {...defaultProps()} />);
    expect(screen.getByText('📨')).toBeTruthy();
  });

  it('shows a green left border for connected state', () => {
    const { container } = render(<AdapterCard {...defaultProps()} />);
    const card = container.querySelector('.border-l-green-500');
    expect(card).toBeTruthy();
  });

  it('shows a red left border for error state', () => {
    const { container } = render(
      <AdapterCard {...defaultProps({ instance: errorInstance })} />,
    );
    const card = container.querySelector('.border-l-red-500');
    expect(card).toBeTruthy();
  });

  it('shows a red left border for disconnected state', () => {
    const { container } = render(
      <AdapterCard {...defaultProps({ instance: disabledInstance })} />,
    );
    // disconnected maps to border-l-red-500 in the unified status color system
    const card = container.querySelector('.border-l-red-500');
    expect(card).toBeTruthy();
  });

  it('displays inbound and outbound message counts', () => {
    render(<AdapterCard {...defaultProps()} />);
    expect(screen.getByText(/In: 42/)).toBeTruthy();
    expect(screen.getByText(/Out: 18/)).toBeTruthy();
  });

  it('does not show error count when errorCount is 0', () => {
    render(<AdapterCard {...defaultProps()} />);
    expect(screen.queryByText(/Errors:/)).toBeNull();
  });

  it('shows error count when errorCount is greater than 0', () => {
    render(<AdapterCard {...defaultProps({ instance: errorInstance })} />);
    expect(screen.getByText(/Errors: 3/)).toBeTruthy();
  });

  it('shows lastError message when present', () => {
    render(<AdapterCard {...defaultProps({ instance: errorInstance })} />);
    expect(screen.getByText('Connection timed out')).toBeTruthy();
  });

  it('renders switch in checked state when adapter is enabled', () => {
    render(<AdapterCard {...defaultProps()} />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl.getAttribute('data-state')).toBe('checked');
  });

  it('renders switch in unchecked state when adapter is disabled', () => {
    render(<AdapterCard {...defaultProps({ instance: disabledInstance })} />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl.getAttribute('data-state')).toBe('unchecked');
  });

  it('calls onToggle with true when switch is clicked while disabled', () => {
    const onToggle = vi.fn();
    render(<AdapterCard {...defaultProps({ instance: disabledInstance, onToggle })} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('calls onToggle with false when switch is clicked while enabled', () => {
    const onToggle = vi.fn();
    render(<AdapterCard {...defaultProps({ onToggle })} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('falls back to instance id when displayName is empty', () => {
    const noNameInstance: CatalogInstance = {
      ...connectedInstance,
      status: { ...connectedInstance.status, displayName: '' },
    };
    render(<AdapterCard {...defaultProps({ instance: noNameInstance })} />);
    expect(screen.getByText('tg-main')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Kebab menu tests
  // -------------------------------------------------------------------------

  it('opens kebab menu when clicking the actions button', async () => {
    render(<AdapterCard {...defaultProps()} />);

    await openKebabMenu();

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Configure/i })).toBeTruthy();
      expect(screen.getByRole('menuitem', { name: /Remove/i })).toBeTruthy();
    });
  });

  it('calls onConfigure when Configure menu item is clicked', async () => {
    const onConfigure = vi.fn();
    render(<AdapterCard {...defaultProps({ onConfigure })} />);

    await openKebabMenu();

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Configure/i })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Configure/i }));
    });

    expect(onConfigure).toHaveBeenCalledTimes(1);
  });

  it('opens confirmation dialog when Remove menu item is clicked', async () => {
    render(<AdapterCard {...defaultProps()} />);

    await openKebabMenu();

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Remove/i })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Remove/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Remove adapter')).toBeTruthy();
      expect(screen.getByText(/Are you sure you want to remove/)).toBeTruthy();
    });
  });

  it('calls onRemove when confirmation dialog is confirmed', async () => {
    const onRemove = vi.fn();
    render(<AdapterCard {...defaultProps({ onRemove })} />);

    await openKebabMenu();

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Remove/i })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Remove/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeTruthy();
    });

    // Find the confirm "Remove" button inside the alert dialog.
    const dialog = screen.getByRole('alertdialog');
    const buttons = dialog.querySelectorAll('button');
    // AlertDialogFooter order: Cancel, then Action (Remove)
    const confirmBtn = buttons[buttons.length - 1];

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables Remove for built-in claude-code adapter', async () => {
    render(
      <AdapterCard
        {...defaultProps({ instance: claudeInstance, manifest: claudeManifest })}
      />,
    );

    await openKebabMenu();

    await waitFor(() => {
      const removeItem = screen.getByRole('menuitem', { name: /Remove/i });
      expect(removeItem).toBeTruthy();
      expect(removeItem.getAttribute('data-disabled')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Error Collapsible tests
  // -------------------------------------------------------------------------

  it('renders Collapsible trigger when lastError is set', () => {
    render(<AdapterCard {...defaultProps({ instance: errorInstance })} />);
    const trigger = screen.getByRole('button', { name: 'Toggle full error message' });
    expect(trigger).toBeTruthy();
  });

  it('shows truncated error preview by default', () => {
    render(<AdapterCard {...defaultProps({ instance: errorInstance })} />);
    const trigger = screen.getByRole('button', { name: 'Toggle full error message' });
    expect(trigger.textContent).toContain('Connection timed out');
    const collapsibleContent = document.querySelector('[data-slot="collapsible-content"]');
    expect(collapsibleContent?.getAttribute('data-state')).toBe('closed');
  });

  it('shows full error text when trigger is clicked', async () => {
    render(<AdapterCard {...defaultProps({ instance: errorInstance })} />);
    const trigger = screen.getByRole('button', { name: 'Toggle full error message' });

    await act(async () => {
      fireEvent.click(trigger);
    });

    await waitFor(() => {
      const collapsibleContent = document.querySelector('[data-slot="collapsible-content"]');
      expect(collapsibleContent?.getAttribute('data-state')).toBe('open');
    });
  });

  it('collapses error text when trigger is clicked again', async () => {
    render(<AdapterCard {...defaultProps({ instance: errorInstance })} />);
    const trigger = screen.getByRole('button', { name: 'Toggle full error message' });

    await act(async () => {
      fireEvent.click(trigger);
    });

    await waitFor(() => {
      const collapsibleContent = document.querySelector('[data-slot="collapsible-content"]');
      expect(collapsibleContent?.getAttribute('data-state')).toBe('open');
    });

    await act(async () => {
      fireEvent.click(trigger);
    });

    await waitFor(() => {
      const collapsibleContent = document.querySelector('[data-slot="collapsible-content"]');
      expect(collapsibleContent?.getAttribute('data-state')).toBe('closed');
    });
  });

  it('trigger is a button element with correct aria attributes for keyboard access', () => {
    render(<AdapterCard {...defaultProps({ instance: errorInstance })} />);
    const trigger = screen.getByRole('button', { name: 'Toggle full error message' });

    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBeTruthy();
  });

  it('does not render Collapsible when lastError is null', () => {
    render(<AdapterCard {...defaultProps()} />);
    expect(screen.queryByRole('button', { name: 'Toggle full error message' })).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Label display tests (task 3.2)
  // -------------------------------------------------------------------------

  it('shows label as primary text when label is set', () => {
    const labeledInstance: CatalogInstance = {
      ...connectedInstance,
      label: 'My Bot',
    };
    render(<AdapterCard {...defaultProps({ instance: labeledInstance })} />);
    expect(screen.getByText('My Bot')).toBeTruthy();
  });

  it('shows adapter type displayName as secondary text when label is set', () => {
    const labeledInstance: CatalogInstance = {
      ...connectedInstance,
      label: 'My Bot',
    };
    render(<AdapterCard {...defaultProps({ instance: labeledInstance })} />);
    // Primary label shown, and secondary should be the status displayName
    expect(screen.getByText('My Bot')).toBeTruthy();
    expect(screen.getByText('Main Telegram')).toBeTruthy();
  });

  it('falls back to status displayName as primary when no label set', () => {
    render(<AdapterCard {...defaultProps({ instance: connectedInstance })} />);
    expect(screen.getByText('Main Telegram')).toBeTruthy();
  });

  it('does not show secondary text line when no label is set', () => {
    // When there is no custom label, secondaryName is null so no duplicate line
    render(<AdapterCard {...defaultProps({ instance: connectedInstance })} />);
    // 'Main Telegram' should appear exactly once (as primary, not duplicated as secondary)
    const elements = screen.getAllByText('Main Telegram');
    expect(elements).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Status dot tests (task 3.2)
  // -------------------------------------------------------------------------

  it('shows green status dot when connected with bindings', () => {
    mockUseBindings.mockReturnValue({
      data: [{ id: 'b1', adapterId: 'tg-main', agentId: 'agent-1', projectPath: '/p', sessionStrategy: 'per-chat', label: '', createdAt: '', updatedAt: '' }],
    });
    const { container } = render(<AdapterCard {...defaultProps()} />);
    expect(container.querySelector('.bg-green-500')).toBeTruthy();
  });

  it('shows amber pulsing status dot when connected with no bindings', () => {
    mockUseBindings.mockReturnValue({ data: [] });
    const { container } = render(<AdapterCard {...defaultProps()} />);
    expect(container.querySelector('.bg-amber-500')).toBeTruthy();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows red status dot when adapter is in error state', () => {
    const { container } = render(<AdapterCard {...defaultProps({ instance: errorInstance })} />);
    expect(container.querySelector('.bg-red-500')).toBeTruthy();
  });

  it('shows gray status dot when adapter is disconnected', () => {
    const { container } = render(<AdapterCard {...defaultProps({ instance: disabledInstance })} />);
    expect(container.querySelector('.bg-gray-400')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Bound agents display tests (task 3.2)
  // -------------------------------------------------------------------------

  it('shows bound agent names when bindings exist', () => {
    mockUseBindings.mockReturnValue({
      data: [{ id: 'b1', adapterId: 'tg-main', agentId: 'agent-1', projectPath: '/p', sessionStrategy: 'per-chat', label: '', createdAt: '', updatedAt: '' }],
    });
    mockUseRegisteredAgents.mockReturnValue({
      data: { agents: [{ id: 'agent-1', name: 'Alpha Bot' }] },
    });
    render(<AdapterCard {...defaultProps()} />);
    expect(screen.getByText(/Alpha Bot/)).toBeTruthy();
  });

  it('falls back to agentId when agent is not in registry', () => {
    mockUseBindings.mockReturnValue({
      data: [{ id: 'b1', adapterId: 'tg-main', agentId: 'agent-unknown', projectPath: '/p', sessionStrategy: 'per-chat', label: '', createdAt: '', updatedAt: '' }],
    });
    render(<AdapterCard {...defaultProps()} />);
    expect(screen.getByText(/agent-unknown/)).toBeTruthy();
  });

  it('shows "No agent bound" text when connected with no bindings', () => {
    mockUseBindings.mockReturnValue({ data: [] });
    render(<AdapterCard {...defaultProps()} />);
    expect(screen.getByText('No agent bound')).toBeTruthy();
  });

  it('does not show "No agent bound" when disconnected', () => {
    mockUseBindings.mockReturnValue({ data: [] });
    render(<AdapterCard {...defaultProps({ instance: disabledInstance })} />);
    expect(screen.queryByText('No agent bound')).toBeNull();
  });

  it('shows "Bind" button when connected with no bindings and onBindClick provided', () => {
    mockUseBindings.mockReturnValue({ data: [] });
    const onBindClick = vi.fn();
    render(<AdapterCard {...defaultProps({ onBindClick })} />);
    expect(screen.getByRole('button', { name: 'Bind' })).toBeTruthy();
  });

  it('does not show "Bind" button when onBindClick not provided', () => {
    mockUseBindings.mockReturnValue({ data: [] });
    render(<AdapterCard {...defaultProps()} />);
    expect(screen.queryByRole('button', { name: 'Bind' })).toBeNull();
  });

  it('calls onBindClick when "Bind" button is clicked', () => {
    mockUseBindings.mockReturnValue({ data: [] });
    const onBindClick = vi.fn();
    render(<AdapterCard {...defaultProps({ onBindClick })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bind' }));
    expect(onBindClick).toHaveBeenCalledTimes(1);
  });

  it('does not show "No agent bound" when bindings exist', () => {
    mockUseBindings.mockReturnValue({
      data: [{ id: 'b1', adapterId: 'tg-main', agentId: 'agent-1', projectPath: '/p', sessionStrategy: 'per-chat', label: '', createdAt: '', updatedAt: '' }],
    });
    render(<AdapterCard {...defaultProps()} />);
    expect(screen.queryByText('No agent bound')).toBeNull();
  });
});
