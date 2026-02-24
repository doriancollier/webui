/**
 * @dorkos/relay -- Foundational message bus for DorkOS.
 *
 * Provides NATS-style subject matching, Maildir-based persistence,
 * SQLite indexing, budget envelope enforcement, ephemeral signals,
 * and pattern-based access control.
 *
 * @module relay
 */

// Main entry point
export { RelayCore } from './relay-core.js';
export type { PublishResult } from './relay-core.js';

// Sub-modules (for advanced usage)
export { EndpointRegistry, hashSubject } from './endpoint-registry.js';
export { SubscriptionRegistry } from './subscription-registry.js';
export { MaildirStore } from './maildir-store.js';
export type {
  MaildirStoreOptions,
  DeliverResult,
  ClaimResult,
  FailResult,
} from './maildir-store.js';

export { SqliteIndex } from './sqlite-index.js';
export type {
  SqliteIndexOptions,
  IndexedMessage,
  MessageStatus,
} from './sqlite-index.js';

export { DeadLetterQueue } from './dead-letter-queue.js';
export type {
  DeadLetterQueueOptions,
  RejectResult,
  DeadLetterEntry,
  ListDeadOptions,
  PurgeOptions,
  PurgeResult,
} from './dead-letter-queue.js';

export { AccessControl } from './access-control.js';
export { SignalEmitter } from './signal-emitter.js';

// Pure functions
export { validateSubject, matchesPattern } from './subject-matcher.js';
export type { SubjectValidationResult, SubjectValidationError } from './subject-matcher.js';
export { enforceBudget, createDefaultBudget } from './budget-enforcer.js';

// Types
export type {
  MessageHandler,
  SignalHandler,
  Unsubscribe,
  EndpointInfo,
  SubscriptionInfo,
  BudgetResult,
  AccessResult,
  DeadLetter,
  RelayMetrics,
  RelayOptions,
  PublishOptions,
} from './types.js';
