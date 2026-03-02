// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { RestartDialog } from '../ui/RestartDialog';
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

describe('RestartDialog', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onRestartComplete: vi.fn(),
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

  it('displays confirmation text about active sessions', () => {
    render(<RestartDialog {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByText(/active sessions will be interrupted/i)).toBeInTheDocument();
  });

  it('calls transport.restartServer on confirm', async () => {
    render(<RestartDialog {...defaultProps} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: /restart server/i }));
    await waitFor(() => {
      expect(mockTransport.restartServer).toHaveBeenCalled();
    });
  });

  it('calls onRestartComplete callback on success', async () => {
    render(<RestartDialog {...defaultProps} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: /restart server/i }));
    await waitFor(() => {
      expect(defaultProps.onRestartComplete).toHaveBeenCalled();
    });
  });
});
