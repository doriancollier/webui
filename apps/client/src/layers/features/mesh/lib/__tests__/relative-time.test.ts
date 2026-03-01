import { describe, it, expect, vi, afterEach } from 'vitest';
import { relativeTime } from '../relative-time';

afterEach(() => {
  vi.useRealTimers();
});

describe('relativeTime', () => {
  it('returns "Never" for null input', () => {
    expect(relativeTime(null)).toBe('Never');
  });

  it('returns "just now" for a future date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    expect(relativeTime('2026-01-01T00:00:10.000Z')).toBe('just now');
  });

  it('returns seconds ago format for recent timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:01:00.000Z'));
    expect(relativeTime('2026-01-01T00:00:45.000Z')).toBe('15s ago');
  });

  it('returns minutes ago format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:10:00.000Z'));
    expect(relativeTime('2026-01-01T00:07:00.000Z')).toBe('3m ago');
  });

  it('returns hours ago format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T05:00:00.000Z'));
    expect(relativeTime('2026-01-01T03:00:00.000Z')).toBe('2h ago');
  });

  it('returns days ago format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T00:00:00.000Z'));
    expect(relativeTime('2026-01-03T00:00:00.000Z')).toBe('2d ago');
  });
});
