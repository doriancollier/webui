/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { TransportProvider } from '@/layers/shared/model';
import { createMockSchedule } from '@dorkos/test-utils';

// Mock cronstrue to avoid parsing issues in tests
vi.mock('cronstrue', () => ({
  default: { toString: (cron: string) => `Every: ${cron}` },
}));

// Mock CreateScheduleDialog
vi.mock('../ui/CreateScheduleDialog', () => ({
  CreateScheduleDialog: (props: { open: boolean; editSchedule?: unknown }) => {
    if (!props.open) return null;
    return (
      <div data-testid="create-schedule-dialog">
        {props.editSchedule ? 'Edit Schedule' : 'New Schedule'}
      </div>
    );
  },
}));

// Mock RunHistoryPanel
vi.mock('../ui/RunHistoryPanel', () => ({
  RunHistoryPanel: ({ scheduleId }: { scheduleId: string }) => (
    <div data-testid={`run-history-${scheduleId}`}>Run History for {scheduleId}</div>
  ),
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

// Import PulsePanel after mocks are set up
import { PulsePanel } from '../ui/PulsePanel';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('PulsePanel', () => {
  it('renders schedule list when data is available', async () => {
    const schedules = [
      createMockSchedule({ id: 'sched-1', name: 'Daily review', cron: '0 9 * * 1-5' }),
      createMockSchedule({ id: 'sched-2', name: 'Weekly cleanup', cron: '0 0 * * 0' }),
    ];
    const transport = createMockTransport({
      listSchedules: vi.fn().mockResolvedValue(schedules),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    await waitFor(() => {
      expect(screen.getByText('Daily review')).toBeTruthy();
    });

    expect(screen.getByText('Weekly cleanup')).toBeTruthy();
  });

  it('shows loading state initially', () => {
    // Use a transport that returns a never-resolving promise
    const transport = createMockTransport({
      listSchedules: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    expect(screen.getByText('Loading schedules...')).toBeTruthy();
  });

  it('"New Schedule" button opens create dialog', async () => {
    const transport = createMockTransport();

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    await waitFor(() => {
      expect(screen.getByText('New Schedule')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('New Schedule'));

    expect(screen.getByTestId('create-schedule-dialog')).toBeTruthy();
    // Dialog should be in create mode (no editSchedule)
    expect(screen.getByText('New Schedule', { selector: '[data-testid="create-schedule-dialog"]' })).toBeTruthy();
  });

  it('edit button opens dialog in edit mode', async () => {
    const schedule = createMockSchedule({ id: 'sched-1', name: 'My Job' });
    const transport = createMockTransport({
      listSchedules: vi.fn().mockResolvedValue([schedule]),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    await waitFor(() => {
      expect(screen.getByText('My Job')).toBeTruthy();
    });

    const editButton = screen.getByLabelText('Edit My Job');
    fireEvent.click(editButton);

    expect(screen.getByTestId('create-schedule-dialog')).toBeTruthy();
    expect(screen.getByText('Edit Schedule')).toBeTruthy();
  });

  it('"Run Now" button calls triggerSchedule', async () => {
    const schedule = createMockSchedule({ id: 'sched-1', name: 'My Job', enabled: true });
    const transport = createMockTransport({
      listSchedules: vi.fn().mockResolvedValue([schedule]),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    await waitFor(() => {
      expect(screen.getByText('My Job')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Run Now'));

    await waitFor(() => {
      expect(transport.triggerSchedule).toHaveBeenCalledWith('sched-1');
    });
  });

  it('toggle switch calls updateSchedule with enabled flag', async () => {
    const schedule = createMockSchedule({ id: 'sched-1', name: 'My Job', enabled: true });
    const transport = createMockTransport({
      listSchedules: vi.fn().mockResolvedValue([schedule]),
      updateSchedule: vi.fn().mockResolvedValue({ ...schedule, enabled: false }),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    await waitFor(() => {
      expect(screen.getByText('My Job')).toBeTruthy();
    });

    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(transport.updateSchedule).toHaveBeenCalledWith('sched-1', { enabled: false });
    });
  });

  it('approve button updates pending schedule to active', async () => {
    const schedule = createMockSchedule({
      id: 'sched-1',
      name: 'Pending Job',
      status: 'pending_approval',
    });
    const transport = createMockTransport({
      listSchedules: vi.fn().mockResolvedValue([schedule]),
      updateSchedule: vi.fn().mockResolvedValue({ ...schedule, status: 'active', enabled: true }),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    await waitFor(() => {
      expect(screen.getByText('Pending Job')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(transport.updateSchedule).toHaveBeenCalledWith('sched-1', {
        status: 'active',
        enabled: true,
      });
    });
  });

  it('reject button deletes pending schedule', async () => {
    const schedule = createMockSchedule({
      id: 'sched-1',
      name: 'Pending Job',
      status: 'pending_approval',
    });
    const transport = createMockTransport({
      listSchedules: vi.fn().mockResolvedValue([schedule]),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    await waitFor(() => {
      expect(screen.getByText('Pending Job')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Reject'));

    await waitFor(() => {
      expect(transport.deleteSchedule).toHaveBeenCalledWith('sched-1');
    });
  });

  it('clicking schedule row expands/collapses run history', async () => {
    const schedule = createMockSchedule({ id: 'sched-1', name: 'My Job' });
    const transport = createMockTransport({
      listSchedules: vi.fn().mockResolvedValue([schedule]),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    await waitFor(() => {
      expect(screen.getByText('My Job')).toBeTruthy();
    });

    // Run history should not be visible initially
    expect(screen.queryByTestId('run-history-sched-1')).toBeNull();

    // Click the row to expand
    fireEvent.click(screen.getByText('My Job'));
    expect(screen.getByTestId('run-history-sched-1')).toBeTruthy();

    // Click again to collapse
    fireEvent.click(screen.getByText('My Job'));
    expect(screen.queryByTestId('run-history-sched-1')).toBeNull();
  });
});
