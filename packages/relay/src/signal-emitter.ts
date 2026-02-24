/**
 * Ephemeral signal emitter for the Relay message bus.
 *
 * Wraps Node.js `EventEmitter` to provide typed, pattern-based signal
 * subscriptions. Signals are purely in-memory and never touch disk.
 * Used for real-time state: typing indicators, presence, read receipts,
 * delivery receipts, and progress updates.
 *
 * Both {@link emit} and {@link subscribe} use the same NATS-style subject
 * hierarchy and wildcard matching as the persistent message layer.
 *
 * @module relay/signal-emitter
 */
import { EventEmitter } from 'node:events';
import type { Signal } from '@dorkos/shared/relay-schemas';
import type { SignalHandler, Unsubscribe } from './types.js';
import { matchesPattern } from './subject-matcher.js';

// === Constants ===

/**
 * Internal event name used for all signals. We funnel every signal through
 * a single EventEmitter event and do pattern matching in the listener wrapper.
 * This avoids creating one EventEmitter event per subject (which would bypass
 * pattern wildcards entirely).
 */
const SIGNAL_EVENT = '__relay_signal__';

/** Reasonable max-listener cap to avoid memory leaks without being too restrictive. */
const MAX_LISTENERS = 100;

// === Types ===

/** Tracks a pattern subscription so it can be cleaned up on unsubscribe. */
interface PatternSubscription {
  pattern: string;
  handler: SignalHandler;
  wrappedListener: (subject: string, signal: Signal) => void;
}

// === SignalEmitter ===

/**
 * Ephemeral signal emitter with NATS-style pattern subscriptions.
 *
 * Signals flow through an internal `EventEmitter` and are matched against
 * subscriber patterns using the same wildcard semantics as Relay subjects
 * (`*` for single-token, `>` for multi-token tail).
 *
 * This class never writes to disk. All signals exist only in memory for the
 * lifetime of the emitter instance.
 *
 * @example
 * ```ts
 * const emitter = new SignalEmitter();
 *
 * // Subscribe to all typing signals under relay.human
 * const unsub = emitter.subscribe('relay.human.>', (subject, signal) => {
 *   console.log(`${subject}: ${signal.type} = ${signal.state}`);
 * });
 *
 * // Emit a typing signal
 * emitter.emit('relay.human.telegram.dorian', {
 *   type: 'typing',
 *   state: 'active',
 *   endpointSubject: 'relay.human.telegram.dorian',
 *   timestamp: new Date().toISOString(),
 * });
 *
 * // Clean up
 * unsub();
 * ```
 */
export class SignalEmitter {
  private readonly ee: EventEmitter;
  private readonly subscriptions = new Map<string, PatternSubscription>();
  private nextSubscriptionId = 0;

  constructor() {
    this.ee = new EventEmitter();
    this.ee.setMaxListeners(MAX_LISTENERS);
  }

  /**
   * Emit a signal on a concrete subject.
   *
   * All subscribers whose pattern matches the subject will be invoked
   * synchronously. This mirrors the EventEmitter model — handlers should
   * be lightweight and non-blocking.
   *
   * @param subject - A concrete (non-wildcard) subject, e.g. `relay.human.telegram.dorian`
   * @param signal - The signal payload to emit
   */
  emit(subject: string, signal: Signal): void {
    this.ee.emit(SIGNAL_EVENT, subject, signal);
  }

  /**
   * Subscribe to signals matching a NATS-style pattern.
   *
   * Supports `*` (single-token wildcard) and `>` (multi-token tail wildcard).
   * The handler is called with the concrete subject and the signal payload
   * for every signal whose subject matches the pattern.
   *
   * @param pattern - A subject pattern, e.g. `relay.human.>` or `relay.agent.*.backend`
   * @param handler - Callback invoked for each matching signal
   * @returns An {@link Unsubscribe} function that removes the subscription
   */
  subscribe(pattern: string, handler: SignalHandler): Unsubscribe {
    const id = String(this.nextSubscriptionId++);

    const wrappedListener = (subject: string, signal: Signal): void => {
      if (matchesPattern(subject, pattern)) {
        handler(subject, signal);
      }
    };

    const subscription: PatternSubscription = { pattern, handler, wrappedListener };
    this.subscriptions.set(id, subscription);

    this.ee.on(SIGNAL_EVENT, wrappedListener);

    return () => {
      const sub = this.subscriptions.get(id);
      if (sub) {
        this.ee.removeListener(SIGNAL_EVENT, sub.wrappedListener);
        this.subscriptions.delete(id);
      }
    };
  }

  /**
   * Return the number of active subscriptions.
   *
   * Useful for diagnostics and testing cleanup behaviour.
   */
  get subscriberCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Remove all subscriptions and reset the emitter.
   *
   * After calling this, all previously returned {@link Unsubscribe} functions
   * become no-ops.
   */
  removeAllSubscriptions(): void {
    this.ee.removeAllListeners(SIGNAL_EVENT);
    this.subscriptions.clear();
  }
}
