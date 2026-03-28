import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockLoadCanvasForSession = vi.fn();
vi.mock('@/layers/shared/model', () => ({
  useAppStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      loadCanvasForSession: mockLoadCanvasForSession,
    };
    return selector ? selector(state) : state;
  },
}));

import { useCanvasPersistence } from '../model/use-canvas-persistence';

describe('useCanvasPersistence', () => {
  beforeEach(() => {
    mockLoadCanvasForSession.mockClear();
  });

  it('calls loadCanvasForSession when sessionId is provided', () => {
    renderHook(() => useCanvasPersistence('session-123'));
    expect(mockLoadCanvasForSession).toHaveBeenCalledWith('session-123');
  });

  it('does not call loadCanvasForSession when sessionId is undefined', () => {
    renderHook(() => useCanvasPersistence(undefined));
    expect(mockLoadCanvasForSession).not.toHaveBeenCalled();
  });

  it('does not call loadCanvasForSession when sessionId is null', () => {
    renderHook(() => useCanvasPersistence(null));
    expect(mockLoadCanvasForSession).not.toHaveBeenCalled();
  });

  it('reloads canvas when sessionId changes', () => {
    const { rerender } = renderHook(
      ({ id }: { id: string | null | undefined }) => useCanvasPersistence(id),
      { initialProps: { id: 'session-1' as string | null | undefined } }
    );
    expect(mockLoadCanvasForSession).toHaveBeenCalledWith('session-1');

    mockLoadCanvasForSession.mockClear();
    rerender({ id: 'session-2' });
    expect(mockLoadCanvasForSession).toHaveBeenCalledWith('session-2');
  });

  it('does not reload when sessionId stays the same', () => {
    const { rerender } = renderHook(({ id }: { id: string }) => useCanvasPersistence(id), {
      initialProps: { id: 'session-1' },
    });
    expect(mockLoadCanvasForSession).toHaveBeenCalledTimes(1);

    mockLoadCanvasForSession.mockClear();
    rerender({ id: 'session-1' });
    expect(mockLoadCanvasForSession).not.toHaveBeenCalled();
  });
});
