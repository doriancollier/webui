// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { TransportProvider } from '@/layers/shared/model';
import { TunnelItem } from '../ui/TunnelItem';
import type { ServerConfig } from '@dorkos/shared/types';

// Mock motion/react to render plain elements
vi.mock('motion/react', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target: unknown, prop: string) => {
        return ({
          children,
          ...props
        }: Record<string, unknown> & { children?: React.ReactNode }) => {
          const Tag = prop as keyof React.JSX.IntrinsicElements;
          return <Tag {...props}>{children}</Tag>;
        };
      },
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MotionConfig: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useIsMobile to always return false (desktop dialog)
vi.mock('@/layers/shared/model/use-is-mobile', () => ({
  useIsMobile: () => false,
}));

// Mock Radix dialog portal to render inline
vi.mock('@radix-ui/react-dialog', async () => {
  const actual =
    await vi.importActual<typeof import('@radix-ui/react-dialog')>('@radix-ui/react-dialog');
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Mock QRCode to avoid canvas rendering issues
vi.mock('react-qr-code', () => ({
  default: ({ value }: { value: string }) => <div data-testid="qr-code">{value}</div>,
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

afterEach(() => {
  cleanup();
});

function createMockTransport(): Transport {
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
    getGitStatus: vi.fn().mockResolvedValue({ error: 'not_git_repo' as const }),
    getConfig: vi.fn().mockResolvedValue({
      version: '1.0.0',
      port: 4242,
      uptime: 0,
      workingDirectory: '/tmp',
      nodeVersion: 'v20.0.0',
      claudeCliPath: null,
      tunnel: { enabled: false, connected: false, url: null, authEnabled: false, tokenConfigured: true },
    }),
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
  };
}

function createWrapper(transport?: Transport) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const t = transport || createMockTransport();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={t}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

function makeTunnel(overrides?: Partial<ServerConfig['tunnel']>): ServerConfig['tunnel'] {
  return {
    enabled: false,
    connected: false,
    url: null,
    authEnabled: false,
    tokenConfigured: true,
    ...overrides,
  };
}

describe('TunnelItem', () => {
  it('renders hostname when connected', () => {
    render(
      <TunnelItem tunnel={makeTunnel({ enabled: true, connected: true, url: 'https://abc123.ngrok-free.app' })} />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText('abc123.ngrok-free.app')).toBeDefined();
  });

  it('renders "Tunnel" text when disconnected', () => {
    render(<TunnelItem tunnel={makeTunnel()} />, { wrapper: createWrapper() });
    expect(screen.getByText('Tunnel')).toBeDefined();
  });

  it('does not show hostname when disconnected', () => {
    render(<TunnelItem tunnel={makeTunnel()} />, { wrapper: createWrapper() });
    expect(screen.queryByText(/ngrok/)).toBeNull();
  });

  it('has correct aria-label when connected', () => {
    render(
      <TunnelItem tunnel={makeTunnel({ enabled: true, connected: true, url: 'https://abc123.ngrok-free.app' })} />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByLabelText('Tunnel connected: abc123.ngrok-free.app')).toBeDefined();
  });

  it('has correct aria-label when disconnected', () => {
    render(<TunnelItem tunnel={makeTunnel()} />, { wrapper: createWrapper() });
    expect(screen.getByLabelText('Tunnel disconnected')).toBeDefined();
  });

  it('opens dialog on click', () => {
    render(<TunnelItem tunnel={makeTunnel()} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Enable remote access')).toBeDefined();
  });
});
