// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ResetDialog } from '../ui/ResetDialog';
import { TransportProvider } from '@/layers/shared/model';
import { createMockTransport } from '@dorkos/test-utils';

// Mock Radix AlertDialog portal to render inline (prevents document.body duplication)
vi.mock('@radix-ui/react-alert-dialog', async () => {
  const actual = await vi.importActual<typeof import('@radix-ui/react-alert-dialog')>(
    '@radix-ui/react-alert-dialog'
  );
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('ResetDialog', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onResetComplete: vi.fn(),
  };

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <TransportProvider transport={mockTransport}>{children}</TransportProvider>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport = createMockTransport();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders submit button as disabled initially', () => {
    render(<ResetDialog {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByRole('button', { name: /reset all data/i })).toBeDisabled();
  });

  it('keeps submit disabled when wrong text is typed', () => {
    render(<ResetDialog {...defaultProps} />, { wrapper: Wrapper });
    fireEvent.change(screen.getByTestId('reset-confirm-input'), { target: { value: 'delete' } });
    expect(screen.getByRole('button', { name: /reset all data/i })).toBeDisabled();
  });

  it('enables submit when "reset" is typed', () => {
    render(<ResetDialog {...defaultProps} />, { wrapper: Wrapper });
    fireEvent.change(screen.getByTestId('reset-confirm-input'), { target: { value: 'reset' } });
    expect(screen.getByRole('button', { name: /reset all data/i })).toBeEnabled();
  });

  it('calls transport.resetAllData on submit', async () => {
    render(<ResetDialog {...defaultProps} />, { wrapper: Wrapper });
    fireEvent.change(screen.getByTestId('reset-confirm-input'), { target: { value: 'reset' } });
    fireEvent.click(screen.getByRole('button', { name: /reset all data/i }));
    await waitFor(() => {
      expect(mockTransport.resetAllData).toHaveBeenCalledWith('reset');
    });
  });

  it('clears localStorage on success', async () => {
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    render(<ResetDialog {...defaultProps} />, { wrapper: Wrapper });
    fireEvent.change(screen.getByTestId('reset-confirm-input'), { target: { value: 'reset' } });
    fireEvent.click(screen.getByRole('button', { name: /reset all data/i }));
    await waitFor(() => {
      expect(clearSpy).toHaveBeenCalled();
    });
    clearSpy.mockRestore();
  });

  it('calls onResetComplete callback on success', async () => {
    render(<ResetDialog {...defaultProps} />, { wrapper: Wrapper });
    fireEvent.change(screen.getByTestId('reset-confirm-input'), { target: { value: 'reset' } });
    fireEvent.click(screen.getByRole('button', { name: /reset all data/i }));
    await waitFor(() => {
      expect(defaultProps.onResetComplete).toHaveBeenCalled();
    });
  });
});
