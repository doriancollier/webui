import { describe, it, expect } from 'vitest';
import type { Response } from 'express';
import type { SseResponse } from '@dorkos/shared/agent-runtime';

describe('SseResponse type compatibility', () => {
  it('Express Response satisfies SseResponse', () => {
    // Type-level assertion — fails at compile time if incompatible
    const _check: SseResponse = {} as Response;
    expect(true).toBe(true);
  });
});
