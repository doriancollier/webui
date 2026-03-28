// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Partially mock @/layers/shared/lib — preserve all real exports, override createChannel only
vi.mock('@/layers/shared/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/layers/shared/lib')>();
  return {
    ...actual,
    createChannel: vi.fn(() => ({
      postMessage: vi.fn(),
      onMessage: vi.fn(() => () => {}),
      close: vi.fn(),
    })),
  };
});

// Mock useEventSubscription from the shared model barrel
vi.mock('@/layers/shared/model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/layers/shared/model')>();
  return {
    ...actual,
    useEventSubscription: vi.fn(),
  };
});

import { useTunnelSync, broadcastTunnelChange } from '../model/use-tunnel-sync';
import { createChannel } from '@/layers/shared/lib';
import { useEventSubscription } from '@/layers/shared/model';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useTunnelSync', () => {
  it('subscribes to BroadcastChannel on mount', () => {
    const mockOnMessage = vi.fn(() => () => {});
    vi.mocked(createChannel).mockReturnValue({
      postMessage: vi.fn(),
      onMessage: mockOnMessage,
      close: vi.fn(),
    });

    renderHook(() => useTunnelSync(), { wrapper: createWrapper() });

    expect(createChannel).toHaveBeenCalledWith('dorkos-tunnel');
    expect(mockOnMessage).toHaveBeenCalled();
  });

  it('subscribes to tunnel_status via useEventSubscription', () => {
    renderHook(() => useTunnelSync(), { wrapper: createWrapper() });

    expect(useEventSubscription).toHaveBeenCalledWith('tunnel_status', expect.any(Function));
  });

  it('cleans up BroadcastChannel on unmount', () => {
    const mockClose = vi.fn();
    const mockUnsub = vi.fn();
    vi.mocked(createChannel).mockReturnValue({
      postMessage: vi.fn(),
      onMessage: vi.fn(() => mockUnsub),
      close: mockClose,
    });

    const { unmount } = renderHook(() => useTunnelSync(), { wrapper: createWrapper() });
    unmount();

    expect(mockUnsub).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });
});

describe('broadcastTunnelChange', () => {
  it('creates a channel, posts a message, and closes it', () => {
    const mockPost = vi.fn();
    const mockCloseChannel = vi.fn();
    vi.mocked(createChannel).mockReturnValue({
      postMessage: mockPost,
      onMessage: vi.fn(() => () => {}),
      close: mockCloseChannel,
    });

    broadcastTunnelChange();

    expect(createChannel).toHaveBeenCalledWith('dorkos-tunnel');
    expect(mockPost).toHaveBeenCalledWith({ type: 'tunnel_changed' });
    expect(mockCloseChannel).toHaveBeenCalled();
  });
});
