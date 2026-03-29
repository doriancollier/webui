/**
 * Encrypted per-extension secret store using AES-256-GCM.
 *
 * Secrets are stored in `{dorkHome}/extension-secrets/{extensionId}.json`.
 * The host key lives at `{dorkHome}/host.key` (mode 0o600).
 * Encryption format: base64(IV[16] || AuthTag[16] || Ciphertext).
 *
 * @module shared/extension-secrets
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = 'dorkos-ext-secrets';

/** Per-process cache of the derived encryption key. */
let cachedDerivedKey: Buffer | null = null;
let cachedDorkHome: string | null = null;

/**
 * Reset the cached derived key. Exported for testing only.
 *
 * @internal
 */
export function resetKeyCache(): void {
  cachedDerivedKey = null;
  cachedDorkHome = null;
}

/**
 * Encrypted per-extension secret store using AES-256-GCM.
 *
 * Each extension gets its own JSON file under `{dorkHome}/extension-secrets/`.
 * A shared host key at `{dorkHome}/host.key` is used to derive the encryption
 * key via scrypt. The derived key is cached per-process to avoid repeated
 * key derivation.
 */
export class ExtensionSecretStore {
  private cache: Record<string, string> | null = null;
  private readonly secretsDir: string;
  private readonly secretsFilePath: string;
  private readonly hostKeyPath: string;

  constructor(
    private readonly extensionId: string,
    private readonly dorkHome: string
  ) {
    this.secretsDir = join(dorkHome, 'extension-secrets');
    this.secretsFilePath = join(this.secretsDir, `${extensionId}.json`);
    this.hostKeyPath = join(dorkHome, 'host.key');
  }

  /** Get a secret value by key. Returns null if not set. */
  async get(key: string): Promise<string | null> {
    const secrets = await this.loadSecrets();
    const encrypted = secrets[key];
    if (!encrypted) return null;
    try {
      return this.decrypt(encrypted);
    } catch {
      // Corrupted data — treat as missing
      return null;
    }
  }

  /** Set a secret value. Writes through to disk immediately. */
  async set(key: string, value: string): Promise<void> {
    const secrets = await this.loadSecrets();
    secrets[key] = this.encrypt(value);
    this.cache = secrets;
    await this.saveSecrets(secrets);
  }

  /** Delete a secret. Writes through to disk immediately. */
  async delete(key: string): Promise<void> {
    const secrets = await this.loadSecrets();
    delete secrets[key];
    this.cache = secrets;
    await this.saveSecrets(secrets);
  }

  /** Check if a secret key is set (without decrypting). */
  async has(key: string): Promise<boolean> {
    const secrets = await this.loadSecrets();
    return key in secrets;
  }

  private encrypt(plaintext: string): string {
    const key = this.getDerivedKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: IV[16] || AuthTag[16] || Ciphertext
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  private decrypt(encoded: string): string {
    const key = this.getDerivedKey();
    const buf = Buffer.from(encoded, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  private getDerivedKey(): Buffer {
    if (cachedDerivedKey && cachedDorkHome === this.dorkHome) {
      return cachedDerivedKey;
    }
    const hostKey = this.loadOrCreateHostKey();
    cachedDerivedKey = scryptSync(hostKey, SALT, KEY_LENGTH) as Buffer;
    cachedDorkHome = this.dorkHome;
    return cachedDerivedKey;
  }

  private loadOrCreateHostKey(): Buffer {
    const keyPath = this.hostKeyPath;
    if (existsSync(keyPath)) {
      return readFileSync(keyPath);
    }
    const key = randomBytes(KEY_LENGTH);
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, key, { mode: 0o600 });
    return key;
  }

  private async loadSecrets(): Promise<Record<string, string>> {
    if (this.cache) return this.cache;
    try {
      const data = await readFile(this.secretsFilePath, 'utf-8');
      this.cache = JSON.parse(data) as Record<string, string>;
      return this.cache;
    } catch {
      this.cache = {};
      return this.cache;
    }
  }

  private async saveSecrets(secrets: Record<string, string>): Promise<void> {
    await mkdir(this.secretsDir, { recursive: true });
    const tempPath = this.secretsFilePath + '.tmp';
    await writeFile(tempPath, JSON.stringify(secrets, null, 2), 'utf-8');
    await rename(tempPath, this.secretsFilePath);
  }
}
