import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreakerManager, DEFAULT_CB_CONFIG } from '../circuit-breaker.js';

describe('CircuitBreakerManager', () => {
  let cbm: CircuitBreakerManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-24T12:00:00.000Z'));
    cbm = new CircuitBreakerManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('CLOSED state', () => {
    it('allows delivery when no failures recorded', () => {
      const result = cbm.check('endpoint-abc');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('CLOSED');
    });

    it('tracks consecutive failures', () => {
      cbm.recordFailure('endpoint-abc');
      cbm.recordFailure('endpoint-abc');

      // Should still be CLOSED (threshold is 5)
      const result = cbm.check('endpoint-abc');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('CLOSED');

      const states = cbm.getStates();
      expect(states.get('endpoint-abc')?.consecutiveFailures).toBe(2);
    });

    it('transitions to OPEN after failureThreshold consecutive failures', () => {
      for (let i = 0; i < DEFAULT_CB_CONFIG.failureThreshold; i++) {
        cbm.recordFailure('endpoint-abc');
      }

      const result = cbm.check('endpoint-abc');
      expect(result.allowed).toBe(false);
      expect(result.state).toBe('OPEN');
    });

    it('resets failure count on success', () => {
      cbm.recordFailure('endpoint-abc');
      cbm.recordFailure('endpoint-abc');
      cbm.recordFailure('endpoint-abc');

      const statesBefore = cbm.getStates();
      expect(statesBefore.get('endpoint-abc')?.consecutiveFailures).toBe(3);

      cbm.recordSuccess('endpoint-abc');

      const statesAfter = cbm.getStates();
      expect(statesAfter.get('endpoint-abc')?.consecutiveFailures).toBe(0);
    });
  });

  describe('OPEN state', () => {
    beforeEach(() => {
      // Trip the breaker to OPEN
      for (let i = 0; i < DEFAULT_CB_CONFIG.failureThreshold; i++) {
        cbm.recordFailure('endpoint-abc');
      }
    });

    it('rejects delivery immediately', () => {
      const result = cbm.check('endpoint-abc');
      expect(result.allowed).toBe(false);
      expect(result.state).toBe('OPEN');
    });

    it('transitions to HALF_OPEN after cooldown elapses', () => {
      // Advance time past the cooldown
      vi.setSystemTime(Date.now() + DEFAULT_CB_CONFIG.cooldownMs);

      const result = cbm.check('endpoint-abc');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('HALF_OPEN');
    });

    it('remains OPEN if cooldown has not elapsed', () => {
      // Advance time but not past cooldown
      vi.setSystemTime(Date.now() + DEFAULT_CB_CONFIG.cooldownMs - 1);

      const result = cbm.check('endpoint-abc');
      expect(result.allowed).toBe(false);
      expect(result.state).toBe('OPEN');
    });

    it('includes endpoint hash in rejection reason', () => {
      const result = cbm.check('endpoint-abc');
      expect(result.reason).toBe('circuit open for endpoint endpoint-abc');
    });
  });

  describe('HALF_OPEN state', () => {
    beforeEach(() => {
      // Trip to OPEN, then advance past cooldown to HALF_OPEN
      for (let i = 0; i < DEFAULT_CB_CONFIG.failureThreshold; i++) {
        cbm.recordFailure('endpoint-abc');
      }
      vi.setSystemTime(Date.now() + DEFAULT_CB_CONFIG.cooldownMs);
      cbm.check('endpoint-abc'); // triggers transition to HALF_OPEN
    });

    it('allows a single probe message', () => {
      const result = cbm.check('endpoint-abc');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('HALF_OPEN');
    });

    it('transitions to CLOSED after successToClose consecutive successes', () => {
      for (let i = 0; i < DEFAULT_CB_CONFIG.successToClose; i++) {
        cbm.recordSuccess('endpoint-abc');
      }

      const result = cbm.check('endpoint-abc');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('CLOSED');

      const states = cbm.getStates();
      const breaker = states.get('endpoint-abc');
      expect(breaker?.consecutiveFailures).toBe(0);
      expect(breaker?.openedAt).toBeNull();
      expect(breaker?.halfOpenSuccesses).toBe(0);
    });

    it('transitions back to OPEN on probe failure', () => {
      cbm.recordFailure('endpoint-abc');

      const result = cbm.check('endpoint-abc');
      expect(result.allowed).toBe(false);
      expect(result.state).toBe('OPEN');
    });

    it('resets halfOpenSuccesses on transition back to OPEN', () => {
      // Record one success, then fail
      cbm.recordSuccess('endpoint-abc');
      cbm.recordFailure('endpoint-abc');

      const states = cbm.getStates();
      expect(states.get('endpoint-abc')?.halfOpenSuccesses).toBe(0);
      expect(states.get('endpoint-abc')?.state).toBe('OPEN');
    });
  });

  describe('state management', () => {
    it('creates new breaker in CLOSED state for unknown endpoint', () => {
      const result = cbm.check('brand-new-endpoint');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('CLOSED');

      const states = cbm.getStates();
      const breaker = states.get('brand-new-endpoint');
      expect(breaker).toBeDefined();
      expect(breaker?.state).toBe('CLOSED');
      expect(breaker?.consecutiveFailures).toBe(0);
      expect(breaker?.openedAt).toBeNull();
      expect(breaker?.halfOpenSuccesses).toBe(0);
    });

    it('maintains separate state per endpoint hash', () => {
      // Trip endpoint-a to OPEN
      for (let i = 0; i < DEFAULT_CB_CONFIG.failureThreshold; i++) {
        cbm.recordFailure('endpoint-a');
      }

      // endpoint-b should still be CLOSED
      const resultA = cbm.check('endpoint-a');
      const resultB = cbm.check('endpoint-b');

      expect(resultA.allowed).toBe(false);
      expect(resultA.state).toBe('OPEN');
      expect(resultB.allowed).toBe(true);
      expect(resultB.state).toBe('CLOSED');
    });

    it('reset() clears a specific breaker', () => {
      cbm.recordFailure('endpoint-abc');
      cbm.recordFailure('endpoint-abc');

      const statesBefore = cbm.getStates();
      expect(statesBefore.has('endpoint-abc')).toBe(true);

      cbm.reset('endpoint-abc');

      const statesAfter = cbm.getStates();
      expect(statesAfter.has('endpoint-abc')).toBe(false);

      // Next check creates a fresh CLOSED breaker
      const result = cbm.check('endpoint-abc');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('CLOSED');
    });

    it('getStates() returns a copy of all breaker states', () => {
      cbm.check('endpoint-a');
      cbm.check('endpoint-b');

      const states = cbm.getStates();
      expect(states.size).toBe(2);
      expect(states.has('endpoint-a')).toBe(true);
      expect(states.has('endpoint-b')).toBe(true);

      // Modifying the copy should not affect the manager
      states.delete('endpoint-a');
      const statesAgain = cbm.getStates();
      expect(statesAgain.has('endpoint-a')).toBe(true);
    });

    it('updateConfig() changes thresholds for future checks', () => {
      // Lower the threshold to 2
      cbm.updateConfig({ failureThreshold: 2 });

      cbm.recordFailure('endpoint-abc');
      cbm.recordFailure('endpoint-abc');

      const result = cbm.check('endpoint-abc');
      expect(result.allowed).toBe(false);
      expect(result.state).toBe('OPEN');
    });
  });

  describe('disabled', () => {
    it('always allows when enabled=false', () => {
      const disabledCbm = new CircuitBreakerManager({ enabled: false });

      // Record many failures
      for (let i = 0; i < 100; i++) {
        disabledCbm.recordFailure('endpoint-abc');
      }

      const result = disabledCbm.check('endpoint-abc');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('CLOSED');
    });
  });

  describe('custom configuration', () => {
    it('uses custom failureThreshold', () => {
      const customCbm = new CircuitBreakerManager({ failureThreshold: 3 });

      customCbm.recordFailure('ep');
      customCbm.recordFailure('ep');
      expect(customCbm.check('ep').allowed).toBe(true);

      customCbm.recordFailure('ep');
      expect(customCbm.check('ep').allowed).toBe(false);
    });

    it('uses custom cooldownMs', () => {
      const customCbm = new CircuitBreakerManager({
        failureThreshold: 1,
        cooldownMs: 5000,
      });

      customCbm.recordFailure('ep');
      expect(customCbm.check('ep').state).toBe('OPEN');

      // Advance 4999ms - still OPEN
      vi.setSystemTime(Date.now() + 4999);
      expect(customCbm.check('ep').state).toBe('OPEN');

      // Advance to exactly 5000ms - transitions to HALF_OPEN
      vi.setSystemTime(Date.now() + 1);
      expect(customCbm.check('ep').state).toBe('HALF_OPEN');
    });

    it('uses custom successToClose', () => {
      const customCbm = new CircuitBreakerManager({
        failureThreshold: 1,
        cooldownMs: 1000,
        successToClose: 3,
      });

      // Trip to OPEN, then HALF_OPEN
      customCbm.recordFailure('ep');
      vi.setSystemTime(Date.now() + 1000);
      customCbm.check('ep');

      // Need 3 successes to close
      customCbm.recordSuccess('ep');
      expect(customCbm.getStates().get('ep')?.state).toBe('HALF_OPEN');

      customCbm.recordSuccess('ep');
      expect(customCbm.getStates().get('ep')?.state).toBe('HALF_OPEN');

      customCbm.recordSuccess('ep');
      expect(customCbm.getStates().get('ep')?.state).toBe('CLOSED');
    });
  });

  describe('recordSuccess on unknown endpoint', () => {
    it('is a no-op for unknown endpoint hash', () => {
      // Should not throw or create a breaker
      cbm.recordSuccess('nonexistent');
      expect(cbm.getStates().has('nonexistent')).toBe(false);
    });
  });
});
