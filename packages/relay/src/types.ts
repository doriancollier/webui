/**
 * Internal type definitions for the @dorkos/relay package.
 *
 * All types used across relay modules are defined here to avoid
 * circular imports and provide a single source of truth.
 *
 * @module relay/types
 */
import type { RelayEnvelope, RelayBudget, Signal, RelayAccessRule } from '@dorkos/shared/relay-schemas';

export type MessageHandler = (envelope: RelayEnvelope) => void | Promise<void>;
export type SignalHandler = (subject: string, signal: Signal) => void;
export type Unsubscribe = () => void;

export interface EndpointInfo {
  subject: string;
  hash: string;
  maildirPath: string;
  registeredAt: string;
}

export interface SubscriptionInfo {
  id: string;
  pattern: string;
  createdAt: string;
}

export interface BudgetResult {
  allowed: boolean;
  reason?: string;
  updatedBudget?: RelayBudget;
}

export interface AccessResult {
  allowed: boolean;
  matchedRule?: RelayAccessRule;
}

export interface DeadLetter {
  envelope: RelayEnvelope;
  reason: string;
  failedAt: string;
  endpointHash: string;
}

export interface RelayMetrics {
  totalMessages: number;
  byStatus: Record<string, number>;
  bySubject: Array<{ subject: string; count: number }>;
}

// --- Rate Limiting ---

/** Result of a per-sender rate limit check. */
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  /** Current message count in the window (for diagnostics). */
  currentCount?: number;
  /** The configured limit that was checked against. */
  limit?: number;
}

/** Configuration for per-sender sliding window rate limiting. */
export interface RateLimitConfig {
  enabled: boolean;
  /** Sliding window duration in seconds. Default: 60 */
  windowSecs: number;
  /** Maximum messages per sender per window. Default: 100 */
  maxPerWindow: number;
  /** Subject prefix to limit override for specific senders. */
  perSenderOverrides?: Record<string, number>;
}

// --- Circuit Breaker ---

/** The three possible states of a per-endpoint circuit breaker. */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** In-memory state for a single endpoint's circuit breaker. */
export interface CircuitBreakerState {
  state: CircuitState;
  /** Number of consecutive delivery failures in the current state. */
  consecutiveFailures: number;
  /** Timestamp (ms) when OPEN state was entered. Null when CLOSED. */
  openedAt: number | null;
  /** Consecutive successful probes in HALF_OPEN state. */
  halfOpenSuccesses: number;
}

/** Result of a per-endpoint circuit breaker check. */
export interface CircuitBreakerResult {
  allowed: boolean;
  reason?: string;
  /** The current circuit state at the time of the check. */
  state: CircuitState;
}

/** Configuration for the per-endpoint circuit breaker. */
export interface CircuitBreakerConfig {
  enabled: boolean;
  /** Consecutive failures to trip the breaker. Default: 5 */
  failureThreshold: number;
  /** Milliseconds before OPEN to HALF_OPEN transition. Default: 30000 */
  cooldownMs: number;
  /** Probe messages allowed in HALF_OPEN before re-evaluating. Default: 1 */
  halfOpenProbeCount: number;
  /** Consecutive successes required to close from HALF_OPEN. Default: 2 */
  successToClose: number;
}

// --- Backpressure ---

/** Result of an endpoint backpressure check. */
export interface BackpressureResult {
  allowed: boolean;
  reason?: string;
  /** Current mailbox depth (messages with status='new'). */
  currentSize: number;
  /** Pressure ratio 0.0–1.0 (currentSize / maxMailboxSize). */
  pressure: number;
}

/** Configuration for reactive backpressure load-shedding. */
export interface BackpressureConfig {
  enabled: boolean;
  /** Maximum unprocessed messages before hard rejection. Default: 1000 */
  maxMailboxSize: number;
  /** Pressure ratio (0–1) at which to emit a warning signal. Default: 0.8 */
  pressureWarningAt: number;
}

// --- Composite Reliability Config ---

/**
 * Composite reliability configuration for the relay pipeline.
 *
 * All three subsystems (rate limiting, circuit breakers, backpressure) are
 * independently configurable. Omitting a subsystem keeps its built-in defaults.
 */
export interface ReliabilityConfig {
  rateLimit?: Partial<RateLimitConfig>;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  backpressure?: Partial<BackpressureConfig>;
}

export interface RelayOptions {
  dataDir?: string;
  maxHops?: number;
  defaultTtlMs?: number;
  defaultCallBudget?: number;
  /** Optional reliability configuration. Omit to use built-in defaults for all subsystems. */
  reliability?: ReliabilityConfig;
}

export interface PublishOptions {
  from: string;
  replyTo?: string;
  budget?: Partial<RelayBudget>;
}
