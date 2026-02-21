/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { TransportProvider } from '@/layers/shared/model';
import { createMockRun } from '@dorkos/test-utils';
import { RunHistoryPanel } from '../ui/RunHistoryPanel';

const mockSetActiveSession = vi.fn();

vi.mock('@/layers/entities/session', () => ({
  useSessionId: vi.fn(() => [null, mockSetActiveSession]),
}));

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

describe('RunHistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders run list with status indicators', async () => {
    const runs = [
      createMockRun({ id: 'run-1', status: 'completed', trigger: 'scheduled' }),
      createMockRun({ id: 'run-2', status: 'failed', trigger: 'manual' }),
      createMockRun({ id: 'run-3', status: 'running', trigger: 'scheduled' }),
    ];
    const transport = createMockTransport({
      listRuns: vi.fn().mockResolvedValue(runs),
    });
    const Wrapper = createWrapper(transport);

    render(
      <Wrapper>
        <RunHistoryPanel scheduleId="sched-1" />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByTitle('Completed')).toBeTruthy();
      expect(screen.getByTitle('Failed')).toBeTruthy();
      expect(screen.getByTitle('Running')).toBeTruthy();
    });
  });

  it('shows duration for completed runs', async () => {
    const runs = [
      createMockRun({ id: 'run-1', status: 'completed', durationMs: 65000 }),
    ];
    const transport = createMockTransport({
      listRuns: vi.fn().mockResolvedValue(runs),
    });
    const Wrapper = createWrapper(transport);

    render(
      <Wrapper>
        <RunHistoryPanel scheduleId="sched-1" />
      </Wrapper>
    );

    await waitFor(() => {
      // 65000ms = 1m 5s
      expect(screen.getByText('1m 5s')).toBeTruthy();
    });
  });

  it('shows cancel button only for running jobs', async () => {
    const runs = [
      createMockRun({ id: 'run-1', status: 'running', trigger: 'scheduled' }),
      createMockRun({ id: 'run-2', status: 'completed', trigger: 'manual' }),
    ];
    const transport = createMockTransport({
      listRuns: vi.fn().mockResolvedValue(runs),
    });
    const Wrapper = createWrapper(transport);

    render(
      <Wrapper>
        <RunHistoryPanel scheduleId="sched-1" />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByTitle('Running')).toBeTruthy();
    });

    // Only one Cancel button should exist (for the running job)
    const cancelButtons = screen.getAllByText('Cancel');
    expect(cancelButtons).toHaveLength(1);
  });

  it('clicking a run navigates to its session', async () => {
    const runs = [
      createMockRun({ id: 'run-1', status: 'completed', sessionId: 'session-abc' }),
    ];
    const transport = createMockTransport({
      listRuns: vi.fn().mockResolvedValue(runs),
    });
    const Wrapper = createWrapper(transport);

    render(
      <Wrapper>
        <RunHistoryPanel scheduleId="sched-1" />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByTitle('Completed')).toBeTruthy();
    });

    // Click the run row
    const row = screen.getByTitle('Completed').closest('[class*="cursor-pointer"]');
    expect(row).toBeTruthy();
    fireEvent.click(row!);

    expect(mockSetActiveSession).toHaveBeenCalledWith('session-abc');
  });

  it('shows loading state', () => {
    const transport = createMockTransport({
      listRuns: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    const Wrapper = createWrapper(transport);

    render(
      <Wrapper>
        <RunHistoryPanel scheduleId="sched-1" />
      </Wrapper>
    );

    expect(screen.getByText('Loading runs...')).toBeTruthy();
  });
});
