/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const mockInvalidate = vi.fn();
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: mockInvalidate, navigate: mockNavigate }),
}));

import { RouteErrorFallback } from '../route-error-fallback';

afterEach(cleanup);

function makeErrorProps(overrides: Partial<{ message: string; stack: string }> = {}) {
  const error = new Error(overrides.message ?? 'Test failure');
  if (overrides.stack !== undefined) {
    error.stack = overrides.stack;
  }
  return {
    error,
    reset: vi.fn(),
    info: { componentStack: '' },
  };
}

describe('RouteErrorFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders error message from error prop', () => {
    render(<RouteErrorFallback {...makeErrorProps({ message: 'Test failure' })} />);
    expect(screen.getByText('Test failure')).toBeInTheDocument();
  });

  it('renders "Something went wrong" heading', () => {
    render(<RouteErrorFallback {...makeErrorProps()} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders Retry button', () => {
    render(<RouteErrorFallback {...makeErrorProps()} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders "Go to Dashboard" button', () => {
    render(<RouteErrorFallback {...makeErrorProps()} />);
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it('calls router.invalidate() when Retry is clicked', async () => {
    const user = userEvent.setup();
    render(<RouteErrorFallback {...makeErrorProps()} />);

    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockInvalidate).toHaveBeenCalledOnce();
  });

  it('calls router.navigate({ to: "/" }) when Go to Dashboard is clicked', async () => {
    const user = userEvent.setup();
    render(<RouteErrorFallback {...makeErrorProps()} />);

    await user.click(screen.getByRole('button', { name: /go to dashboard/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
  });

  it('shows stack trace in dev mode', () => {
    // Vitest runs with import.meta.env.DEV = true by default
    render(
      <RouteErrorFallback
        {...makeErrorProps({ stack: 'Error: boom\n    at Component (file.tsx:10)' })}
      />
    );
    expect(screen.getByText('Stack trace (dev only)')).toBeInTheDocument();
  });

  it('hides stack trace in production mode', () => {
    const originalDev = import.meta.env.DEV;
    import.meta.env.DEV = false;

    try {
      render(
        <RouteErrorFallback
          {...makeErrorProps({ stack: 'Error: boom\n    at Component (file.tsx:10)' })}
        />
      );
      expect(screen.queryByText('Stack trace (dev only)')).not.toBeInTheDocument();
    } finally {
      import.meta.env.DEV = originalDev;
    }
  });
});
