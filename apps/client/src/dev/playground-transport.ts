import type { Transport } from '@dorkos/shared/transport';

/**
 * Proxy-based mock Transport for the dev playground.
 *
 * Every method resolves with `null` — the safest default for TanStack Query hooks
 * that may expect arrays, objects, or other shapes. TanStack Query rejects
 * `undefined` (it uses it internally for "no data yet"), but `null` is valid data
 * that still short-circuits optional chaining (`null?.field === undefined`).
 *
 * Unlike `createMockTransport` from test-utils, this has no dependency on
 * `vi.fn()` and works at runtime.
 */
export function createPlaygroundTransport(): Transport {
  return new Proxy({} as Transport, {
    get: (_target, prop) => {
      if (typeof prop !== 'string') return undefined;
      // Resolve with null — safe for hooks expecting arrays, objects, or primitives
      return async () => null;
    },
  });
}
