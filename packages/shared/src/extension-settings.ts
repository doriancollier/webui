/**
 * Plaintext per-extension settings store.
 *
 * Settings are stored in `{dorkHome}/extension-settings/{extensionId}.json`.
 * Unlike secrets, settings are not encrypted — they hold non-sensitive
 * configuration values (refresh intervals, display toggles, filter selections).
 *
 * @module shared/extension-settings
 */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';

/**
 * Plaintext per-extension settings store using JSON files.
 *
 * Each extension gets its own JSON file under `{dorkHome}/extension-settings/`.
 * Writes use the atomic temp-file-then-rename pattern for safety.
 */
export class ExtensionSettingsStore {
  private readonly filePath: string;

  constructor(dorkHome: string, extensionId: string) {
    const dir = join(dorkHome, 'extension-settings');
    this.filePath = join(dir, `${extensionId}.json`);
  }

  /** Get a setting value by key. Returns null if not set. */
  async get<T extends string | number | boolean = string | number | boolean>(
    key: string
  ): Promise<T | null> {
    const data = await this.loadAll();
    return (data[key] as T) ?? null;
  }

  /** Set a setting value. Writes through to disk immediately. */
  async set(key: string, value: string | number | boolean): Promise<void> {
    const data = await this.loadAll();
    data[key] = value;
    await this.saveAll(data);
  }

  /** Delete a setting value. Writes through to disk immediately. */
  async delete(key: string): Promise<void> {
    const data = await this.loadAll();
    delete data[key];
    await this.saveAll(data);
  }

  /** Get all stored settings as a key-value record. */
  async getAll(): Promise<Record<string, string | number | boolean>> {
    return this.loadAll();
  }

  private async loadAll(): Promise<Record<string, string | number | boolean>> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      return JSON.parse(raw) as Record<string, string | number | boolean>;
    } catch {
      return {};
    }
  }

  private async saveAll(data: Record<string, string | number | boolean>): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    const tmp = this.filePath + '.tmp';
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
    await rename(tmp, this.filePath);
  }
}
