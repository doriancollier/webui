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

/** Read/write access to non-secret extension configuration (plaintext JSON). */
export interface SettingsStore {
  /** Get a setting value by key. Returns null if not set. */
  get<T extends string | number | boolean = string | number | boolean>(
    key: string
  ): Promise<T | null>;
  /** Set a setting value. Writes through to disk immediately. */
  set(key: string, value: string | number | boolean): Promise<void>;
  /** Delete a setting value. Writes through to disk immediately. */
  delete(key: string): Promise<void>;
  /** Get all stored settings as a key-value record. */
  getAll(): Promise<Record<string, string | number | boolean>>;
}

/** Context injected into server-side extension code. */
export interface DataProviderContext {
  /** Encrypted per-extension secret store. */
  readonly secrets: SecretStore;
  /** Non-secret extension configuration store (plaintext JSON). */
  readonly settings: SettingsStore;
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
