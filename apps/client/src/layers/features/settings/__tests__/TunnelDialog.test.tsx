// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { TransportProvider } from '@/layers/shared/model';
import { TunnelDialog } from '../ui/TunnelDialog';

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

const baseTunnel = {
  enabled: false,
  connected: false,
  url: null,
  authEnabled: false,
  tokenConfigured: true,
};

function createMockTransport(tunnelOverrides?: Partial<typeof baseTunnel>): Transport {
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
      latestVersion: null,
      port: 4242,
      uptime: 0,
      workingDirectory: '/tmp',
      nodeVersion: 'v20.0.0',
      claudeCliPath: null,
      tunnel: { ...baseTunnel, ...tunnelOverrides },
    }),
    startTunnel: vi.fn().mockResolvedValue({ url: 'https://test.ngrok.io' }),
    stopTunnel: vi.fn().mockResolvedValue(undefined),
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

describe('TunnelDialog', () => {
  it('renders toggle switch when open', () => {
    render(<TunnelDialog open={true} onOpenChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByRole('switch')).toBeDefined();
    expect(screen.getByText('Enable tunnel')).toBeDefined();
  });

  it('renders "Tunnel" title when open', () => {
    render(<TunnelDialog open={true} onOpenChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Tunnel')).toBeDefined();
  });

  it('shows auth token input when tokenConfigured is false', async () => {
    const transport = createMockTransport({ tokenConfigured: false });
    render(<TunnelDialog open={true} onOpenChange={vi.fn()} />, {
      wrapper: createWrapper(transport),
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('ngrok auth token')).toBeDefined();
    });
  });

  it('shows Save button alongside auth token input', async () => {
    const transport = createMockTransport({ tokenConfigured: false });
    render(<TunnelDialog open={true} onOpenChange={vi.fn()} />, {
      wrapper: createWrapper(transport),
    });
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeDefined();
    });
  });

  it('does not show auth token input when tokenConfigured is true', () => {
    const transport = createMockTransport({ tokenConfigured: true });
    render(<TunnelDialog open={true} onOpenChange={vi.fn()} />, {
      wrapper: createWrapper(transport),
    });
    expect(screen.queryByPlaceholderText('ngrok auth token')).toBeNull();
  });

  it('does not render content when closed', () => {
    render(<TunnelDialog open={false} onOpenChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    expect(screen.queryByText('Enable tunnel')).toBeNull();
  });
});
