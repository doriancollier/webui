/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { TransportProvider } from '@/layers/shared/model';
import { createMockSchedule } from '@dorkos/test-utils';
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useTriggerSchedule,
} from '../model/use-schedules';

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

describe('useSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and caches schedule list', async () => {
    const schedules = [createMockSchedule({ id: 'sched-1', name: 'Daily review' })];
    const transport = createMockTransport({
      listSchedules: vi.fn().mockResolvedValue(schedules),
    });

    const { result } = renderHook(() => useSchedules(), {
      wrapper: createWrapper(transport),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Daily review');
    expect(transport.listSchedules).toHaveBeenCalledTimes(1);
  });

  it('returns undefined data while loading', () => {
    const transport = createMockTransport();

    const { result } = renderHook(() => useSchedules(), {
      wrapper: createWrapper(transport),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('exposes error state on failure', async () => {
    const transport = createMockTransport({
      listSchedules: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    const { result } = renderHook(() => useSchedules(), {
      wrapper: createWrapper(transport),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useCreateSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls transport.createSchedule and invalidates cache', async () => {
    const newSchedule = createMockSchedule({ id: 'sched-new', name: 'New job' });
    const transport = createMockTransport({
      createSchedule: vi.fn().mockResolvedValue(newSchedule),
      listSchedules: vi.fn().mockResolvedValue([]),
    });

    const wrapper = createWrapper(transport);

    // First, prime the schedules cache
    const { result: schedulesResult } = renderHook(() => useSchedules(), { wrapper });
    await waitFor(() => {
      expect(schedulesResult.current.isSuccess).toBe(true);
    });

    const { result } = renderHook(() => useCreateSchedule(), { wrapper });

    result.current.mutate({
      name: 'New job',
      prompt: 'Do something',
      cron: '0 9 * * 1-5',
      cwd: '/test',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(transport.createSchedule).toHaveBeenCalledWith({
      name: 'New job',
      prompt: 'Do something',
      cron: '0 9 * * 1-5',
      cwd: '/test',
    });

    // Cache should be invalidated (listSchedules called again)
    await waitFor(() => {
      expect(transport.listSchedules).toHaveBeenCalledTimes(2);
    });
  });
});

describe('useUpdateSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls transport.updateSchedule with id and input, then invalidates cache', async () => {
    const updated = createMockSchedule({ id: 'sched-1', name: 'Updated name' });
    const transport = createMockTransport({
      updateSchedule: vi.fn().mockResolvedValue(updated),
      listSchedules: vi.fn().mockResolvedValue([]),
    });

    const wrapper = createWrapper(transport);

    // Prime the cache
    const { result: schedulesResult } = renderHook(() => useSchedules(), { wrapper });
    await waitFor(() => {
      expect(schedulesResult.current.isSuccess).toBe(true);
    });

    const { result } = renderHook(() => useUpdateSchedule(), { wrapper });

    result.current.mutate({ id: 'sched-1', name: 'Updated name' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(transport.updateSchedule).toHaveBeenCalledWith('sched-1', { name: 'Updated name' });

    await waitFor(() => {
      expect(transport.listSchedules).toHaveBeenCalledTimes(2);
    });
  });
});

describe('useDeleteSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls transport.deleteSchedule and invalidates cache', async () => {
    const transport = createMockTransport({
      deleteSchedule: vi.fn().mockResolvedValue({ ok: true }),
      listSchedules: vi.fn().mockResolvedValue([]),
    });

    const wrapper = createWrapper(transport);

    // Prime the cache
    const { result: schedulesResult } = renderHook(() => useSchedules(), { wrapper });
    await waitFor(() => {
      expect(schedulesResult.current.isSuccess).toBe(true);
    });

    const { result } = renderHook(() => useDeleteSchedule(), { wrapper });

    result.current.mutate('sched-1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(transport.deleteSchedule).toHaveBeenCalledWith('sched-1');

    await waitFor(() => {
      expect(transport.listSchedules).toHaveBeenCalledTimes(2);
    });
  });
});

describe('useTriggerSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls transport.triggerSchedule and invalidates runs cache', async () => {
    const transport = createMockTransport({
      triggerSchedule: vi.fn().mockResolvedValue({ runId: 'run-42' }),
    });

    const { result } = renderHook(() => useTriggerSchedule(), {
      wrapper: createWrapper(transport),
    });

    result.current.mutate('sched-1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(transport.triggerSchedule).toHaveBeenCalledWith('sched-1');
    expect(result.current.data).toEqual({ runId: 'run-42' });
  });

  it('exposes error state on failure', async () => {
    const transport = createMockTransport({
      triggerSchedule: vi.fn().mockRejectedValue(new Error('Schedule not found')),
    });

    const { result } = renderHook(() => useTriggerSchedule(), {
      wrapper: createWrapper(transport),
    });

    result.current.mutate('nonexistent');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
