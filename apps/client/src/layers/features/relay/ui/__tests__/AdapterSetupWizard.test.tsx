/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '@/layers/shared/model';
import { createMockTransport } from '@dorkos/test-utils';
import { AdapterSetupWizard, unflattenConfig } from '../AdapterSetupWizard';
import type { AdapterManifest, CatalogInstance } from '@dorkos/shared/relay-schemas';

// Mock motion/react to render plain elements in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseManifest: AdapterManifest = {
  type: 'slack',
  displayName: 'Slack',
  description: 'Connect to Slack',
  category: 'messaging',
  builtin: true,
  multiInstance: false,
  configFields: [
    { key: 'token', label: 'API Token', type: 'password', required: true },
    { key: 'channel', label: 'Channel', type: 'text', required: true, default: '#general' },
    { key: 'timeout', label: 'Timeout', type: 'number', required: false },
  ],
};

const manifestWithInstructions: AdapterManifest = {
  ...baseManifest,
  setupInstructions: 'Go to slack.com/api to get your token.',
};

const manifestWithSteps: AdapterManifest = {
  ...baseManifest,
  setupSteps: [
    { stepId: 'auth', title: 'Authentication', fields: ['token'] },
    { stepId: 'settings', title: 'Settings', fields: ['channel', 'timeout'] },
  ],
};

const existingInstance: CatalogInstance & { config?: Record<string, unknown> } = {
  id: 'slack-1',
  enabled: true,
  status: {
    id: 'slack-1',
    type: 'webhook',
    displayName: 'Slack',
    state: 'connected',
    messageCount: { inbound: 0, outbound: 0 },
    errorCount: 0,
  },
  config: { token: 'secret', channel: '#dev', timeout: 30 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const mockTransport = createMockTransport();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TransportProvider transport={mockTransport}>{children}</TransportProvider>
      </QueryClientProvider>
    );
  }

  return { Wrapper, mockTransport, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdapterSetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens in add mode with empty form and adapter ID field visible', () => {
    const { Wrapper } = createWrapper();
    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Add Slack')).toBeInTheDocument();
    expect(screen.getByLabelText(/adapter id/i)).toBeInTheDocument();
    // Channel should have default value, token should be empty
    expect(screen.getByLabelText(/channel/i)).toHaveValue('#general');
  });

  it('opens in edit mode with pre-filled values and no adapter ID field', () => {
    const { Wrapper } = createWrapper();
    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
        existingInstance={existingInstance}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Edit Slack')).toBeInTheDocument();
    expect(screen.queryByLabelText(/adapter id/i)).not.toBeInTheDocument();
    // Password should be empty (not pre-filled), channel should be pre-filled
    expect(screen.getByLabelText(/channel/i)).toHaveValue('#dev');
  });

  it('displays setup instructions when provided', () => {
    const { Wrapper } = createWrapper();
    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={manifestWithInstructions}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Go to slack.com/api to get your token.')).toBeInTheDocument();
  });

  it('blocks Continue when required fields are empty', () => {
    const { Wrapper } = createWrapper();
    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
      />,
      { wrapper: Wrapper },
    );

    // Token is required and empty — clicking Continue should show error
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText('API Token is required')).toBeInTheDocument();
    // Should still be on configure step
    expect(screen.getByLabelText(/channel/i)).toBeInTheDocument();
  });

  it('shows spinner during pending test, green check on success', async () => {
    const { Wrapper, mockTransport } = createWrapper();
    // Make testRelayAdapterConnection resolve after a tick
    mockTransport.testRelayAdapterConnection = vi.fn().mockResolvedValue({ ok: true });

    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
        existingInstance={existingInstance}
      />,
      { wrapper: Wrapper },
    );

    // Fill required token field and continue
    const tokenInput = screen.getByLabelText(/api token/i);
    fireEvent.change(tokenInput, { target: { value: 'test-token' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Should show test step
    await waitFor(() => {
      expect(screen.getByText('Testing connection...')).toBeInTheDocument();
    });

    // After resolving, should show success
    await waitFor(() => {
      expect(screen.getByText('Connection successful')).toBeInTheDocument();
    });
  });

  it('shows red X on test failure', async () => {
    const { Wrapper, mockTransport } = createWrapper();
    mockTransport.testRelayAdapterConnection = vi.fn().mockRejectedValue(new Error('Auth failed'));

    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
        existingInstance={existingInstance}
      />,
      { wrapper: Wrapper },
    );

    const tokenInput = screen.getByLabelText(/api token/i);
    fireEvent.change(tokenInput, { target: { value: 'bad-token' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
    expect(screen.getByText('Auth failed')).toBeInTheDocument();
  });

  it('Skip navigates from test step to confirm step', async () => {
    const { Wrapper, mockTransport } = createWrapper();
    mockTransport.testRelayAdapterConnection = vi.fn().mockResolvedValue({ ok: true });

    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
        existingInstance={existingInstance}
      />,
      { wrapper: Wrapper },
    );

    const tokenInput = screen.getByLabelText(/api token/i);
    fireEvent.change(tokenInput, { target: { value: 'test-token' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    // Should be on confirm step now
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  it('confirm step shows values with passwords masked', async () => {
    const { Wrapper, mockTransport } = createWrapper();
    mockTransport.testRelayAdapterConnection = vi.fn().mockResolvedValue({ ok: true });

    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
        existingInstance={existingInstance}
      />,
      { wrapper: Wrapper },
    );

    const tokenInput = screen.getByLabelText(/api token/i);
    fireEvent.change(tokenInput, { target: { value: 'my-secret-token' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Skip test
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    // On confirm step: password should be masked
    await waitFor(() => {
      expect(screen.getByText('***')).toBeInTheDocument();
    });
    expect(screen.getByText('#dev')).toBeInTheDocument();
  });

  it('save calls addAdapter mutation in add mode', async () => {
    const { Wrapper, mockTransport } = createWrapper();
    mockTransport.testRelayAdapterConnection = vi.fn().mockResolvedValue({ ok: true });
    mockTransport.addRelayAdapter = vi.fn().mockResolvedValue({ ok: true });

    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
      />,
      { wrapper: Wrapper },
    );

    // Fill required fields
    const tokenInput = screen.getByLabelText(/api token/i);
    fireEvent.change(tokenInput, { target: { value: 'new-token' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Skip test
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    // Save
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add adapter/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /add adapter/i }));

    await waitFor(() => {
      expect(mockTransport.addRelayAdapter).toHaveBeenCalledWith(
        'slack',
        'slack',
        expect.objectContaining({ token: 'new-token', channel: '#general' }),
      );
    });
  });

  it('label input renders on configure step', () => {
    const { Wrapper } = createWrapper();
    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByLabelText(/name \(optional\)/i)).toBeInTheDocument();
    // Placeholder should be the manifest displayName
    expect(screen.getByLabelText(/name \(optional\)/i)).toHaveAttribute('placeholder', 'Slack');
  });

  it('label is included in addAdapter config when provided', async () => {
    const { Wrapper, mockTransport } = createWrapper();
    mockTransport.testRelayAdapterConnection = vi.fn().mockResolvedValue({ ok: true });
    mockTransport.addRelayAdapter = vi.fn().mockResolvedValue({ ok: true });

    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
      />,
      { wrapper: Wrapper },
    );

    // Fill required fields and set label
    fireEvent.change(screen.getByLabelText(/api token/i), { target: { value: 'my-token' } });
    fireEvent.change(screen.getByLabelText(/name \(optional\)/i), { target: { value: 'My Slack Bot' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add adapter/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /add adapter/i }));

    await waitFor(() => {
      expect(mockTransport.addRelayAdapter).toHaveBeenCalledWith(
        'slack',
        'slack',
        expect.objectContaining({ token: 'my-token', label: 'My Slack Bot' }),
      );
    });
  });

  it('label is omitted from addAdapter config when empty', async () => {
    const { Wrapper, mockTransport } = createWrapper();
    mockTransport.testRelayAdapterConnection = vi.fn().mockResolvedValue({ ok: true });
    mockTransport.addRelayAdapter = vi.fn().mockResolvedValue({ ok: true });

    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.change(screen.getByLabelText(/api token/i), { target: { value: 'my-token' } });
    // Leave label empty
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add adapter/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /add adapter/i }));

    await waitFor(() => {
      expect(mockTransport.addRelayAdapter).toHaveBeenCalledWith(
        'slack',
        'slack',
        expect.not.objectContaining({ label: expect.anything() }),
      );
    });
  });

  it('auto-label populates from botUsername when label is empty', async () => {
    const { Wrapper, mockTransport } = createWrapper();
    mockTransport.testRelayAdapterConnection = vi
      .fn()
      .mockResolvedValue({ ok: true, botUsername: 'mybot' });

    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
        existingInstance={existingInstance}
      />,
      { wrapper: Wrapper },
    );

    // Leave label empty and proceed to test step
    fireEvent.change(screen.getByLabelText(/api token/i), { target: { value: 'token' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // After test succeeds, label should be auto-populated
    await waitFor(() => {
      expect(screen.getByText('Connection successful')).toBeInTheDocument();
    });

    // Navigate back to configure to verify label was set
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/name \(optional\)/i)).toHaveValue('@mybot');
    });
  });

  it('user-set label is not overwritten by auto-label', async () => {
    const { Wrapper, mockTransport } = createWrapper();
    mockTransport.testRelayAdapterConnection = vi
      .fn()
      .mockResolvedValue({ ok: true, botUsername: 'autobot' });

    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
        existingInstance={existingInstance}
      />,
      { wrapper: Wrapper },
    );

    // Set a label before testing
    fireEvent.change(screen.getByLabelText(/name \(optional\)/i), {
      target: { value: 'My Custom Name' },
    });
    fireEvent.change(screen.getByLabelText(/api token/i), { target: { value: 'token' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Connection successful')).toBeInTheDocument();
    });

    // Navigate back to confirm label wasn't overwritten
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/name \(optional\)/i)).toHaveValue('My Custom Name');
    });
  });

  it('save calls updateConfig mutation in edit mode', async () => {
    const { Wrapper, mockTransport } = createWrapper();
    mockTransport.testRelayAdapterConnection = vi.fn().mockResolvedValue({ ok: true });
    mockTransport.updateRelayAdapterConfig = vi.fn().mockResolvedValue({ ok: true });

    render(
      <AdapterSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        manifest={baseManifest}
        existingInstance={existingInstance}
      />,
      { wrapper: Wrapper },
    );

    const tokenInput = screen.getByLabelText(/api token/i);
    fireEvent.change(tokenInput, { target: { value: 'updated-token' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Skip test
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    // Save
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockTransport.updateRelayAdapterConfig).toHaveBeenCalledWith(
        'slack-1',
        expect.objectContaining({ token: 'updated-token', channel: '#dev' }),
      );
    });
  });
});

describe('unflattenConfig', () => {
  it('converts flat dot-notation keys to nested objects', () => {
    const flat = {
      'inbound.subject': 'x',
      'inbound.queue': 'q1',
      'outbound.topic': 'y',
      simple: 'value',
    };
    const result = unflattenConfig(flat);
    expect(result).toEqual({
      inbound: { subject: 'x', queue: 'q1' },
      outbound: { topic: 'y' },
      simple: 'value',
    });
  });

  it('handles deeply nested keys', () => {
    const flat = { 'a.b.c': 42 };
    expect(unflattenConfig(flat)).toEqual({ a: { b: { c: 42 } } });
  });

  it('returns empty object for empty input', () => {
    expect(unflattenConfig({})).toEqual({});
  });
});
