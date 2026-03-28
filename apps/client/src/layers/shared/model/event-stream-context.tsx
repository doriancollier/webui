/**
 * EventStreamProvider — single shared SSE connection to `/api/events` with a
 * subscription API for distributing events to any number of consumers without
 * triggering extra renders.
 *
 * The SSEConnection is a module-level singleton so that React StrictMode
 * double-mounts and Vite HMR cycles cannot create duplicate connections.
 *
 * @module shared/model/event-stream-context
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

import type { ConnectionState } from '@dorkos/shared/types';

import { SSEConnection } from '@/layers/shared/lib/transport';

/** Handler function for a single SSE event payload. */
export type EventHandler = (data: unknown) => void;

/** Subscribe to a named SSE event; returns an unsubscribe function. */
export type SubscribeFn = (eventName: KnownEvent, handler: EventHandler) => () => void;

/**
 * Known event names published by the `/api/events` unified stream.
 * This list is static — add new events here as the server emits them.
 */
export type KnownEvent =
  | 'connected'
  | 'tunnel_status'
  | 'extension_reloaded'
  | 'relay_connected'
  | 'relay_message'
  | 'relay_backpressure'
  | 'relay_signal';

/** Value exposed by the {@link useEventStream} hook. */
export interface EventStreamContextValue {
  /** Subscribe to a named event. Returns an unsubscribe function. */
  subscribe: SubscribeFn;
  /** Current SSE connection state. */
  connectionState: ConnectionState;
  /** Number of consecutive failed connection attempts. */
  failedAttempts: number;
}

const KNOWN_EVENTS: KnownEvent[] = [
  'connected',
  'tunnel_status',
  'extension_reloaded',
  'relay_connected',
  'relay_message',
  'relay_backpressure',
  'relay_signal',
];

// ---------------------------------------------------------------------------
// Module-level singleton — one SSEConnection per app lifetime.
// React StrictMode, HMR, and provider remounts cannot create duplicates.
//
// Vite HMR: when THIS module is edited, Vite re-evaluates it. We use
// import.meta.hot.data to preserve the connection and listener map across
// HMR updates. In production, import.meta.hot is undefined and the guards
// are tree-shaken.
// ---------------------------------------------------------------------------

/** Callback for SSEConnection state changes. */
type StateListener = (state: ConnectionState, attempts: number) => void;

/**
 * Listeners map shared across all providers and consumers.
 * Preserved across HMR so the singleton's event handlers keep dispatching
 * to the correct subscriber set after module re-evaluation.
 */
const listeners: Map<string, Set<EventHandler>> = (import.meta.hot?.data?.listeners as
  | Map<string, Set<EventHandler>>
  | undefined) ?? new Map();

/**
 * State change listeners — supports multiple concurrent providers (e.g.
 * during StrictMode's brief mount/unmount/remount window). Each provider
 * adds itself on mount and removes itself on unmount.
 */
const stateListeners: Set<StateListener> = new Set();

/**
 * Track previous connection state so we can detect reconnecting → connected
 * transitions and invalidate TanStack Query caches (refetch-on-reconnect).
 */
let previousConnectionState: ConnectionState =
  (import.meta.hot?.data?.previousConnectionState as ConnectionState | undefined) ?? 'connecting';

/** Build event handlers that dispatch to the shared listeners map. */
function buildEventHandlers(): Record<string, (data: unknown) => void> {
  const handlers: Record<string, (data: unknown) => void> = {};
  for (const event of KNOWN_EVENTS) {
    handlers[event] = (data: unknown) => {
      const set = listeners.get(event);
      if (set) {
        for (const handler of set) {
          handler(data);
        }
      }
    };
  }
  return handlers;
}

/** Create or reuse the singleton SSEConnection, preserving it across Vite HMR. */
function getOrCreateConnection(): SSEConnection {
  // Reuse existing connection across HMR updates
  if (import.meta.hot?.data?.singletonConnection) {
    return import.meta.hot.data.singletonConnection as SSEConnection;
  }

  const conn = new SSEConnection('/api/events', {
    eventHandlers: buildEventHandlers(),
    onStateChange: (state, attempts) => {
      // Refetch-on-reconnect: invalidate caches when recovering from disconnect
      if (state === 'connected' && previousConnectionState === 'reconnecting') {
        import('@/layers/shared/lib/query-client').then(
          ({ queryClient }) => {
            queryClient.invalidateQueries();
          },
          () => {
            // Silently ignore — query client may not be available in test environments
          }
        );
      }
      previousConnectionState = state;

      // Persist across HMR
      if (import.meta.hot?.data) {
        import.meta.hot.data.previousConnectionState = previousConnectionState;
      }

      for (const listener of stateListeners) {
        listener(state, attempts);
      }
    },
  });

  // NOTE: connect() is NOT called here. The SSEConnection constructor is safe
  // (no fetch), but connect() opens a fetch-based SSE stream which fails in
  // test environments without proper fetch mocking. Instead, connect() is
  // called lazily on first EventStreamProvider mount.

  // Persist across HMR. import.meta.hot is undefined in production (tree-shaken).
  // import.meta.hot.data may be undefined in test environments (Vitest).
  if (import.meta.hot?.data) {
    import.meta.hot.data.singletonConnection = conn;
    import.meta.hot.data.listeners = listeners;
  }

  return conn;
}

const singletonConnection = getOrCreateConnection();

// Track whether connect() has been called. Module-level flag ensures
// StrictMode double-mounts and HMR don't open duplicate EventSources.
let singletonConnected: boolean = import.meta.hot?.data?.singletonConnected === true;

// ---------------------------------------------------------------------------

const EventStreamContext = createContext<EventStreamContextValue | null>(null);

/**
 * Provide the shared `/api/events` SSE connection to the component tree.
 *
 * Mount this once near the top of the provider tree. The underlying
 * SSEConnection is a module-level singleton — this provider only wires
 * React state to connection status changes.
 *
 * Consumers subscribe via {@link useEventStream} or {@link useEventSubscription}.
 */
export function EventStreamProvider({ children }: { children: React.ReactNode }) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    singletonConnection.getState()
  );
  const [failedAttempts, setFailedAttempts] = useState(singletonConnection.getFailedAttempts());

  // Lazily connect the singleton on first provider mount. This avoids calling
  // new EventSource() at module scope (which breaks test environments without
  // EventSource). The module-level flag ensures StrictMode double-mounts and
  // HMR don't open duplicate connections.
  useEffect(() => {
    if (!singletonConnected) {
      singletonConnection.connect();
      singletonConnection.enableVisibilityOptimization();
      singletonConnected = true;
      if (import.meta.hot?.data) {
        import.meta.hot.data.singletonConnected = true;
      }
    }

    // Wire this provider's React state to the singleton's state change events.
    // Using a Set allows StrictMode's mount/unmount/remount to work correctly —
    // no gap where state changes are silently dropped.
    const listener: StateListener = (state, attempts) => {
      setConnectionState(state);
      setFailedAttempts(attempts);
    };
    stateListeners.add(listener);
    return () => {
      stateListeners.delete(listener);
    };
  }, []);

  const subscribe: SubscribeFn = useCallback((eventName, handler) => {
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }
    listeners.get(eventName)!.add(handler);

    return () => {
      listeners.get(eventName)?.delete(handler);
    };
  }, []);

  return (
    <EventStreamContext.Provider value={{ subscribe, connectionState, failedAttempts }}>
      {children}
    </EventStreamContext.Provider>
  );
}

/**
 * Access the shared event stream subscription API.
 *
 * Must be used within an {@link EventStreamProvider}.
 *
 * @throws If called outside an `EventStreamProvider`.
 */
export function useEventStream(): EventStreamContextValue {
  const ctx = useContext(EventStreamContext);
  if (!ctx) {
    throw new Error('useEventStream must be used within an EventStreamProvider');
  }
  return ctx;
}

/**
 * Subscribe to a named SSE event for the lifetime of the calling component.
 *
 * The handler is ref-stabilized — its identity may change between renders
 * without causing re-subscriptions.
 *
 * @param eventName - The SSE event type to listen for.
 * @param handler - Callback invoked with the parsed event payload.
 */
export function useEventSubscription(eventName: KnownEvent, handler: EventHandler): void {
  const { subscribe } = useEventStream();

  // Ref-stabilize the handler to avoid re-subscribing on every render
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    // Wrap with a stable function that delegates to the latest handler ref
    const stableHandler: EventHandler = (data) => {
      handlerRef.current(data);
    };
    return subscribe(eventName, stableHandler);
  }, [subscribe, eventName]);
}
