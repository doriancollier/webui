// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AgentsHeader } from '../ui/AgentsHeader';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/layers/features/mesh', () => ({
  DiscoveryView: () => <div data-testid="discovery-view">DiscoveryView</div>,
}));

vi.mock('../ui/CommandPaletteTrigger', () => ({
  CommandPaletteTrigger: () => (
    <button data-testid="command-palette-trigger" aria-label="Open command palette">
      Cmd
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

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentsHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Agents" page title', () => {
    render(<AgentsHeader />);
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('renders Scan for Agents button', () => {
    render(<AgentsHeader />);
    expect(screen.getByRole('button', { name: /scan for agents/i })).toBeInTheDocument();
  });

  it('opens discovery dialog on Scan button click', () => {
    render(<AgentsHeader />);

    // Discovery view not visible initially
    expect(screen.queryByTestId('discovery-view')).not.toBeInTheDocument();

    // Click the scan button
    fireEvent.click(screen.getByRole('button', { name: /scan for agents/i }));

    // Discovery view should now be visible in dialog
    expect(screen.getByTestId('discovery-view')).toBeInTheDocument();
  });

  it('renders CommandPaletteTrigger', () => {
    render(<AgentsHeader />);
    expect(screen.getByTestId('command-palette-trigger')).toBeInTheDocument();
  });
});
