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

export interface RelayOptions {
  dataDir?: string;
  maxHops?: number;
  defaultTtlMs?: number;
  defaultCallBudget?: number;
}

export interface PublishOptions {
  from: string;
  replyTo?: string;
  budget?: Partial<RelayBudget>;
}
