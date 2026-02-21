/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { TransportProvider } from '@/layers/shared/model';
import { usePulseEnabled } from '../model/use-pulse-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTransport(overrides: Partial<Transport> = {}): Transport {
  return {
    listSessions: vi.fn().mockResolvedValue([]),
    createSession: vi.fn(),
    getSession: vi.fn(),
    getMessages: vi.fn().mockResolvedValue({ messages: [] }),
    getTasks: vi.fn().mockResolvedValue({ tasks: [] }),
    sendMessage: vi.fn(),
    approveTool: vi.fn(),
    denyTool: vi.fn(),
    submitAnswers: vi.fn().mockResolvedValue({ ok: true }),
    getCommands: vi.fn(),
    health: vi.fn(),
    updateSession: vi.fn(),
    browseDirectory: vi.fn().mockResolvedValue({ path: '/test', entries: [], parent: null }),
    getDefaultCwd: vi.fn().mockResolvedValue({ path: '/test/cwd' }),
    listFiles: vi.fn().mockResolvedValue({ files: [], truncated: false, total: 0 }),
    getConfig: vi.fn().mockResolvedValue({
      version: '1.0.0',
      port: 4242,
      uptime: 0,
      workingDirectory: '/test',
      nodeVersion: 'v20.0.0',
      claudeCliPath: null,
      tunnel: {
        enabled: false,
        connected: false,
        url: null,
        authEnabled: false,
        tokenConfigured: false,
      },
    }),
    getGitStatus: vi.fn().mockResolvedValue({ error: 'not_git_repo' as const }),
    startTunnel: vi.fn().mockResolvedValue({ url: 'https://test.ngrok.io' }),
    stopTunnel: vi.fn().mockResolvedValue(undefined),
    listSchedules: vi.fn().mockResolvedValue([]),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn().mockResolvedValue({ success: true }),
    triggerSchedule: vi.fn().mockResolvedValue({ runId: 'run-1' }),
    listRuns: vi.fn().mockResolvedValue([]),
    getRun: vi.fn(),
    cancelRun: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

function createWrapper(transport: Transport) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePulseEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when pulse.enabled is true', async () => {
    const transport = createMockTransport({
      getConfig: vi.fn().mockResolvedValue({
        version: '1.0.0',
        port: 4242,
        uptime: 0,
        workingDirectory: '/test',
        nodeVersion: 'v20.0.0',
        claudeCliPath: null,
        tunnel: {
          enabled: false,
          connected: false,
          url: null,
          authEnabled: false,
          tokenConfigured: false,
        },
        pulse: { enabled: true },
      }),
    });

    const { result } = renderHook(() => usePulseEnabled(), {
      wrapper: createWrapper(transport),
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('returns false when pulse.enabled is false', async () => {
    const transport = createMockTransport({
      getConfig: vi.fn().mockResolvedValue({
        version: '1.0.0',
        port: 4242,
        uptime: 0,
        workingDirectory: '/test',
        nodeVersion: 'v20.0.0',
        claudeCliPath: null,
        tunnel: {
          enabled: false,
          connected: false,
          url: null,
          authEnabled: false,
          tokenConfigured: false,
        },
        pulse: { enabled: false },
      }),
    });

    const { result } = renderHook(() => usePulseEnabled(), {
      wrapper: createWrapper(transport),
    });

    await waitFor(() => {
      // Query resolves, pulse.enabled is false
      expect(transport.getConfig).toHaveBeenCalledTimes(1);
    });

    expect(result.current).toBe(false);
  });

  it('returns false when pulse field is undefined in config', async () => {
    const transport = createMockTransport({
      getConfig: vi.fn().mockResolvedValue({
        version: '1.0.0',
        port: 4242,
        uptime: 0,
        workingDirectory: '/test',
        nodeVersion: 'v20.0.0',
        claudeCliPath: null,
        tunnel: {
          enabled: false,
          connected: false,
          url: null,
          authEnabled: false,
          tokenConfigured: false,
        },
        // no pulse field
      }),
    });

    const { result } = renderHook(() => usePulseEnabled(), {
      wrapper: createWrapper(transport),
    });

    await waitFor(() => {
      expect(transport.getConfig).toHaveBeenCalledTimes(1);
    });

    expect(result.current).toBe(false);
  });

  it('returns false while config is loading', () => {
    const transport = createMockTransport({
      // Never resolves, simulating loading state
      getConfig: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    const { result } = renderHook(() => usePulseEnabled(), {
      wrapper: createWrapper(transport),
    });

    // Before the query resolves, should default to false
    expect(result.current).toBe(false);
  });
});
