// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { TooltipProvider } from '@/layers/shared/ui';

let mockCanvasOpen = false;
let mockCanvasContent: unknown = null;
const mockSetCanvasOpen = vi.fn();

vi.mock('@/layers/shared/model', () => ({
  useAppStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      canvasOpen: mockCanvasOpen,
      canvasContent: mockCanvasContent,
      setCanvasOpen: mockSetCanvasOpen,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('motion/react', () => ({
  motion: {
    button: ({
      children,
      whileHover: _wh,
      whileTap: _wt,
      transition: _t,
      ...rest
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
    ),
  },
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

async function renderToggle() {
  const { CanvasToggle } = await import('../ui/CanvasToggle');
  return render(
    <TooltipProvider>
      <CanvasToggle />
    </TooltipProvider>
  );
}

describe('CanvasToggle', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockCanvasOpen = false;
    mockCanvasContent = null;
    mockSetCanvasOpen.mockClear();
  });

  it('renders with "Open canvas" aria-label when closed', async () => {
    mockCanvasOpen = false;
    await renderToggle();
    expect(screen.getByLabelText('Open canvas')).toBeInTheDocument();
  });

  it('renders with "Close canvas" aria-label when open', async () => {
    mockCanvasOpen = true;
    await renderToggle();
    expect(screen.getByLabelText('Close canvas')).toBeInTheDocument();
  });

  it('calls setCanvasOpen(true) when clicked while closed', async () => {
    mockCanvasOpen = false;
    const user = userEvent.setup();
    await renderToggle();

    await user.click(screen.getByLabelText('Open canvas'));
    expect(mockSetCanvasOpen).toHaveBeenCalledWith(true);
  });

  it('calls setCanvasOpen(false) when clicked while open', async () => {
    mockCanvasOpen = true;
    const user = userEvent.setup();
    await renderToggle();

    await user.click(screen.getByLabelText('Close canvas'));
    expect(mockSetCanvasOpen).toHaveBeenCalledWith(false);
  });

  it('shows dot indicator when canvas is closed with content', async () => {
    mockCanvasOpen = false;
    mockCanvasContent = { some: 'content' };
    const { container } = await renderToggle();

    const dot = container.querySelector('.bg-primary.rounded-full');
    expect(dot).toBeInTheDocument();
  });

  it('does NOT show dot when canvas is open even with content', async () => {
    mockCanvasOpen = true;
    mockCanvasContent = { some: 'content' };
    const { container } = await renderToggle();

    const dot = container.querySelector('.bg-primary.rounded-full');
    expect(dot).not.toBeInTheDocument();
  });

  it('does NOT show dot when content is null', async () => {
    mockCanvasOpen = false;
    mockCanvasContent = null;
    const { container } = await renderToggle();

    const dot = container.querySelector('.bg-primary.rounded-full');
    expect(dot).not.toBeInTheDocument();
  });
});
