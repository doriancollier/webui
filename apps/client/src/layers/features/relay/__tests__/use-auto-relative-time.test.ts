import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoRelativeTime } from '../model/use-auto-relative-time';

describe('useAutoRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for timestamps under 1 minute old', () => {
    const now = new Date().toISOString();
    const { result } = renderHook(() => useAutoRelativeTime(now));
    expect(result.current).toBe('just now');
  });

  it('returns "Xm ago" for timestamps under 1 hour old', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const { result } = renderHook(() => useAutoRelativeTime(fiveMinAgo));
    expect(result.current).toBe('5m ago');
  });

  it('returns "Xh ago" for timestamps under 24 hours old', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const { result } = renderHook(() => useAutoRelativeTime(twoHoursAgo));
    expect(result.current).toBe('2h ago');
  });

  it('returns "Xd ago" for timestamps over 24 hours old', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const { result } = renderHook(() => useAutoRelativeTime(threeDaysAgo));
    expect(result.current).toBe('3d ago');
  });

  it('returns empty string for undefined input', () => {
    const { result } = renderHook(() => useAutoRelativeTime(undefined));
    expect(result.current).toBe('');
  });

  it('auto-refreshes at 10s interval for recent timestamps', () => {
    const now = new Date().toISOString();
    const { result } = renderHook(() => useAutoRelativeTime(now));
    expect(result.current).toBe('just now');

    // Advance 65 seconds
    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(result.current).toBe('1m ago');
  });

  it('cleans up interval on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const now = new Date().toISOString();
    const { unmount } = renderHook(() => useAutoRelativeTime(now));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
