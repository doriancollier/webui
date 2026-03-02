// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AdvancedTab } from '../ui/AdvancedTab';

// Mock child dialogs to isolate AdvancedTab behavior
vi.mock('../ui/ResetDialog', () => ({
  ResetDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reset-dialog">Reset Dialog</div> : null,
}));

vi.mock('../ui/RestartDialog', () => ({
  RestartDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="restart-dialog">Restart Dialog</div> : null,
}));

describe('AdvancedTab', () => {
  const defaultProps = {
    onResetComplete: vi.fn(),
    onRestartComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the Danger Zone heading', () => {
    render(<AdvancedTab {...defaultProps} />);
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
  });

  it('renders Reset All Data and Restart Server rows', () => {
    render(<AdvancedTab {...defaultProps} />);
    expect(screen.getByText('Reset All Data')).toBeInTheDocument();
    expect(screen.getByText('Restart Server')).toBeInTheDocument();
  });

  it('opens ResetDialog when Reset button is clicked', () => {
    render(<AdvancedTab {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByTestId('reset-dialog')).toBeInTheDocument();
  });

  it('opens RestartDialog when Restart button is clicked', () => {
    render(<AdvancedTab {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /restart/i }));
    expect(screen.getByTestId('restart-dialog')).toBeInTheDocument();
  });
});
