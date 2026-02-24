/**
 * Endpoint registry for the Relay message bus.
 *
 * Manages the lifecycle of message endpoints — registering, unregistering,
 * and looking up endpoints by subject. Each registered endpoint gets a
 * Maildir directory structure (tmp/, new/, cur/, failed/) created under
 * the configured data directory.
 *
 * Endpoint hashes are deterministic SHA-256 digests of the subject string,
 * truncated to 12 hex characters for filesystem-safe directory names.
 *
 * @module relay/endpoint-registry
 */
import { createHash } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSubject } from './subject-matcher.js';
import type { EndpointInfo } from './types.js';

/** Maildir subdirectories created for each endpoint. */
const MAILDIR_DIRS = ['tmp', 'new', 'cur', 'failed'] as const;

/** Length of the truncated hash used for directory names. */
const HASH_LENGTH = 12;

/**
 * Compute a deterministic, filesystem-safe hash for a subject string.
 *
 * Uses SHA-256, truncated to {@link HASH_LENGTH} hex characters. The same
 * subject always produces the same hash, making directory lookups predictable
 * without maintaining a separate mapping file.
 *
 * @param subject - A validated subject string (e.g. `relay.agent.myproject.backend`)
 * @returns A lowercase hex string of length {@link HASH_LENGTH}
 */
export function hashSubject(subject: string): string {
  return createHash('sha256').update(subject).digest('hex').slice(0, HASH_LENGTH);
}

/**
 * In-memory registry of message endpoints, backed by Maildir directories on disk.
 *
 * Endpoints are stored in a `Map<subject, EndpointInfo>` for O(1) lookup.
 * On registration, the Maildir directory structure is created atomically.
 * On unregistration, directories are removed and the entry is deleted.
 */
export class EndpointRegistry {
  /** Base directory for all endpoint mailboxes (e.g. `~/.dork/relay/mailboxes`). */
  private readonly mailboxesDir: string;

  /** Subject -> EndpointInfo mapping. */
  private readonly endpoints = new Map<string, EndpointInfo>();

  /**
   * Create an EndpointRegistry.
   *
   * @param dataDir - Root data directory for Relay (e.g. `~/.dork/relay`).
   *                  Mailboxes will be created under `{dataDir}/mailboxes/`.
   */
  constructor(dataDir: string) {
    this.mailboxesDir = join(dataDir, 'mailboxes');
  }

  /**
   * Register a new message endpoint.
   *
   * Validates the subject, computes a deterministic hash, creates the
   * Maildir directory structure, and stores the endpoint info in memory.
   *
   * @param subject - The hierarchical subject for this endpoint (e.g. `relay.agent.myproject.backend`).
   *                  Must not contain wildcards (`*` or `>`).
   * @returns The registered {@link EndpointInfo}
   * @throws If the subject is invalid or the endpoint is already registered
   */
  async registerEndpoint(subject: string): Promise<EndpointInfo> {
    const validation = validateSubject(subject);
    if (!validation.valid) {
      throw new Error(`Invalid subject: ${validation.reason.message}`);
    }

    // Endpoints must be concrete subjects — no wildcards
    if (subject.includes('*') || subject.includes('>')) {
      throw new Error('Endpoint subjects must not contain wildcards (* or >)');
    }

    if (this.endpoints.has(subject)) {
      throw new Error(`Endpoint already registered: ${subject}`);
    }

    const hash = hashSubject(subject);
    const maildirPath = join(this.mailboxesDir, hash);

    // Create all Maildir subdirectories
    for (const dir of MAILDIR_DIRS) {
      await mkdir(join(maildirPath, dir), { recursive: true });
    }

    const info: EndpointInfo = {
      subject,
      hash,
      maildirPath,
      registeredAt: new Date().toISOString(),
    };

    this.endpoints.set(subject, info);
    return info;
  }

  /**
   * Unregister an endpoint and remove its Maildir directory.
   *
   * @param subject - The subject of the endpoint to unregister
   * @returns `true` if the endpoint was found and removed, `false` if not found
   */
  async unregisterEndpoint(subject: string): Promise<boolean> {
    const info = this.endpoints.get(subject);
    if (!info) {
      return false;
    }

    // Remove the Maildir directory tree
    await rm(info.maildirPath, { recursive: true, force: true });

    this.endpoints.delete(subject);
    return true;
  }

  /**
   * Look up an endpoint by its subject.
   *
   * @param subject - The subject to look up
   * @returns The {@link EndpointInfo} if found, or `undefined`
   */
  getEndpoint(subject: string): EndpointInfo | undefined {
    return this.endpoints.get(subject);
  }

  /**
   * Look up an endpoint by its hash.
   *
   * Performs a linear scan since hash-based lookup is secondary.
   * Use {@link getEndpoint} for the common case of subject-based lookup.
   *
   * @param hash - The endpoint hash to look up
   * @returns The {@link EndpointInfo} if found, or `undefined`
   */
  getEndpointByHash(hash: string): EndpointInfo | undefined {
    for (const info of this.endpoints.values()) {
      if (info.hash === hash) {
        return info;
      }
    }
    return undefined;
  }

  /**
   * List all registered endpoints.
   *
   * @returns An array of all registered {@link EndpointInfo} objects
   */
  listEndpoints(): EndpointInfo[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Check whether an endpoint is registered for the given subject.
   *
   * @param subject - The subject to check
   * @returns `true` if an endpoint is registered for this subject
   */
  hasEndpoint(subject: string): boolean {
    return this.endpoints.has(subject);
  }

  /**
   * Get the number of registered endpoints.
   *
   * @returns The count of registered endpoints
   */
  get size(): number {
    return this.endpoints.size;
  }
}
