/**
 * HTTP client utilities for the Transport layer.
 *
 * @module shared/lib/transport/http-client
 */

/** Default timeout for fetchJSON requests (ms). */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Fetch JSON from a URL, throwing on non-OK responses. */
export async function fetchJSON<T>(
  baseUrl: string,
  url: string,
  opts?: RequestInit & { timeout?: number }
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...requestInit } = opts ?? {};
  const timeoutSignal = AbortSignal.timeout(timeout);
  const signal = requestInit.signal
    ? AbortSignal.any([timeoutSignal, requestInit.signal])
    : timeoutSignal;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...requestInit,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error(`Request timed out after ${timeout / 1000}s — check your network connection`);
    }
    throw err;
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    const err = new Error(error.error || `HTTP ${res.status}`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = error.code;
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Build a query string from an object, omitting undefined values.
 *
 * @returns The query string prefixed with `?`, or empty string if no params.
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | undefined>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}
