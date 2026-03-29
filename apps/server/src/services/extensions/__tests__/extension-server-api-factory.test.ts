import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createDataProviderContext } from '../extension-server-api-factory.js';

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../core/event-fan-out.js', () => ({
  eventFanOut: {
    broadcast: vi.fn(),
  },
}));

let mockBroadcast: ReturnType<typeof vi.fn>;
let mockLoggerError: ReturnType<typeof vi.fn>;

describe('createDataProviderContext', () => {
  let tmpDir: string;
  const extensionId = 'test-extension';
  const extensionDir = '/fake/ext/dir';

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ext-api-factory-'));

    const { eventFanOut } = await import('../../core/event-fan-out.js');
    mockBroadcast = vi.mocked(eventFanOut.broadcast);

    const { logger } = await import('../../../lib/logger.js');
    mockLoggerError = vi.mocked(logger.error);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function buildCtx(overrides?: { extensionId?: string; dorkHome?: string }) {
    return createDataProviderContext({
      extensionId: overrides?.extensionId ?? extensionId,
      extensionDir,
      dorkHome: overrides?.dorkHome ?? tmpDir,
    });
  }

  describe('metadata fields', () => {
    it('exposes extensionId and extensionDir', () => {
      const { ctx } = buildCtx();
      expect(ctx.extensionId).toBe(extensionId);
      expect(ctx.extensionDir).toBe(extensionDir);
    });
  });

  describe('secrets', () => {
    it('provides an ExtensionSecretStore with the correct extensionId', async () => {
      const { ctx } = buildCtx();
      // Verify secrets interface is present and functional
      expect(ctx.secrets).toBeDefined();
      expect(typeof ctx.secrets.get).toBe('function');
      expect(typeof ctx.secrets.set).toBe('function');
      expect(typeof ctx.secrets.delete).toBe('function');
      expect(typeof ctx.secrets.has).toBe('function');

      // A missing key returns null
      const result = await ctx.secrets.get('nonexistent');
      expect(result).toBeNull();
    });

    it('can round-trip a secret value', async () => {
      const { ctx } = buildCtx();
      await ctx.secrets.set('api-key', 'sk-12345');
      const value = await ctx.secrets.get('api-key');
      expect(value).toBe('sk-12345');
    });
  });

  describe('storage.loadData', () => {
    it('returns null when no data file exists', async () => {
      const { ctx } = buildCtx();
      const data = await ctx.storage.loadData();
      expect(data).toBeNull();
    });

    it('returns parsed JSON when file exists', async () => {
      const dataDir = path.join(tmpDir, 'extension-data', extensionId);
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify({ count: 42 }), 'utf-8');

      const { ctx } = buildCtx();
      const data = await ctx.storage.loadData<{ count: number }>();
      expect(data).toEqual({ count: 42 });
    });
  });

  describe('storage.saveData', () => {
    it('writes JSON to the correct path with atomic rename', async () => {
      const { ctx } = buildCtx();
      await ctx.storage.saveData({ status: 'active', items: [1, 2, 3] });

      const dataPath = path.join(tmpDir, 'extension-data', extensionId, 'data.json');
      const raw = await fs.readFile(dataPath, 'utf-8');
      expect(JSON.parse(raw)).toEqual({ status: 'active', items: [1, 2, 3] });
    });

    it('creates parent directories if they do not exist', async () => {
      const { ctx } = buildCtx();
      await ctx.storage.saveData({ hello: 'world' });

      const dataPath = path.join(tmpDir, 'extension-data', extensionId, 'data.json');
      const stat = await fs.stat(dataPath);
      expect(stat.isFile()).toBe(true);
    });

    it('round-trips data through saveData and loadData', async () => {
      const { ctx } = buildCtx();
      const payload = { nested: { value: true }, list: ['a', 'b'] };
      await ctx.storage.saveData(payload);
      const loaded = await ctx.storage.loadData();
      expect(loaded).toEqual(payload);
    });
  });

  describe('schedule', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls the function at the specified interval', async () => {
      const { ctx } = buildCtx();
      const fn = vi.fn().mockResolvedValue(undefined);

      ctx.schedule(10, fn);

      // Not called immediately
      expect(fn).not.toHaveBeenCalled();

      // Advance 10 seconds
      await vi.advanceTimersByTimeAsync(10_000);
      expect(fn).toHaveBeenCalledTimes(1);

      // Advance another 10 seconds
      await vi.advanceTimersByTimeAsync(10_000);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('returns a cancel function that stops the interval', async () => {
      const { ctx } = buildCtx();
      const fn = vi.fn().mockResolvedValue(undefined);

      const cancel = ctx.schedule(10, fn);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(fn).toHaveBeenCalledTimes(1);

      cancel();

      await vi.advanceTimersByTimeAsync(20_000);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('clamps intervals below 5 seconds to the minimum floor', async () => {
      const { ctx } = buildCtx();
      const fn = vi.fn().mockResolvedValue(undefined);

      ctx.schedule(2, fn);

      // At 2 seconds, should NOT have fired (clamped to 5s)
      await vi.advanceTimersByTimeAsync(2_000);
      expect(fn).not.toHaveBeenCalled();

      // At 5 seconds, should fire
      await vi.advanceTimersByTimeAsync(3_000);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('catches and logs errors from scheduled functions', async () => {
      const { ctx } = buildCtx();
      const fn = vi.fn().mockRejectedValue(new Error('boom'));

      ctx.schedule(5, fn);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockLoggerError).toHaveBeenCalledWith(
        `[ext:${extensionId}] Scheduled task error:`,
        expect.any(Error)
      );
    });
  });

  describe('emit', () => {
    it('broadcasts via eventFanOut with namespaced event', () => {
      const { ctx } = buildCtx();
      ctx.emit('status-changed', { issueId: 'ISS-1', status: 'done' });

      expect(mockBroadcast).toHaveBeenCalledWith(`ext:${extensionId}:status-changed`, {
        issueId: 'ISS-1',
        status: 'done',
      });
    });

    it('uses the correct extension ID in the event namespace', () => {
      const { ctx } = buildCtx({ extensionId: 'my-plugin' });
      ctx.emit('refresh', null);

      expect(mockBroadcast).toHaveBeenCalledWith('ext:my-plugin:refresh', null);
    });
  });

  describe('getScheduledCleanups', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns all registered cancel functions', () => {
      const { ctx, getScheduledCleanups } = buildCtx();

      ctx.schedule(10, vi.fn().mockResolvedValue(undefined));
      ctx.schedule(20, vi.fn().mockResolvedValue(undefined));

      const cleanups = getScheduledCleanups();
      expect(cleanups).toHaveLength(2);
      expect(cleanups.every((fn) => typeof fn === 'function')).toBe(true);
    });

    it('returns a defensive copy (not the internal array)', () => {
      const { ctx, getScheduledCleanups } = buildCtx();

      ctx.schedule(10, vi.fn().mockResolvedValue(undefined));

      const copy1 = getScheduledCleanups();
      const copy2 = getScheduledCleanups();
      expect(copy1).not.toBe(copy2);
      expect(copy1).toEqual(copy2);
    });

    it('cancelling all cleanups stops all intervals', async () => {
      const { ctx, getScheduledCleanups } = buildCtx();
      const fn1 = vi.fn().mockResolvedValue(undefined);
      const fn2 = vi.fn().mockResolvedValue(undefined);

      ctx.schedule(5, fn1);
      ctx.schedule(10, fn2);

      // Cancel all
      for (const cancel of getScheduledCleanups()) {
        cancel();
      }

      await vi.advanceTimersByTimeAsync(20_000);
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
    });
  });
});
