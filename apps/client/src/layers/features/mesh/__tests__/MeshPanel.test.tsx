/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock entity hooks
// ---------------------------------------------------------------------------

const mockUseMeshEnabled = vi.fn().mockReturnValue(false);
const mockUseRegisteredAgents = vi.fn().mockReturnValue({ data: undefined, isLoading: false });
const mockUseDiscoverAgents = vi.fn().mockReturnValue({ mutate: vi.fn(), data: undefined, isPending: false });
const mockUseDeniedAgents = vi.fn().mockReturnValue({ data: undefined, isLoading: false });
const mockUseUnregisterAgent = vi.fn().mockReturnValue({ mutate: vi.fn() });

vi.mock('@/layers/entities/mesh', () => ({
  useMeshEnabled: (...args: unknown[]) => mockUseMeshEnabled(...args),
  useRegisteredAgents: (...args: unknown[]) => mockUseRegisteredAgents(...args),
  useDiscoverAgents: (...args: unknown[]) => mockUseDiscoverAgents(...args),
  useDeniedAgents: (...args: unknown[]) => mockUseDeniedAgents(...args),
  useUnregisterAgent: (...args: unknown[]) => mockUseUnregisterAgent(...args),
}));

import { MeshPanel } from '../ui/MeshPanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function enableMesh() {
  mockUseMeshEnabled.mockReturnValue(true);
  mockUseRegisteredAgents.mockReturnValue({ data: { agents: [] }, isLoading: false });
  mockUseDeniedAgents.mockReturnValue({ data: { denied: [] }, isLoading: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseMeshEnabled.mockReturnValue(false);
  mockUseRegisteredAgents.mockReturnValue({ data: undefined, isLoading: false });
  mockUseDiscoverAgents.mockReturnValue({ mutate: vi.fn(), data: undefined, isPending: false });
  mockUseDeniedAgents.mockReturnValue({ data: undefined, isLoading: false });
  mockUseUnregisterAgent.mockReturnValue({ mutate: vi.fn() });
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

describe('MeshPanel - disabled state', () => {
  it('renders disabled message when mesh is disabled', () => {
    render(<MeshPanel />, { wrapper: createWrapper() });
    expect(screen.getByText('Mesh is not enabled')).toBeInTheDocument();
  });

  it('shows the enable hint', () => {
    render(<MeshPanel />, { wrapper: createWrapper() });
    expect(screen.getByText('DORKOS_MESH_ENABLED=true dorkos')).toBeInTheDocument();
  });

  it('does not render any tabs when disabled', () => {
    render(<MeshPanel />, { wrapper: createWrapper() });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Enabled state - tabs render
// ---------------------------------------------------------------------------

describe('MeshPanel - enabled state', () => {
  beforeEach(enableMesh);

  it('renders all 3 tabs', () => {
    render(<MeshPanel />, { wrapper: createWrapper() });
    expect(screen.getByRole('tab', { name: 'Discovery' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Agents' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Denied' })).toBeInTheDocument();
  });

  it('has Discovery tab selected by default', () => {
    render(<MeshPanel />, { wrapper: createWrapper() });
    expect(screen.getByRole('tab', { name: 'Discovery' })).toHaveAttribute('data-state', 'active');
  });

  it('does not show disabled message', () => {
    render(<MeshPanel />, { wrapper: createWrapper() });
    expect(screen.queryByText('Mesh is not enabled')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Discovery tab (default active tab — content is visible)
// ---------------------------------------------------------------------------

describe('MeshPanel - Discovery tab', () => {
  beforeEach(enableMesh);

  it('shows scan input and button', () => {
    render(<MeshPanel />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText(/Roots to scan/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scan/ })).toBeInTheDocument();
  });

  it('disables Scan button when input is empty', () => {
    render(<MeshPanel />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /Scan/ })).toBeDisabled();
  });

  it('enables Scan button when input has text', () => {
    render(<MeshPanel />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByPlaceholderText(/Roots to scan/), {
      target: { value: '~/projects' },
    });
    expect(screen.getByRole('button', { name: /Scan/ })).not.toBeDisabled();
  });

  it('shows empty results message when scan returns no candidates', () => {
    mockUseDiscoverAgents.mockReturnValue({
      mutate: vi.fn(),
      data: { candidates: [] },
      isPending: false,
    });

    render(<MeshPanel />, { wrapper: createWrapper() });
    expect(
      screen.getByText('No agents discovered. Try scanning different directories.')
    ).toBeInTheDocument();
  });

  it('renders candidate cards when discovery returns results', () => {
    mockUseDiscoverAgents.mockReturnValue({
      mutate: vi.fn(),
      data: {
        candidates: [
          {
            path: '/opt/agents/coder',
            hints: {
              suggestedName: 'Coder',
              detectedRuntime: 'claude-code',
              description: 'A coding agent',
              inferredCapabilities: ['code', 'debug'],
            },
          },
        ],
      },
      isPending: false,
    });

    render(<MeshPanel />, { wrapper: createWrapper() });
    expect(screen.getByText('Coder')).toBeInTheDocument();
    expect(screen.getByText('/opt/agents/coder')).toBeInTheDocument();
    expect(screen.getByText('A coding agent')).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('debug')).toBeInTheDocument();
  });

  it('calls discover mutation with parsed roots on scan', () => {
    const mockMutate = vi.fn();
    mockUseDiscoverAgents.mockReturnValue({
      mutate: mockMutate,
      data: undefined,
      isPending: false,
    });

    render(<MeshPanel />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByPlaceholderText(/Roots to scan/), {
      target: { value: '~/projects, /opt/agents' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }));

    expect(mockMutate).toHaveBeenCalledWith({ roots: ['~/projects', '/opt/agents'] });
  });
});
