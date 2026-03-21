import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJSON, buildQueryString } from '../http-client';

describe('fetchJSON', () => {
  const BASE_URL = 'http://localhost:4242';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const result = await fetchJSON<{ ok: boolean }>(BASE_URL, '/api/test');
    expect(result).toEqual({ ok: true });
  });

  it('throws on non-OK responses with error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    );

    await expect(fetchJSON(BASE_URL, '/api/missing')).rejects.toThrow('Not found');
  });

  it('throws user-friendly message on timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const err = new DOMException('The operation was aborted.', 'TimeoutError');
      return Promise.reject(err);
    });

    await expect(fetchJSON(BASE_URL, '/api/slow', { timeout: 5000 })).rejects.toThrow(
      'Request timed out after 5s'
    );
  });

  it('re-throws non-timeout fetch errors as-is', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchJSON(BASE_URL, '/api/down')).rejects.toThrow('Failed to fetch');
  });

  it('passes caller-provided signal alongside timeout signal', async () => {
    const controller = new AbortController();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await fetchJSON(BASE_URL, '/api/test', { signal: controller.signal });

    // The fetch call should have received a composed signal (not the original)
    const passedSignal = fetchSpy.mock.calls[0][1]?.signal;
    expect(passedSignal).toBeDefined();
    // The composed signal should not be the caller's original signal
    expect(passedSignal).not.toBe(controller.signal);
  });
});

describe('buildQueryString', () => {
  it('builds query string from params', () => {
    expect(buildQueryString({ a: '1', b: 2 })).toBe('?a=1&b=2');
  });

  it('omits undefined values', () => {
    expect(buildQueryString({ a: '1', b: undefined })).toBe('?a=1');
  });

  it('returns empty string when all values are undefined', () => {
    expect(buildQueryString({ a: undefined })).toBe('');
  });
});
