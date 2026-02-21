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

// Mock motion/react so AnimatePresence exits synchronously in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
      void initial; void animate; void exit; void transition;
      return <div {...props}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

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

// Mock ScheduleRow so PulsePanel tests focus on state orchestration.
// Exposes onEdit and onToggleExpand as buttons so tests can invoke them directly.
vi.mock('../ui/ScheduleRow', () => ({
  ScheduleRow: ({
    schedule,
    expanded,
    onToggleExpand,
    onEdit,
  }: {
    schedule: { id: string; name: string };
    expanded: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
  }) => (
    <div data-testid={`schedule-row-${schedule.id}`}>
      <span>{schedule.name}</span>
      <button onClick={onToggleExpand}>Toggle {schedule.name}</button>
      <button onClick={onEdit} aria-label={`Edit ${schedule.name}`}>Edit</button>
      {expanded && <div data-testid={`run-history-${schedule.id}`}>Run History for {schedule.id}</div>}
    </div>
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
      pulse: { enabled: true },
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

  it('shows loading state initially', async () => {
    // Use a transport where config resolves (to enable pulse) but schedules never resolve
    const transport = createMockTransport({
      listSchedules: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    // Wait for config to resolve (enabling pulse), then confirm skeleton is shown
    await waitFor(() => {
      // Skeleton rows have animate-pulse elements; check for the skeleton container
      const skeletonDots = document.querySelectorAll('.animate-pulse');
      expect(skeletonDots.length).toBeGreaterThan(0);
    });
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

  it('onEdit callback from ScheduleRow opens dialog in edit mode', async () => {
    const schedule = createMockSchedule({ id: 'sched-1', name: 'My Job' });
    const transport = createMockTransport({
      listSchedules: vi.fn().mockResolvedValue([schedule]),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    await waitFor(() => {
      expect(screen.getByText('My Job')).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText('Edit My Job'));

    expect(screen.getByTestId('create-schedule-dialog')).toBeTruthy();
    expect(screen.getByText('Edit Schedule')).toBeTruthy();
  });

  it('passes correct props to ScheduleRow', async () => {
    const schedule = createMockSchedule({ id: 'sched-1', name: 'My Job', enabled: true });
    const transport = createMockTransport({
      listSchedules: vi.fn().mockResolvedValue([schedule]),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    await waitFor(() => {
      expect(screen.getByTestId('schedule-row-sched-1')).toBeTruthy();
    });

    // ScheduleRow receives the schedule and is initially collapsed
    expect(screen.queryByTestId('run-history-sched-1')).toBeNull();
  });

  it('renders a ScheduleRow for each schedule', async () => {
    const schedules = [
      createMockSchedule({ id: 'sched-1', name: 'Daily review' }),
      createMockSchedule({ id: 'sched-2', name: 'Weekly cleanup' }),
    ];
    const transport = createMockTransport({
      listSchedules: vi.fn().mockResolvedValue(schedules),
    });

    render(<PulsePanel />, { wrapper: createWrapper(transport) });

    await waitFor(() => {
      expect(screen.getByTestId('schedule-row-sched-1')).toBeTruthy();
    });

    expect(screen.getByTestId('schedule-row-sched-2')).toBeTruthy();
  });

  it('onToggleExpand from ScheduleRow expands/collapses run history', async () => {
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

    // Click the toggle button (exposed by mock ScheduleRow) to expand
    fireEvent.click(screen.getByText('Toggle My Job'));
    expect(screen.getByTestId('run-history-sched-1')).toBeTruthy();

    // Click again to collapse
    fireEvent.click(screen.getByText('Toggle My Job'));
    expect(screen.queryByTestId('run-history-sched-1')).toBeNull();
  });
});
