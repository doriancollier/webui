// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { createMockTransport } from '@dorkos/test-utils';
import { TransportProvider } from '@/layers/shared/model';
import { useMeshEnabled } from '../model/use-mesh-config';
import { useRegisteredAgents } from '../model/use-mesh-agents';
import { useDiscoverAgents } from '../model/use-mesh-discover';
import { useRegisterAgent } from '../model/use-mesh-register';
import { useDenyAgent } from '../model/use-mesh-deny';
import { useUnregisterAgent } from '../model/use-mesh-unregister';
import { useUpdateAgent } from '../model/use-mesh-update';
import { useDeniedAgents } from '../model/use-mesh-denied';

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

function createConfigWrapper(meshEnabled: boolean) {
  const transport = createMockTransport({
    getConfig: vi.fn().mockResolvedValue({
      version: '1.0.0',
      port: 4242,
      uptime: 0,
      workingDirectory: '/test',
      nodeVersion: 'v20.0.0',
      claudeCliPath: null,
      tunnel: { enabled: false, connected: false, url: null, authEnabled: false, tokenConfigured: false },
      mesh: { enabled: meshEnabled },
    }),
  });
  const { Wrapper } = createWrapper(transport);
  return { Wrapper, transport };
}

// ---------------------------------------------------------------------------
// useMeshEnabled
// ---------------------------------------------------------------------------
describe('useMeshEnabled', () => {
  it('returns true when mesh.enabled is true in config', async () => {
    const { Wrapper } = createConfigWrapper(true);
    const { result } = renderHook(() => useMeshEnabled(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('returns false when mesh.enabled is false in config', async () => {
    const { Wrapper } = createConfigWrapper(false);
    const { result } = renderHook(() => useMeshEnabled(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('returns false when config has no mesh field', async () => {
    const transport = createMockTransport({
      getConfig: vi.fn().mockResolvedValue({
        version: '1.0.0',
        port: 4242,
        uptime: 0,
        workingDirectory: '/test',
        nodeVersion: 'v20.0.0',
        claudeCliPath: null,
        tunnel: { enabled: false, connected: false, url: null, authEnabled: false, tokenConfigured: false },
      }),
    });
    const { Wrapper } = createWrapper(transport);
    const { result } = renderHook(() => useMeshEnabled(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('returns false before config loads', () => {
    const transport = createMockTransport({
      getConfig: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    });
    const { Wrapper } = createWrapper(transport);
    const { result } = renderHook(() => useMeshEnabled(), { wrapper: Wrapper });

    expect(result.current).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useRegisteredAgents
// ---------------------------------------------------------------------------
describe('useRegisteredAgents', () => {
  const mockAgents = {
    agents: [
      { id: 'agent-1', name: 'Agent One', runtime: 'claude-code', capabilities: ['code'] },
      { id: 'agent-2', name: 'Agent Two', runtime: 'custom', capabilities: ['search'] },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches agents from transport.listMeshAgents', async () => {
    const transport = createMockTransport({
      listMeshAgents: vi.fn().mockResolvedValue(mockAgents),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useRegisteredAgents(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockAgents);
    expect(transport.listMeshAgents).toHaveBeenCalledTimes(1);
    expect(transport.listMeshAgents).toHaveBeenCalledWith(undefined);
  });

  it('passes filters to transport', async () => {
    const transport = createMockTransport({
      listMeshAgents: vi.fn().mockResolvedValue(mockAgents),
    });
    const { Wrapper } = createWrapper(transport);
    const filters = { runtime: 'claude-code', capability: 'code' };

    const { result } = renderHook(() => useRegisteredAgents(filters), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(transport.listMeshAgents).toHaveBeenCalledWith(filters);
  });

  it('skips fetching when enabled is false', () => {
    const transport = createMockTransport({
      listMeshAgents: vi.fn().mockResolvedValue(mockAgents),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useRegisteredAgents(undefined, false), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(transport.listMeshAgents).not.toHaveBeenCalled();
  });

  it('exposes error state on transport failure', async () => {
    const transport = createMockTransport({
      listMeshAgents: vi.fn().mockRejectedValue(new Error('Fetch failed')),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useRegisteredAgents(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// useDiscoverAgents
// ---------------------------------------------------------------------------
describe('useDiscoverAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls transport.discoverMeshAgents with roots and maxDepth', async () => {
    const mockResult = { candidates: [{ path: '/agents/a1', name: 'A1' }] };
    const transport = createMockTransport({
      discoverMeshAgents: vi.fn().mockResolvedValue(mockResult),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useDiscoverAgents(), { wrapper: Wrapper });

    result.current.mutate({ roots: ['/agents'], maxDepth: 3 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(transport.discoverMeshAgents).toHaveBeenCalledWith(['/agents'], 3);
    expect(result.current.data).toEqual(mockResult);
  });

  it('exposes error state on transport failure', async () => {
    const transport = createMockTransport({
      discoverMeshAgents: vi.fn().mockRejectedValue(new Error('Discovery failed')),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useDiscoverAgents(), { wrapper: Wrapper });

    result.current.mutate({ roots: ['/agents'] });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// useRegisterAgent
// ---------------------------------------------------------------------------
describe('useRegisterAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls transport.registerMeshAgent with path and overrides', async () => {
    const mockResult = { id: 'new-agent', name: 'New Agent' };
    const transport = createMockTransport({
      registerMeshAgent: vi.fn().mockResolvedValue(mockResult),
      listMeshAgents: vi.fn().mockResolvedValue({ agents: [] }),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useRegisterAgent(), { wrapper: Wrapper });

    result.current.mutate({ path: '/agents/new', overrides: { name: 'Custom' }, approver: 'admin' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(transport.registerMeshAgent).toHaveBeenCalledWith('/agents/new', { name: 'Custom' }, 'admin');
  });

  it('invalidates agents query on success', async () => {
    const transport = createMockTransport({
      registerMeshAgent: vi.fn().mockResolvedValue({ id: 'new-agent' }),
      listMeshAgents: vi.fn().mockResolvedValue({ agents: [] }),
    });
    const { Wrapper, queryClient } = createWrapper(transport);

    // Prime the agents cache
    const { result: agentsResult } = renderHook(() => useRegisteredAgents(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(agentsResult.current.isSuccess).toBe(true);
    });

    const { result } = renderHook(() => useRegisterAgent(), { wrapper: Wrapper });

    result.current.mutate({ path: '/agents/new' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Cache invalidation triggers a refetch
    await waitFor(() => {
      expect(transport.listMeshAgents).toHaveBeenCalledTimes(2);
    });
  });
});

// ---------------------------------------------------------------------------
// useDenyAgent
// ---------------------------------------------------------------------------
describe('useDenyAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls transport.denyMeshAgent with path and reason', async () => {
    const transport = createMockTransport({
      denyMeshAgent: vi.fn().mockResolvedValue({ success: true }),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useDenyAgent(), { wrapper: Wrapper });

    result.current.mutate({ path: '/agents/bad', reason: 'untrusted', denier: 'admin' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(transport.denyMeshAgent).toHaveBeenCalledWith('/agents/bad', 'untrusted', 'admin');
  });

  it('invalidates denied query on success', async () => {
    const transport = createMockTransport({
      denyMeshAgent: vi.fn().mockResolvedValue({ success: true }),
      listDeniedMeshAgents: vi.fn().mockResolvedValue({ denied: [] }),
    });
    const { Wrapper } = createWrapper(transport);

    // Prime the denied cache
    const { result: deniedResult } = renderHook(() => useDeniedAgents(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(deniedResult.current.isSuccess).toBe(true);
    });

    const { result } = renderHook(() => useDenyAgent(), { wrapper: Wrapper });

    result.current.mutate({ path: '/agents/bad' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Cache invalidation triggers a refetch
    await waitFor(() => {
      expect(transport.listDeniedMeshAgents).toHaveBeenCalledTimes(2);
    });
  });
});

// ---------------------------------------------------------------------------
// useUnregisterAgent
// ---------------------------------------------------------------------------
describe('useUnregisterAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls transport.unregisterMeshAgent with agent id', async () => {
    const transport = createMockTransport({
      unregisterMeshAgent: vi.fn().mockResolvedValue({ success: true }),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useUnregisterAgent(), { wrapper: Wrapper });

    result.current.mutate('agent-1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(transport.unregisterMeshAgent).toHaveBeenCalledWith('agent-1');
  });

  it('invalidates agents query on success', async () => {
    const transport = createMockTransport({
      unregisterMeshAgent: vi.fn().mockResolvedValue({ success: true }),
      listMeshAgents: vi.fn().mockResolvedValue({ agents: [] }),
    });
    const { Wrapper } = createWrapper(transport);

    // Prime the agents cache
    const { result: agentsResult } = renderHook(() => useRegisteredAgents(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(agentsResult.current.isSuccess).toBe(true);
    });

    const { result } = renderHook(() => useUnregisterAgent(), { wrapper: Wrapper });

    result.current.mutate('agent-1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(transport.listMeshAgents).toHaveBeenCalledTimes(2);
    });
  });

  it('exposes error state on transport failure', async () => {
    const transport = createMockTransport({
      unregisterMeshAgent: vi.fn().mockRejectedValue(new Error('Unregister failed')),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useUnregisterAgent(), { wrapper: Wrapper });

    result.current.mutate('agent-1');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// useUpdateAgent
// ---------------------------------------------------------------------------
describe('useUpdateAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls transport.updateMeshAgent with id and updates', async () => {
    const mockResult = { id: 'agent-1', name: 'Updated' };
    const transport = createMockTransport({
      updateMeshAgent: vi.fn().mockResolvedValue(mockResult),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useUpdateAgent(), { wrapper: Wrapper });

    result.current.mutate({ id: 'agent-1', updates: { name: 'Updated' } });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(transport.updateMeshAgent).toHaveBeenCalledWith('agent-1', { name: 'Updated' });
    expect(result.current.data).toEqual(mockResult);
  });

  it('invalidates agents query on success', async () => {
    const transport = createMockTransport({
      updateMeshAgent: vi.fn().mockResolvedValue({ id: 'agent-1' }),
      listMeshAgents: vi.fn().mockResolvedValue({ agents: [] }),
    });
    const { Wrapper } = createWrapper(transport);

    // Prime the agents cache
    const { result: agentsResult } = renderHook(() => useRegisteredAgents(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(agentsResult.current.isSuccess).toBe(true);
    });

    const { result } = renderHook(() => useUpdateAgent(), { wrapper: Wrapper });

    result.current.mutate({ id: 'agent-1', updates: { name: 'Updated' } });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(transport.listMeshAgents).toHaveBeenCalledTimes(2);
    });
  });
});

// ---------------------------------------------------------------------------
// useDeniedAgents
// ---------------------------------------------------------------------------
describe('useDeniedAgents', () => {
  const mockDenied = {
    denied: [
      { path: '/agents/bad', reason: 'untrusted', deniedAt: '2026-01-01T00:00:00Z' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches denied list from transport.listDeniedMeshAgents', async () => {
    const transport = createMockTransport({
      listDeniedMeshAgents: vi.fn().mockResolvedValue(mockDenied),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useDeniedAgents(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDenied);
    expect(transport.listDeniedMeshAgents).toHaveBeenCalledTimes(1);
  });

  it('skips fetching when enabled is false', () => {
    const transport = createMockTransport({
      listDeniedMeshAgents: vi.fn().mockResolvedValue(mockDenied),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useDeniedAgents(false), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(transport.listDeniedMeshAgents).not.toHaveBeenCalled();
  });

  it('exposes error state on transport failure', async () => {
    const transport = createMockTransport({
      listDeniedMeshAgents: vi.fn().mockRejectedValue(new Error('Denied fetch failed')),
    });
    const { Wrapper } = createWrapper(transport);

    const { result } = renderHook(() => useDeniedAgents(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
