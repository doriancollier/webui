import { describe, it, expect, vi } from 'vitest';
import { parseSessionId, sendError } from '../route-utils.js';
import type { Response } from 'express';

function createMockResponse() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe('parseSessionId', () => {
  it('accepts and returns a valid UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(parseSessionId(uuid)).toBe(uuid);
  });

  it('returns null for path traversal strings', () => {
    expect(parseSessionId('../../../etc/passwd')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseSessionId('')).toBeNull();
  });

  it('returns null for a numeric string', () => {
    expect(parseSessionId('12345')).toBeNull();
  });

  it('returns null for a random non-UUID string', () => {
    expect(parseSessionId('not-a-valid-uuid-at-all')).toBeNull();
  });
});

describe('sendError', () => {
  it('sends the correct status code and body', () => {
    const res = createMockResponse();
    sendError(res, 400, 'Bad request', 'BAD_REQUEST');

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.status(400).json).toHaveBeenCalledWith({
      error: 'Bad request',
      code: 'BAD_REQUEST',
    });
  });

  it('works with 404 status', () => {
    const res = createMockResponse();
    sendError(res, 404, 'Not found', 'NOT_FOUND');

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status(404).json).toHaveBeenCalledWith({
      error: 'Not found',
      code: 'NOT_FOUND',
    });
  });

  it('works with 500 status', () => {
    const res = createMockResponse();
    sendError(res, 500, 'Internal server error', 'INTERNAL_ERROR');

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.status(500).json).toHaveBeenCalledWith({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });
});
