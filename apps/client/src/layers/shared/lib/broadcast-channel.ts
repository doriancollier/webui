/**
 * Generic BroadcastChannel wrapper for cross-tab communication.
 *
 * Falls back to safe no-ops when BroadcastChannel is unavailable
 * (e.g., in Node/test environments or older browsers).
 *
 * @module shared/lib/broadcast-channel
 */

/** Typed channel interface for cross-tab messaging. */
export interface Channel<T = unknown> {
  postMessage(data: T): void;
  onMessage(handler: (data: T) => void): () => void;
  close(): void;
}

/** Create a typed BroadcastChannel wrapper with auto-cleanup. */
export function createChannel<T = unknown>(name: string): Channel<T> {
  if (typeof BroadcastChannel === 'undefined') {
    return {
      postMessage: () => {},
      onMessage: () => () => {},
      close: () => {},
    };
  }

  const channel = new BroadcastChannel(name);

  return {
    postMessage(data: T): void {
      channel.postMessage(data);
    },
    onMessage(handler: (data: T) => void): () => void {
      const listener = (event: MessageEvent<T>) => handler(event.data);
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
    close(): void {
      channel.close();
    },
  };
}
