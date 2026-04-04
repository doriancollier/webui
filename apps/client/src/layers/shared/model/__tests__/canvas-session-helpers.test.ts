import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readCanvasSession, writeCanvasSession } from '../app-store/app-store-helpers';
import { STORAGE_KEYS, MAX_CANVAS_SESSIONS } from '@/layers/shared/lib';
import type { CanvasSessionEntry } from '../app-store/app-store-helpers';

describe('readCanvasSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no data exists in localStorage', () => {
    expect(readCanvasSession('session-1')).toBeNull();
  });

  it('returns null when session ID is not in the map', () => {
    const map = { 'other-session': { open: true, content: null, accessedAt: 1000 } };
    localStorage.setItem(STORAGE_KEYS.CANVAS_SESSIONS, JSON.stringify(map));
    expect(readCanvasSession('session-1')).toBeNull();
  });

  it('returns the entry when session ID exists', () => {
    const entry: CanvasSessionEntry = { open: true, content: null, accessedAt: 1000 };
    const map = { 'session-1': entry };
    localStorage.setItem(STORAGE_KEYS.CANVAS_SESSIONS, JSON.stringify(map));

    const result = readCanvasSession('session-1');
    expect(result).toEqual(entry);
  });

  it('returns entry with content when content is stored', () => {
    const entry: CanvasSessionEntry = {
      open: true,
      content: { type: 'markdown', content: '# Hello', title: 'Test' },
      accessedAt: 1000,
    };
    const map = { 'session-1': entry };
    localStorage.setItem(STORAGE_KEYS.CANVAS_SESSIONS, JSON.stringify(map));

    const result = readCanvasSession('session-1');
    expect(result).toEqual(entry);
    expect(result?.content?.type).toBe('markdown');
  });

  it('returns null when localStorage contains corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEYS.CANVAS_SESSIONS, 'not-valid-json{{{');
    expect(readCanvasSession('session-1')).toBeNull();
  });

  it('returns null when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readCanvasSession('session-1')).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('writeCanvasSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes a new entry to localStorage', () => {
    const entry: CanvasSessionEntry = { open: true, content: null, accessedAt: 0 };
    writeCanvasSession('session-1', entry);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.CANVAS_SESSIONS)!);
    expect(stored['session-1']).toBeDefined();
    expect(stored['session-1'].open).toBe(true);
    expect(stored['session-1'].accessedAt).toBeGreaterThan(0);
  });

  it('updates an existing entry', () => {
    writeCanvasSession('session-1', { open: true, content: null, accessedAt: 0 });
    writeCanvasSession('session-1', { open: false, content: null, accessedAt: 0 });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.CANVAS_SESSIONS)!);
    expect(stored['session-1'].open).toBe(false);
  });

  it('preserves other sessions when writing', () => {
    writeCanvasSession('session-1', { open: true, content: null, accessedAt: 0 });
    writeCanvasSession('session-2', { open: false, content: null, accessedAt: 0 });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.CANVAS_SESSIONS)!);
    expect(stored['session-1']).toBeDefined();
    expect(stored['session-2']).toBeDefined();
  });

  it('evicts oldest entries when exceeding MAX_CANVAS_SESSIONS', () => {
    // Pre-populate MAX_CANVAS_SESSIONS entries with known timestamps
    const map: Record<string, CanvasSessionEntry> = {};
    for (let i = 0; i < MAX_CANVAS_SESSIONS; i++) {
      map[`session-${i}`] = { open: false, content: null, accessedAt: i };
    }
    localStorage.setItem(STORAGE_KEYS.CANVAS_SESSIONS, JSON.stringify(map));

    // Write one more — should evict session-0 (oldest accessedAt = 0)
    writeCanvasSession('session-new', { open: true, content: null, accessedAt: 0 });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.CANVAS_SESSIONS)!);
    const keys = Object.keys(stored);
    expect(keys.length).toBe(MAX_CANVAS_SESSIONS);
    expect(stored['session-0']).toBeUndefined();
    expect(stored['session-new']).toBeDefined();
  });

  it('does not throw when localStorage is full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    expect(() =>
      writeCanvasSession('session-1', { open: true, content: null, accessedAt: 0 })
    ).not.toThrow();
    vi.restoreAllMocks();
  });
});
