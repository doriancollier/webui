import { describe, it, expect } from 'vitest';
import { checkBackpressure, DEFAULT_BP_CONFIG } from '../backpressure.js';
import type { BackpressureConfig } from '../types.js';

describe('checkBackpressure', () => {
  const config: BackpressureConfig = {
    enabled: true,
    maxMailboxSize: 1000,
    pressureWarningAt: 0.8,
  };

  it('allows delivery when mailbox is empty', () => {
    const result = checkBackpressure(0, config);

    expect(result.allowed).toBe(true);
    expect(result.currentSize).toBe(0);
    expect(result.pressure).toBe(0);
    expect(result.reason).toBeUndefined();
  });

  it('allows delivery when below maxMailboxSize', () => {
    const result = checkBackpressure(500, config);

    expect(result.allowed).toBe(true);
    expect(result.currentSize).toBe(500);
    expect(result.pressure).toBe(0.5);
    expect(result.reason).toBeUndefined();
  });

  it('rejects delivery when at maxMailboxSize', () => {
    const result = checkBackpressure(1000, config);

    expect(result.allowed).toBe(false);
    expect(result.currentSize).toBe(1000);
    expect(result.pressure).toBe(1.0);
    expect(result.reason).toBe('backpressure: mailbox full (1000/1000)');
  });

  it('rejects delivery when above maxMailboxSize', () => {
    const result = checkBackpressure(1500, config);

    expect(result.allowed).toBe(false);
    expect(result.currentSize).toBe(1500);
    expect(result.pressure).toBe(1.0);
    expect(result.reason).toBe('backpressure: mailbox full (1500/1000)');
  });

  it('returns pressure ratio 0.0 for empty mailbox', () => {
    const result = checkBackpressure(0, config);

    expect(result.pressure).toBe(0.0);
  });

  it('returns pressure ratio 0.5 for half-full mailbox', () => {
    const result = checkBackpressure(500, config);

    expect(result.pressure).toBe(0.5);
  });

  it('returns pressure ratio 1.0 for full mailbox', () => {
    const result = checkBackpressure(1000, config);

    expect(result.pressure).toBe(1.0);
  });

  it('caps pressure at 1.0 for overfull mailbox', () => {
    const result = checkBackpressure(2000, config);

    expect(result.pressure).toBe(1.0);
  });

  it('allows all messages when disabled', () => {
    const disabledConfig: BackpressureConfig = {
      enabled: false,
      maxMailboxSize: 1000,
      pressureWarningAt: 0.8,
    };

    const result = checkBackpressure(5000, disabledConfig);

    expect(result.allowed).toBe(true);
    expect(result.currentSize).toBe(5000);
    expect(result.pressure).toBe(0);
    expect(result.reason).toBeUndefined();
  });

  it('handles maxMailboxSize of 0 without division error', () => {
    const zeroConfig: BackpressureConfig = {
      enabled: true,
      maxMailboxSize: 0,
      pressureWarningAt: 0.8,
    };

    // maxMailboxSize is 0 so currentSize (5) >= maxMailboxSize (0) triggers rejection
    const result = checkBackpressure(5, zeroConfig);

    expect(result.allowed).toBe(false);
    expect(result.pressure).toBe(0);
    expect(result.currentSize).toBe(5);
    expect(result.reason).toBe('backpressure: mailbox full (5/0)');

    // Even with 0 messages, currentSize (0) >= maxMailboxSize (0) triggers rejection
    const emptyResult = checkBackpressure(0, zeroConfig);

    expect(emptyResult.allowed).toBe(false);
    expect(emptyResult.pressure).toBe(0);
    expect(emptyResult.reason).toBe('backpressure: mailbox full (0/0)');
  });

  it('exports DEFAULT_BP_CONFIG with expected defaults', () => {
    expect(DEFAULT_BP_CONFIG).toEqual({
      enabled: true,
      maxMailboxSize: 1000,
      pressureWarningAt: 0.8,
    });
  });

  it('uses DEFAULT_BP_CONFIG when no config provided', () => {
    const result = checkBackpressure(500);

    expect(result.allowed).toBe(true);
    expect(result.pressure).toBe(0.5);
    expect(result.currentSize).toBe(500);
  });
});
