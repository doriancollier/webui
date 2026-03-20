// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SyncItem } from '../ui/SyncItem';

afterEach(() => {
  cleanup();
});

describe('SyncItem', () => {
  it('renders with correct aria label when enabled', () => {
    render(<SyncItem enabled={true} onToggle={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Disable multi-window sync' });
    expect(button).toBeDefined();
  });

  it('renders with correct aria label when disabled', () => {
    render(<SyncItem enabled={false} onToggle={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Enable multi-window sync' });
    expect(button).toBeDefined();
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<SyncItem enabled={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Disable multi-window sync' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
