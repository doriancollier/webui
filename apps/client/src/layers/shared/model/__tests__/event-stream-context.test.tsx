/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';

// vi.hoisted() ensures these values exist before vi.mock factories run,
// which is critical because the singleton SSEConnection is created at module scope.
const { mocks, captured } = vi.hoisted(() => ({
  mocks: {
    connect: vi.fn(),
    destroy: vi.fn(),
    enableVisibilityOptimization: vi.fn(),
    getState: vi.fn().mockReturnValue('connecting'),
    getFailedAttempts: vi.fn().mockReturnValue(0),
  },
  captured: {
    eventHandlers: {} as Record<string, (data: unknown) => void>,
    onStateChange: undefined as ((state: string, attempts: number) => void) | undefined,
  },
}));

vi.mock('@/layers/shared/lib/transport', () => ({
  SSEConnection: vi.fn().mockImplementation(
    (
      _url: string,
      options: {
        eventHandlers: Record<string, (data: unknown) => void>;
        onStateChange?: (state: string, attempts: number) => void;
      }
    ) => {
      captured.eventHandlers = options.eventHandlers;
      captured.onStateChange = options.onStateChange;
      return mocks;
    }
  ),
}));

import { EventStreamProvider, useEventStream, useEventSubscription } from '../event-stream-context';

function Wrapper({ children }: { children: ReactNode }) {
  return <EventStreamProvider>{children}</EventStreamProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('EventStreamProvider', () => {
  it('lazily connects the singleton on first provider mount', () => {
    // The SSEConnection is created at module scope, but connect() is deferred
    // to the first provider mount to avoid EventSource creation in test envs.
    renderHook(() => useEventStream(), { wrapper: Wrapper });
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(mocks.enableVisibilityOptimization).toHaveBeenCalledOnce();
  });

  it('does not call connect again on subsequent provider mounts', () => {
    // First mount connects
    const { unmount } = renderHook(() => useEventStream(), { wrapper: Wrapper });
    unmount();
    mocks.connect.mockClear();

    // Second mount should NOT call connect (singleton already connected)
    renderHook(() => useEventStream(), { wrapper: Wrapper });
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('does not destroy the singleton on provider unmount', () => {
    const { unmount } = renderHook(() => useEventStream(), { wrapper: Wrapper });
    unmount();
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
});

describe('useEventStream', () => {
  it('throws outside provider', () => {
    expect(() => {
      renderHook(() => useEventStream());
    }).toThrow('useEventStream must be used within an EventStreamProvider');
  });

  it('reflects connection state changes', () => {
    const { result } = renderHook(() => useEventStream(), { wrapper: Wrapper });

    act(() => {
      captured.onStateChange?.('connected', 0);
    });

    expect(result.current.connectionState).toBe('connected');
    expect(result.current.failedAttempts).toBe(0);
  });
});

describe('useEventSubscription', () => {
  it('calls handler when matching event fires', () => {
    const handler = vi.fn();
    renderHook(() => useEventSubscription('tunnel_status', handler), {
      wrapper: Wrapper,
    });

    act(() => {
      captured.eventHandlers['tunnel_status']?.({ connected: true });
    });

    expect(handler).toHaveBeenCalledWith({ connected: true });
  });

  it('does not call handler for non-matching events', () => {
    const handler = vi.fn();
    renderHook(() => useEventSubscription('tunnel_status', handler), {
      wrapper: Wrapper,
    });

    act(() => {
      captured.eventHandlers['extension_reloaded']?.({ extensionIds: ['a'] });
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useEventSubscription('tunnel_status', handler), {
      wrapper: Wrapper,
    });

    unmount();

    act(() => {
      captured.eventHandlers['tunnel_status']?.({ connected: false });
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers to the same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    renderHook(
      () => {
        useEventSubscription('tunnel_status', handler1);
        useEventSubscription('tunnel_status', handler2);
      },
      { wrapper: Wrapper }
    );

    act(() => {
      captured.eventHandlers['tunnel_status']?.({ connected: true });
    });

    expect(handler1).toHaveBeenCalledWith({ connected: true });
    expect(handler2).toHaveBeenCalledWith({ connected: true });
  });
});
