// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div data-testid="motion-div" {...props}>
        {children as React.ReactNode}
      </div>
    ),
  },
}));

import { SidebarUpgradeCard } from '../SidebarUpgradeCard';

const defaultProps = {
  currentVersion: '1.2.3',
  latestVersion: '1.4.0',
  isFeature: true,
  onDismiss: vi.fn(),
};

describe('SidebarUpgradeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders version delta correctly', () => {
    render(<SidebarUpgradeCard {...defaultProps} />);

    expect(screen.getByText(/v1\.2\.3/)).toBeInTheDocument();
    expect(screen.getByText(/v1\.4\.0/)).toBeInTheDocument();
  });

  it('shows "New features available" for feature updates', () => {
    render(<SidebarUpgradeCard {...defaultProps} isFeature={true} />);

    expect(screen.getByText('New features available')).toBeInTheDocument();
  });

  it('shows "Patch update available" for patch updates', () => {
    render(<SidebarUpgradeCard {...defaultProps} isFeature={false} />);

    expect(screen.getByText('Patch update available')).toBeInTheDocument();
  });

  it('copies update command to clipboard', () => {
    render(<SidebarUpgradeCard {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Copy update command'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('npm update -g dorkos');
  });

  it('shows check icon after copy', () => {
    render(<SidebarUpgradeCard {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Copy update command'));

    // Check icon should appear (emerald-500 class)
    const checkIcon = screen
      .getByLabelText('Copy update command')
      .querySelector('.text-emerald-500');
    expect(checkIcon).toBeInTheDocument();
  });

  it('shows "What\'s new" link for feature updates', () => {
    render(<SidebarUpgradeCard {...defaultProps} isFeature={true} />);

    const link = screen.getByText(/What's new/);
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/dork-labs/dorkos/releases');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('hides "What\'s new" link for patch updates', () => {
    render(<SidebarUpgradeCard {...defaultProps} isFeature={false} />);

    expect(screen.queryByText(/What's new/)).not.toBeInTheDocument();
  });

  it('calls onDismiss with latest version when dismiss clicked', () => {
    const onDismiss = vi.fn();
    render(<SidebarUpgradeCard {...defaultProps} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByLabelText('Dismiss upgrade notification'));
    expect(onDismiss).toHaveBeenCalledWith('1.4.0');
  });

  it('applies amber styling for feature updates', () => {
    const { container } = render(<SidebarUpgradeCard {...defaultProps} isFeature={true} />);

    const card = container.querySelector('[data-testid="motion-div"]');
    expect(card?.className).toContain('border-amber-500/20');
    expect(card?.className).toContain('bg-amber-500/5');
  });

  it('applies muted styling for patch updates', () => {
    const { container } = render(<SidebarUpgradeCard {...defaultProps} isFeature={false} />);

    const card = container.querySelector('[data-testid="motion-div"]');
    expect(card?.className).toContain('border-border');
    expect(card?.className).toContain('bg-muted/50');
  });
});
