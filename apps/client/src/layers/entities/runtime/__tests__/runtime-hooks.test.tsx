// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { createMockTransport } from '@dorkos/test-utils';
import { TransportProvider } from '@/layers/shared/model';
import { useRuntimeCapabilities, useDefaultCapabilities } from '../model/use-runtime-capabilities';

function createWrapper(transport: Transport) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <TransportProvider transport={transport}>{children}</TransportProvider>
      </QueryClientProvider>
    ),
  };
}

const mockCapabilitiesResponse = {
  capabilities: {
    'claude-code': {
      type: 'claude-code',
      supportsPermissionModes: true,
      supportsToolApproval: true,
      supportsCostTracking: false,
      supportsResume: true,
      supportsMcp: true,
      supportsQuestionPrompt: true,
    },
  },
  defaultRuntime: 'claude-code',
};

// ---------------------------------------------------------------------------
// useRuntimeCapabilities
// ---------------------------------------------------------------------------
describe('useRuntimeCapabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches capabilities from transport.getCapabilities', async () => {
    const transport = createMockTransport({
      getCapabilities: vi.fn().mockResolvedValue(mockCapabilitiesResponse),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useRuntimeCapabilities(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockCapabilitiesResponse);
    expect(transport.getCapabilities).toHaveBeenCalledTimes(1);
  });

  it('exposes error state on transport failure', async () => {
    const transport = createMockTransport({
      getCapabilities: vi.fn().mockRejectedValue(new Error('Capabilities fetch failed')),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useRuntimeCapabilities(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('uses staleTime: Infinity — does not refetch on re-mount with cached data', async () => {
    const transport = createMockTransport({
      getCapabilities: vi.fn().mockResolvedValue(mockCapabilitiesResponse),
    });
    const { Wrapper, queryClient } = createWrapper(transport);

    // First render — loads data
    const { result: r1 } = renderHook(() => useRuntimeCapabilities(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(r1.current.isSuccess).toBe(true);
    });

    // Second render of the same hook with the same query client — should use cache
    const { result: r2 } = renderHook(() => useRuntimeCapabilities(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(r2.current.isSuccess).toBe(true);
    });

    // getCapabilities should only have been called once despite two renders
    expect(transport.getCapabilities).toHaveBeenCalledTimes(1);
    void queryClient; // keep reference alive
  });

  it('returns capabilities with correct runtime type', async () => {
    const transport = createMockTransport({
      getCapabilities: vi.fn().mockResolvedValue(mockCapabilitiesResponse),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useRuntimeCapabilities(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.defaultRuntime).toBe('claude-code');
    expect(result.current.data?.capabilities['claude-code'].type).toBe('claude-code');
  });
});

// ---------------------------------------------------------------------------
// useDefaultCapabilities
// ---------------------------------------------------------------------------
describe('useDefaultCapabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the default runtime capabilities', async () => {
    const transport = createMockTransport({
      getCapabilities: vi.fn().mockResolvedValue(mockCapabilitiesResponse),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useDefaultCapabilities(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current?.type).toBe('claude-code');
    expect(result.current?.supportsPermissionModes).toBe(true);
    expect(result.current?.supportsToolApproval).toBe(true);
    expect(result.current?.supportsResume).toBe(true);
    expect(result.current?.supportsMcp).toBe(true);
    expect(result.current?.supportsQuestionPrompt).toBe(true);
  });

  it('returns undefined while data is loading', () => {
    // Never-resolving promise to simulate loading state
    const transport = createMockTransport({
      getCapabilities: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useDefaultCapabilities(), { wrapper: Wrapper });

    expect(result.current).toBeUndefined();
  });

  it('returns undefined when getCapabilities fails', async () => {
    const transport = createMockTransport({
      getCapabilities: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useDefaultCapabilities(), { wrapper: Wrapper });

    await waitFor(() => {
      // Wait for the error state to settle (retry: false)
      expect(transport.getCapabilities).toHaveBeenCalled();
    });

    // After error, data is undefined so hook returns undefined
    expect(result.current).toBeUndefined();
  });

  it('resolves the correct default runtime when multiple runtimes are present', async () => {
    const multiRuntimeResponse = {
      capabilities: {
        'claude-code': {
          type: 'claude-code',
          supportsPermissionModes: true,
          supportsToolApproval: true,
          supportsCostTracking: false,
          supportsResume: true,
          supportsMcp: true,
          supportsQuestionPrompt: true,
        },
        opencode: {
          type: 'opencode',
          supportsPermissionModes: false,
          supportsToolApproval: false,
          supportsCostTracking: false,
          supportsResume: false,
          supportsMcp: false,
          supportsQuestionPrompt: false,
        },
      },
      defaultRuntime: 'opencode',
    };

    const transport = createMockTransport({
      getCapabilities: vi.fn().mockResolvedValue(multiRuntimeResponse),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useDefaultCapabilities(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Should return opencode capabilities since it is the defaultRuntime
    expect(result.current?.type).toBe('opencode');
    expect(result.current?.supportsPermissionModes).toBe(false);
  });
});
