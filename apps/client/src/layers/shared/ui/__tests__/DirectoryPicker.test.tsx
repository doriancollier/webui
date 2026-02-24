/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { createMockTransport } from '@dorkos/test-utils';
import { TransportProvider } from '@/layers/shared/model';
import { DirectoryPicker } from '../DirectoryPicker';

// Mock app-store (recentCwds)
vi.mock('@/layers/shared/model/app-store', () => ({
  useAppStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      recentCwds: [
        { path: '/home/user/project-a', accessedAt: '2026-02-07T12:00:00Z' },
        { path: '/home/user/project-b', accessedAt: '2026-02-06T10:00:00Z' },
      ],
    };
    return selector ? selector(state) : state;
  },
}));

// Mock shared/lib utilities
vi.mock('@/layers/shared/lib', () => ({
  formatRelativeTime: () => '1h ago',
  shortenHomePath: (p: string) => p.replace('/home/user', '~'),
  STORAGE_KEYS: { PICKER_VIEW: 'dorkos-picker-view' },
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

let mockTransport: Transport;

function renderPicker(props: { onSelect?: (path: string) => void; initialPath?: string } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onSelect = props.onSelect ?? vi.fn();
  return render(
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={mockTransport}>
        <DirectoryPicker
          open={true}
          onOpenChange={vi.fn()}
          onSelect={onSelect}
          initialPath={props.initialPath ?? '/home/user'}
        />
      </TransportProvider>
    </QueryClientProvider>
  );
}

describe('DirectoryPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport = createMockTransport();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  it('renders dialog title', () => {
    renderPicker();
    expect(screen.getByText('Select Working Directory')).toBeDefined();
  });

  it('shows directory entries after switching to browse view', async () => {
    // With recentCwds populated, the picker defaults to "recent" view
    // Switch to browse by clicking the Browse button
    renderPicker();

    fireEvent.click(screen.getByLabelText('Browse directories'));

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeDefined();
      expect(screen.getByText('Projects')).toBeDefined();
    });
  });

  it('calls onSelect when Select button is clicked in browse view', async () => {
    const onSelect = vi.fn();
    renderPicker({ onSelect });

    fireEvent.click(screen.getByLabelText('Browse directories'));

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Select'));

    expect(onSelect).toHaveBeenCalledWith('/home/user');
  });

  it('shows recent directories in default view', () => {
    renderPicker();

    // Recent view is default when recentCwds has entries
    expect(screen.getByText('~/project-a')).toBeDefined();
    expect(screen.getByText('~/project-b')).toBeDefined();
  });

  it('calls onSelect when clicking a recent directory', () => {
    const onSelect = vi.fn();
    renderPicker({ onSelect });

    fireEvent.click(screen.getByText('~/project-a'));

    expect(onSelect).toHaveBeenCalledWith('/home/user/project-a');
  });
});
