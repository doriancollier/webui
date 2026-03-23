/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '@/layers/shared/model';
import { createMockTransport } from '@dorkos/test-utils';
import { DEFAULT_TEMPLATES } from '@dorkos/shared/template-catalog';
import { TemplatePicker } from '../ui/TemplatePicker';

// ---------------------------------------------------------------------------
// Browser API mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPicker(props: { selectedTemplate?: string | null; onSelect?: () => void } = {}) {
  const transport = createMockTransport();
  vi.mocked(transport.getTemplates).mockResolvedValue(DEFAULT_TEMPLATES);

  const onSelect = props.onSelect ?? vi.fn();
  const queryClient = createTestQueryClient();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>
        <TemplatePicker selectedTemplate={props.selectedTemplate ?? null} onSelect={onSelect} />
      </TransportProvider>
    </QueryClientProvider>
  );

  return { ...result, onSelect, transport, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TemplatePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders all default templates in the grid', async () => {
    renderPicker();

    for (const template of DEFAULT_TEMPLATES) {
      expect(await screen.findByText(template.name)).toBeInTheDocument();
    }
  });

  it('renders template descriptions', async () => {
    renderPicker();

    // Wait for templates to load, then check a description
    await screen.findByText('Blank');
    expect(
      screen.getByText('Empty agent workspace — just agent.json and convention files')
    ).toBeInTheDocument();
  });

  it('category tabs filter templates to matching category', async () => {
    const user = userEvent.setup();
    renderPicker();

    // Wait for all templates
    await screen.findByText('Blank');

    // Click "Frontend" tab
    await user.click(screen.getByRole('tab', { name: 'Frontend' }));

    const grid = screen.getByTestId('template-grid');
    // Frontend templates should be visible
    expect(within(grid).getByText('Next.js')).toBeInTheDocument();
    expect(within(grid).getByText('Vite + React')).toBeInTheDocument();

    // Non-frontend templates should be gone
    expect(within(grid).queryByText('Blank')).not.toBeInTheDocument();
    expect(within(grid).queryByText('Express')).not.toBeInTheDocument();
    expect(within(grid).queryByText('FastAPI')).not.toBeInTheDocument();
    expect(within(grid).queryByText('TypeScript Library')).not.toBeInTheDocument();
    expect(within(grid).queryByText('CLI Tool')).not.toBeInTheDocument();
  });

  it('clicking "All" tab shows all templates after filtering', async () => {
    const user = userEvent.setup();
    renderPicker();

    await screen.findByText('Blank');

    // Filter to backend
    await user.click(screen.getByRole('tab', { name: 'Backend' }));
    const grid = screen.getByTestId('template-grid');
    expect(within(grid).queryByText('Blank')).not.toBeInTheDocument();

    // Return to All
    await user.click(screen.getByRole('tab', { name: 'All' }));
    expect(within(grid).getByText('Blank')).toBeInTheDocument();
    expect(within(grid).getByText('Express')).toBeInTheDocument();
  });

  it('clicking a template calls onSelect with template ID', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPicker();

    await screen.findByText('Blank');
    await user.click(screen.getByTestId('template-card-nextjs'));

    expect(onSelect).toHaveBeenCalledWith('nextjs');
  });

  it('clicking the selected template deselects it (calls onSelect with null)', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPicker({ selectedTemplate: 'nextjs' });

    await screen.findByText('Next.js');
    await user.click(screen.getByTestId('template-card-nextjs'));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('custom URL input calls onSelect with URL value', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPicker();

    await screen.findByText('Blank');

    const urlInput = screen.getByTestId('custom-url-input');
    await user.type(urlInput, 'github.com/my/repo');

    // onSelect should have been called with the accumulating URL
    expect(onSelect).toHaveBeenLastCalledWith('github.com/my/repo');
  });

  it('clearing custom URL input calls onSelect with null', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPicker();

    await screen.findByText('Blank');

    const urlInput = screen.getByTestId('custom-url-input');
    await user.type(urlInput, 'x');
    await user.clear(urlInput);

    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('selecting a template clears the custom URL input', async () => {
    const user = userEvent.setup();
    renderPicker();

    await screen.findByText('Blank');

    // Type a URL first
    const urlInput = screen.getByTestId('custom-url-input');
    await user.type(urlInput, 'github.com/my/repo');

    // Select a template
    await user.click(screen.getByTestId('template-card-blank'));

    // URL input should be cleared
    expect(urlInput).toHaveValue('');
  });

  it('shows checkmark on selected template card', async () => {
    renderPicker({ selectedTemplate: 'express' });

    await screen.findByText('Express');

    const card = screen.getByTestId('template-card-express');
    // The card should contain an SVG (Check icon)
    expect(card.querySelector('svg')).toBeInTheDocument();

    // Other cards should not have SVG
    const blankCard = screen.getByTestId('template-card-blank');
    expect(blankCard.querySelector('svg')).not.toBeInTheDocument();
  });
});
