import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorHandler } from '../error-handler.js';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
  initLogger: vi.fn(),
}));

describe('errorHandler production mode', () => {
  const mockReq = {} as Request;
  const mockNext = vi.fn() as NextFunction;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  function createMockRes() {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    return res;
  }

  it('does not leak err.message in production mode', () => {
    process.env.NODE_ENV = 'production';
    const res = createMockRes();
    const error = new Error('Sensitive database connection string');

    errorHandler(error, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    });
  });

  it('includes err.message in development mode', () => {
    process.env.NODE_ENV = 'development';
    const res = createMockRes();
    const error = new Error('Something broke');

    errorHandler(error, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Something broke',
      code: 'INTERNAL_ERROR',
    });
  });

  it('includes err.message when NODE_ENV is undefined', () => {
    delete process.env.NODE_ENV;
    const res = createMockRes();
    const error = new Error('Debug info visible');

    errorHandler(error, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Debug info visible',
      code: 'INTERNAL_ERROR',
    });
  });

  it('returns generic message in production even with detailed error', () => {
    process.env.NODE_ENV = 'production';
    const res = createMockRes();
    const error = new Error('ECONNREFUSED 127.0.0.1:5432 - password authentication failed');

    errorHandler(error, mockReq, res, mockNext);

    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    });
  });
});
