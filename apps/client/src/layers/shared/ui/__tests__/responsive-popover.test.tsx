// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import {
  ResponsivePopover,
  ResponsivePopoverTrigger,
  ResponsivePopoverContent,
  ResponsivePopoverTitle,
  useResponsivePopover,
} from '../responsive-popover';

// Mock useIsMobile to control desktop/mobile rendering.
// The component imports from '../model' which resolves to the shared/model barrel.
const mockUseIsMobile = vi.fn(() => false);
vi.mock('@/layers/shared/model', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useIsMobile: () => mockUseIsMobile(),
}));

// Mock Radix Popover to render simple DOM elements for testing
vi.mock('../popover', () => ({
  Popover: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open !== false ? <div data-testid="popover-root">{children}</div> : null,
  PopoverTrigger: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button data-testid="popover-trigger" {...props}>
      {children}
    </button>
  ),
  PopoverContent: ({
    children,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="popover-content" className={className} {...props}>
      {children}
    </div>
  ),
}));

// Mock Drawer (vaul) components to render simple DOM elements for testing
vi.mock('../drawer', () => ({
  Drawer: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open !== false ? <div data-testid="drawer-root">{children}</div> : null,
  DrawerTrigger: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button data-testid="drawer-trigger" {...props}>
      {children}
    </button>
  ),
  DrawerContent: ({
    children,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="drawer-content" className={className} {...props}>
      {children}
    </div>
  ),
  DrawerHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="drawer-header" {...props}>
      {children}
    </div>
  ),
  DrawerTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 data-testid="drawer-title" {...props}>
      {children}
    </h2>
  ),
}));

/** Renders context values into the DOM for assertion. */
function ContextSpy() {
  const { isDesktop } = useResponsivePopover();
  return <span data-testid="is-desktop">{String(isDesktop)}</span>;
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockUseIsMobile.mockReturnValue(false);
});

describe('ResponsivePopover', () => {
  it('renders Popover on desktop', () => {
    mockUseIsMobile.mockReturnValue(false);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverContent>content</ResponsivePopoverContent>
      </ResponsivePopover>
    );
    expect(screen.getByTestId('popover-root')).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-root')).not.toBeInTheDocument();
  });

  it('renders Drawer on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverContent>content</ResponsivePopoverContent>
      </ResponsivePopover>
    );
    expect(screen.getByTestId('drawer-root')).toBeInTheDocument();
    expect(screen.queryByTestId('popover-root')).not.toBeInTheDocument();
  });
});

describe('ResponsivePopoverContent', () => {
  it('renders PopoverContent on desktop', () => {
    mockUseIsMobile.mockReturnValue(false);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverContent>inner</ResponsivePopoverContent>
      </ResponsivePopover>
    );
    expect(screen.getByTestId('popover-content')).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-content')).not.toBeInTheDocument();
  });

  it('renders DrawerContent on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverContent>inner</ResponsivePopoverContent>
      </ResponsivePopover>
    );
    expect(screen.getByTestId('drawer-content')).toBeInTheDocument();
    expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument();
  });

  it('applies w-80 base class to PopoverContent on desktop', () => {
    mockUseIsMobile.mockReturnValue(false);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverContent>inner</ResponsivePopoverContent>
      </ResponsivePopover>
    );
    expect(screen.getByTestId('popover-content').className).toContain('w-80');
  });

  it('merges custom className on desktop', () => {
    mockUseIsMobile.mockReturnValue(false);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverContent className="p-4">inner</ResponsivePopoverContent>
      </ResponsivePopover>
    );
    expect(screen.getByTestId('popover-content').className).toContain('p-4');
  });

  it('applies bottom drawer classes on mobile (ignoring caller className)', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverContent className="w-72">inner</ResponsivePopoverContent>
      </ResponsivePopover>
    );
    const content = screen.getByTestId('drawer-content');
    expect(content.className).toContain('flex');
    expect(content.className).toContain('max-h-[90vh]');
    // Caller's width constraint should not be applied to drawer
    expect(content.className).not.toContain('w-72');
  });
});

describe('ResponsivePopoverTitle', () => {
  it('returns null on desktop', () => {
    mockUseIsMobile.mockReturnValue(false);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverContent>
          <ResponsivePopoverTitle>My Title</ResponsivePopoverTitle>
        </ResponsivePopoverContent>
      </ResponsivePopover>
    );
    expect(screen.queryByTestId('drawer-title')).not.toBeInTheDocument();
    expect(screen.queryByText('My Title')).not.toBeInTheDocument();
  });

  it('renders DrawerTitle on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverContent>
          <ResponsivePopoverTitle>My Title</ResponsivePopoverTitle>
        </ResponsivePopoverContent>
      </ResponsivePopover>
    );
    expect(screen.getByTestId('drawer-title')).toBeInTheDocument();
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('wraps DrawerTitle in DrawerHeader on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverContent>
          <ResponsivePopoverTitle>Title</ResponsivePopoverTitle>
        </ResponsivePopoverContent>
      </ResponsivePopover>
    );
    expect(screen.getByTestId('drawer-header')).toBeInTheDocument();
    expect(screen.getByTestId('drawer-title')).toBeInTheDocument();
  });
});

describe('useResponsivePopover', () => {
  it('throws when used outside a ResponsivePopover', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function TestComponent() {
      useResponsivePopover();
      return null;
    }

    expect(() => render(<TestComponent />)).toThrow(
      'useResponsivePopover must be used within a <ResponsivePopover>'
    );
    spy.mockRestore();
  });

  it('returns isDesktop=true on desktop', () => {
    mockUseIsMobile.mockReturnValue(false);
    render(
      <ResponsivePopover open>
        <ContextSpy />
      </ResponsivePopover>
    );
    expect(screen.getByTestId('is-desktop').textContent).toBe('true');
  });

  it('returns isDesktop=false on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsivePopover open>
        <ContextSpy />
      </ResponsivePopover>
    );
    expect(screen.getByTestId('is-desktop').textContent).toBe('false');
  });
});

describe('ResponsivePopoverTrigger', () => {
  it('renders PopoverTrigger on desktop', () => {
    mockUseIsMobile.mockReturnValue(false);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverTrigger>Open</ResponsivePopoverTrigger>
        <ResponsivePopoverContent>content</ResponsivePopoverContent>
      </ResponsivePopover>
    );
    expect(screen.getByTestId('popover-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-trigger')).not.toBeInTheDocument();
  });

  it('renders DrawerTrigger on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsivePopover open>
        <ResponsivePopoverTrigger>Open</ResponsivePopoverTrigger>
        <ResponsivePopoverContent>content</ResponsivePopoverContent>
      </ResponsivePopover>
    );
    expect(screen.getByTestId('drawer-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('popover-trigger')).not.toBeInTheDocument();
  });
});

describe('displayNames', () => {
  it.each([
    ['ResponsivePopover', ResponsivePopover],
    ['ResponsivePopoverTrigger', ResponsivePopoverTrigger],
    ['ResponsivePopoverContent', ResponsivePopoverContent],
    ['ResponsivePopoverTitle', ResponsivePopoverTitle],
  ])('%s has displayName set', (name, component) => {
    expect(component.displayName).toBe(name);
  });
});
