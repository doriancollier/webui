/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { TransportProvider } from '@/layers/shared/model';
import type { PulseSchedule } from '@dorkos/shared/types';

// Mocks must be declared before component import so Vitest can hoist them
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      initial,
      animate,
      exit,
      transition,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) => {
      void initial;
      void animate;
      void exit;
      void transition;
      return <div {...props}>{children}</div>;
    },
  },
}));

vi.mock('cronstrue', () => ({
  default: { toString: (cron: string) => `Every: ${cron}` },
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

// Shallow-render RunHistoryPanel to avoid deep fetching in ScheduleRow tests
vi.mock('../ui/RunHistoryPanel', () => ({
  RunHistoryPanel: ({ scheduleId }: { scheduleId: string }) => (
    <div data-testid="run-history">{scheduleId}</div>
  ),
}));

// Import after vi.mock calls
import { ScheduleRow } from '../ui/ScheduleRow';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const activeSchedule: PulseSchedule = {
  id: 'sched-1',
  name: 'Daily Review',
  prompt: 'Review code',
  cron: '0 9 * * *',
  enabled: true,
  status: 'active',
  cwd: null,
  timezone: null,
  maxRuntime: null,
  permissionMode: 'acceptEdits',
  nextRun: new Date(Date.now() + 3600000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const pendingSchedule: PulseSchedule = {
  ...activeSchedule,
  id: 'sched-2',
  name: 'Pending Task',
  status: 'pending_approval',
};

const disabledSchedule: PulseSchedule = {
  ...activeSchedule,
  id: 'sched-3',
  name: 'Disabled Task',
  enabled: false,
};

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
      pulse: { enabled: true },
    }),
    getGitStatus: vi.fn().mockResolvedValue({ error: 'not_git_repo' as const }),
    startTunnel: vi.fn().mockResolvedValue({ url: 'https://test.ngrok.io' }),
    stopTunnel: vi.fn().mockResolvedValue(undefined),
    listSchedules: vi.fn().mockResolvedValue([]),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn().mockResolvedValue({ ...activeSchedule }),
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

function renderScheduleRow(
  schedule: PulseSchedule,
  opts: { expanded?: boolean; onEdit?: () => void; onToggleExpand?: () => void } = {},
  transport?: Transport,
) {
  const { expanded = false, onEdit = vi.fn(), onToggleExpand = vi.fn() } = opts;
  const t = transport ?? createMockTransport();
  const Wrapper = createWrapper(t);
  return render(
    <Wrapper>
      <ScheduleRow
        schedule={schedule}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onEdit={onEdit}
      />
    </Wrapper>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScheduleRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders active schedule with name and cron description', () => {
    renderScheduleRow(activeSchedule);

    expect(screen.getByText('Daily Review')).toBeTruthy();
    // cronstrue mock returns "Every: <cron>"
    expect(screen.getByText(/Every: 0 9 \* \* \*/)).toBeTruthy();
  });

  it('shows Switch toggle for active schedules', () => {
    renderScheduleRow(activeSchedule);

    // Radix Switch renders with role="switch"
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('shows Switch toggle for disabled schedules', () => {
    renderScheduleRow(disabledSchedule);

    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('shows Approve and Reject buttons for pending_approval schedules', () => {
    renderScheduleRow(pendingSchedule);

    expect(screen.getByText('Approve')).toBeTruthy();
    expect(screen.getByText('Reject')).toBeTruthy();
  });

  it('does not show Switch for pending_approval schedules', () => {
    renderScheduleRow(pendingSchedule);

    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('opens dropdown menu with Edit, Run Now, Delete items', async () => {
    renderScheduleRow(activeSchedule);

    const trigger = screen.getByLabelText(`Actions for ${activeSchedule.name}`);
    // Radix DropdownMenu requires the full pointer sequence to open in jsdom
    await act(async () => {
      fireEvent.pointerDown(trigger);
      fireEvent.mouseDown(trigger);
      fireEvent.click(trigger);
    });

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Edit/i })).toBeTruthy();
    });

    expect(screen.getByRole('menuitem', { name: /Run Now/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Delete/i })).toBeTruthy();
  });

  it('calls onEdit when Edit menu item is clicked', async () => {
    const onEdit = vi.fn();
    renderScheduleRow(activeSchedule, { onEdit });

    const trigger = screen.getByLabelText(`Actions for ${activeSchedule.name}`);
    await act(async () => {
      fireEvent.pointerDown(trigger);
      fireEvent.mouseDown(trigger);
      fireEvent.click(trigger);
    });

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Edit/i })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Edit/i }));
    });

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('shows delete confirmation dialog when Delete menu item is clicked', async () => {
    renderScheduleRow(activeSchedule);

    const trigger = screen.getByLabelText(`Actions for ${activeSchedule.name}`);
    await act(async () => {
      fireEvent.pointerDown(trigger);
      fireEvent.mouseDown(trigger);
      fireEvent.click(trigger);
    });

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Delete/i })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Delete/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Delete schedule')).toBeTruthy();
    });

    // Dialog body mentions the schedule name — allow multiple matches (schedule row + dialog)
    expect(screen.getAllByText(/Daily Review/).length).toBeGreaterThan(0);
    expect(screen.getByText(/cannot be undone/i)).toBeTruthy();
  });

  it('expands run history when expanded prop is true', () => {
    renderScheduleRow(activeSchedule, { expanded: true });

    expect(screen.getByTestId('run-history')).toBeTruthy();
  });

  it('does not render run history when expanded is false', () => {
    renderScheduleRow(activeSchedule, { expanded: false });

    expect(screen.queryByTestId('run-history')).toBeNull();
  });

  it('calls onToggleExpand when the row body is clicked', async () => {
    const onToggleExpand = vi.fn();
    renderScheduleRow(activeSchedule, { onToggleExpand });

    // The schedule name sits inside the clickable row body (role="button")
    await act(async () => {
      fireEvent.click(screen.getByText('Daily Review'));
    });

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });
});
