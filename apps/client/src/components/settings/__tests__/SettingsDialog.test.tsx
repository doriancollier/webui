// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@lifeos/shared/transport';
import { TransportProvider } from '../../../contexts/TransportContext';
import { SettingsDialog } from '../SettingsDialog';

// Mock motion/react to render plain elements
vi.mock('motion/react', () => ({
  motion: new Proxy({}, {
    get: (_target: unknown, prop: string) => {
      return ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
        const Tag = prop as keyof React.JSX.IntrinsicElements;
        return <Tag {...props}>{children}</Tag>;
      };
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MotionConfig: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useIsMobile to always return false (desktop dialog)
vi.mock('../../../hooks/use-is-mobile', () => ({
  useIsMobile: () => false,
}));

// Mock Radix dialog portal to render inline
vi.mock('@radix-ui/react-dialog', async () => {
  const actual = await vi.importActual<typeof import('@radix-ui/react-dialog')>('@radix-ui/react-dialog');
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Mock Radix Tabs to render all tab content (no hide/show behavior)
vi.mock('@radix-ui/react-tabs', () => ({
  Root: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  List: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => <div role="tablist" {...props}>{children}</div>,
  Trigger: ({ children, value, ...props }: Record<string, unknown> & { children?: React.ReactNode; value?: string }) => <button role="tab" data-value={value} {...props}>{children}</button>,
  Content: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => <div role="tabpanel" {...props}>{children}</div>,
}));

beforeAll(() => {
  // matchMedia mock for useTheme
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

const mockConfig = {
  version: '1.0.0',
  port: 6942,
  uptime: 8130,
  workingDirectory: '/home/user/project',
  nodeVersion: 'v20.11.0',
  claudeCliPath: '/usr/local/bin/claude',
  tunnel: {
    enabled: true,
    connected: true,
    url: 'https://abc123.ngrok.io',
    authEnabled: false,
    tokenConfigured: true,
  },
};

function createMockTransport(configOverrides?: Partial<typeof mockConfig>): Transport {
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
    getConfig: vi.fn().mockResolvedValue({ ...mockConfig, ...configOverrides }),
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

describe('SettingsDialog', () => {
  // Verifies the dialog renders with the correct title
  it('renders with "Settings" title when open', () => {
    render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText('Settings')).toBeDefined();
  });

  // Verifies all six preference controls are visible
  it('displays all preference controls', () => {
    render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText('Theme')).toBeDefined();
    expect(screen.getByText('Font size')).toBeDefined();
    expect(screen.getByText('Show timestamps')).toBeDefined();
    expect(screen.getByText('Expand tool calls')).toBeDefined();
    expect(screen.getByText('Show dev tools')).toBeDefined();
    expect(screen.getByText('Verbose logging')).toBeDefined();
  });

  // Verifies server config section appears with fetched data
  it('displays server configuration after loading', async () => {
    const transport = createMockTransport();
    render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper(transport) },
    );
    // All tab content is rendered (tabs are mocked to show all content)
    const version = await screen.findByText('1.0.0');
    expect(version).toBeDefined();
    expect(screen.getByText('6942')).toBeDefined();
    expect(screen.getByText('/home/user/project')).toBeDefined();
  });

  // Verifies sensitive values show badges, not raw token values
  it('shows badges for sensitive values instead of raw data', async () => {
    const transport = createMockTransport();
    render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper(transport) },
    );
    const badge = await screen.findByText('Configured');
    expect(badge).toBeDefined();
  });

  // Verifies the dialog content is not rendered when closed
  it('does not render content when closed', () => {
    render(
      <SettingsDialog open={false} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.queryByText('Settings')).toBeNull();
  });

  // Verifies uptime is formatted in human-readable form
  it('formats uptime as human-readable string', async () => {
    const transport = createMockTransport({ uptime: 8130 });
    render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper(transport) },
    );
    // 8130s = 2h 15m 30s
    const uptime = await screen.findByText('2h 15m 30s');
    expect(uptime).toBeDefined();
  });

  // Verifies tab navigation structure renders correctly
  it('renders three tabs: Preferences, Status Bar, Server', () => {
    render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByRole('tab', { name: /preferences/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /status bar/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /server/i })).toBeDefined();
  });

  // Verifies Status Bar tab shows toggle switches
  it('switches to Status Bar tab and shows toggle switches', () => {
    render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByRole('tab', { name: /status bar/i }));
    // All tab content is rendered (tabs are mocked to show all content)
    expect(screen.getByText(/show directory/i)).toBeDefined();
    expect(screen.getByText(/show permission mode/i)).toBeDefined();
    expect(screen.getByText(/show model/i)).toBeDefined();
    expect(screen.getByText(/show cost/i)).toBeDefined();
    expect(screen.getByText(/show context usage/i)).toBeDefined();
  });

  // Verifies status bar toggles default to ON
  it('has all status bar toggles enabled by default', () => {
    render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByRole('tab', { name: /status bar/i }));
    // All tab panels are rendered (tabs are mocked). Find the Status Bar panel
    // by locating the "Show directory" label and walking up to its tabpanel.
    const statusBarLabel = screen.getByText(/show directory/i);
    const statusBarPanel = statusBarLabel.closest('[role="tabpanel"]')!;
    const switches = statusBarPanel.querySelectorAll('[role="switch"]');
    expect(switches.length).toBe(5);
    switches.forEach((sw) => {
      expect(sw.getAttribute('data-state')).toBe('checked');
    });
  });

  // Verifies server tab content is accessible
  it('switches to Server tab and shows config', async () => {
    const transport = createMockTransport();
    render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper(transport) },
    );
    fireEvent.click(screen.getByRole('tab', { name: /server/i }));
    await screen.findByText(/version/i);
  });
});
