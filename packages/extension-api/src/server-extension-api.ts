/**
 * Server-side extension API types.
 *
 * Defines the contract for server-side extension entry points, including
 * the encrypted secret store, scoped storage, and lifecycle hooks.
 *
 * @module @dorkos/extension-api/server
 */

/** Encrypted per-extension secret store. */
export interface SecretStore {
  /** Get a secret value by key. Returns null if not set. */
  get(key: string): Promise<string | null>;
  /** Set a secret value. Writes through to disk immediately. */
  set(key: string, value: string): Promise<void>;
  /** Delete a secret. Writes through to disk immediately. */
  delete(key: string): Promise<void>;
  /** Check if a secret key is set (without decrypting). */
  has(key: string): Promise<boolean>;
}

/** Context injected into server-side extension code. */
export interface DataProviderContext {
  /** Encrypted per-extension secret store. */
  readonly secrets: SecretStore;
  /** Scoped persistent storage for extension data. */
  readonly storage: {
    loadData<T = unknown>(): Promise<T | null>;
    saveData<T = unknown>(data: T): Promise<void>;
  };
  /** Schedule a recurring function. Returns an unsubscribe/cancel function. */
  schedule(intervalSeconds: number, fn: () => Promise<void>): () => void;
  /** Emit an event to subscribed clients. */
  emit(event: string, data: unknown): void;
  /** This extension's ID from the manifest. */
  readonly extensionId: string;
  /** Absolute path to the extension's directory on disk. */
  readonly extensionDir: string;
}

/** Server-side extension entry point signature. */
export type ServerExtensionRegister = (
  router: import('express').Router,
  ctx: DataProviderContext
) => void | (() => void) | Promise<void | (() => void)>;
