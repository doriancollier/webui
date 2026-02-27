// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transport } from '@dorkos/shared/transport';
import { createMockTransport } from '@dorkos/test-utils';
import { TransportProvider } from '@/layers/shared/model';
import { AgentHeader } from '../ui/AgentHeader';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';

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

const mockAgent: AgentManifest = {
  id: '01HZ0000000000000000000001',
  name: 'backend-bot',
  description: 'REST API expert',
  runtime: 'claude-code',
  capabilities: ['code-review'],
  behavior: { responseMode: 'always' },
  budget: { maxHopsPerMessage: 5, maxCallsPerHour: 100 },
  registeredAt: '2026-01-01T00:00:00Z',
  registeredBy: 'dorkos-ui',
  personaEnabled: true,
};

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

describe('AgentHeader', () => {
  let mockTransport: Transport;
  const onOpenPicker = vi.fn();
  const onOpenAgentDialog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport = createMockTransport();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders agent name and description when agent exists', async () => {
    vi.mocked(mockTransport.getAgentByPath).mockResolvedValue(mockAgent);
    const Wrapper = createWrapper(mockTransport);

    render(
      <Wrapper>
        <AgentHeader cwd="/project" onOpenPicker={onOpenPicker} onOpenAgentDialog={onOpenAgentDialog} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('backend-bot')).toBeInTheDocument();
    });
    expect(screen.getByText('REST API expert')).toBeInTheDocument();
  });

  it('renders "+ Agent" button when no agent', async () => {
    vi.mocked(mockTransport.getAgentByPath).mockResolvedValue(null);
    const Wrapper = createWrapper(mockTransport);

    render(
      <Wrapper>
        <AgentHeader cwd="/project" onOpenPicker={onOpenPicker} onOpenAgentDialog={onOpenAgentDialog} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Create agent for this directory')).toBeInTheDocument();
    });
    expect(screen.queryByText('backend-bot')).not.toBeInTheDocument();
  });

  it('clicking agent info area calls onOpenAgentDialog', async () => {
    vi.mocked(mockTransport.getAgentByPath).mockResolvedValue(mockAgent);
    const Wrapper = createWrapper(mockTransport);

    render(
      <Wrapper>
        <AgentHeader cwd="/project" onOpenPicker={onOpenPicker} onOpenAgentDialog={onOpenAgentDialog} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('backend-bot')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/Agent settings for/));
    expect(onOpenAgentDialog).toHaveBeenCalledOnce();
  });

  it('clicking gear icon calls onOpenAgentDialog', async () => {
    vi.mocked(mockTransport.getAgentByPath).mockResolvedValue(mockAgent);
    const Wrapper = createWrapper(mockTransport);

    render(
      <Wrapper>
        <AgentHeader cwd="/project" onOpenPicker={onOpenPicker} onOpenAgentDialog={onOpenAgentDialog} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('backend-bot')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Agent settings'));
    expect(onOpenAgentDialog).toHaveBeenCalled();
  });

  it('clicking path breadcrumb calls onOpenPicker when agent exists', async () => {
    vi.mocked(mockTransport.getAgentByPath).mockResolvedValue(mockAgent);
    const Wrapper = createWrapper(mockTransport);

    render(
      <Wrapper>
        <AgentHeader cwd="/project" onOpenPicker={onOpenPicker} onOpenAgentDialog={onOpenAgentDialog} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('backend-bot')).toBeInTheDocument();
    });

    // The path button in agent mode has specific Change working directory label
    const cwdButtons = screen.getAllByLabelText('Change working directory');
    fireEvent.click(cwdButtons[0]);
    expect(onOpenPicker).toHaveBeenCalledOnce();
  });

  it('clicking directory button calls onOpenPicker when no agent', async () => {
    vi.mocked(mockTransport.getAgentByPath).mockResolvedValue(null);
    const Wrapper = createWrapper(mockTransport);

    render(
      <Wrapper>
        <AgentHeader cwd="/project" onOpenPicker={onOpenPicker} onOpenAgentDialog={onOpenAgentDialog} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Create agent for this directory')).toBeInTheDocument();
    });

    const cwdButtons = screen.getAllByLabelText('Change working directory');
    fireEvent.click(cwdButtons[0]);
    expect(onOpenPicker).toHaveBeenCalledOnce();
  });

  it('clicking "+ Agent" calls createAgent mutation', async () => {
    vi.mocked(mockTransport.getAgentByPath).mockResolvedValue(null);
    vi.mocked(mockTransport.createAgent).mockResolvedValue(mockAgent);
    const Wrapper = createWrapper(mockTransport);

    render(
      <Wrapper>
        <AgentHeader cwd="/project" onOpenPicker={onOpenPicker} onOpenAgentDialog={onOpenAgentDialog} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Create agent for this directory')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Create agent for this directory'));

    await waitFor(() => {
      expect(mockTransport.createAgent).toHaveBeenCalledWith('/project', undefined, undefined, undefined);
    });
  });

  it('does not show agent content during loading', () => {
    vi.mocked(mockTransport.getAgentByPath).mockReturnValue(new Promise(() => {}));
    const Wrapper = createWrapper(mockTransport);

    render(
      <Wrapper>
        <AgentHeader cwd="/project" onOpenPicker={onOpenPicker} onOpenAgentDialog={onOpenAgentDialog} />
      </Wrapper>
    );

    expect(screen.queryByText('backend-bot')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Create agent for this directory')).not.toBeInTheDocument();
  });
});
