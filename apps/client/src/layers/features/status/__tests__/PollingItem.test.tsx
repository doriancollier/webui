// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PollingItem } from '../ui/PollingItem';

afterEach(() => {
  cleanup();
});

describe('PollingItem', () => {
  it('renders with correct aria label when enabled', () => {
    render(<PollingItem enabled={true} onToggle={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Disable background refresh' });
    expect(button).toBeDefined();
  });

  it('renders with correct aria label when disabled', () => {
    render(<PollingItem enabled={false} onToggle={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Enable background refresh' });
    expect(button).toBeDefined();
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<PollingItem enabled={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Disable background refresh' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
