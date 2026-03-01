import { describe, it, expect } from 'vitest';
import { deepMerge } from '../config.js';

describe('deepMerge', () => {
  describe('prototype pollution prevention', () => {
    it('filters out __proto__ keys', () => {
      const target = { a: 1 };
      const source = JSON.parse('{"__proto__": {"polluted": true}, "b": 2}');

      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 2 });
      expect(result).not.toHaveProperty('__proto__.polluted');
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });

    it('filters out constructor keys', () => {
      const target = { a: 1 };
      const source = { constructor: { polluted: true }, b: 2 } as Record<string, unknown>;

      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 2 });
      expect(result).not.toHaveProperty('constructor');
    });

    it('filters out prototype keys', () => {
      const target = { a: 1 };
      const source = { prototype: { polluted: true }, b: 2 } as Record<string, unknown>;

      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 2 });
      expect(result).not.toHaveProperty('prototype');
    });

    it('filters dangerous keys in nested objects', () => {
      const target = { nested: { safe: 1 } };
      const source = {
        nested: JSON.parse('{"__proto__": {"polluted": true}, "also_safe": 2}'),
      };

      const result = deepMerge(target, source);

      expect(result).toEqual({ nested: { safe: 1, also_safe: 2 } });
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });
  });

  describe('normal merge behavior', () => {
    it('merges flat keys from source into target', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };

      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('recursively merges nested objects', () => {
      const target = { server: { port: 4242, host: 'localhost' } };
      const source = { server: { port: 8080 } };

      const result = deepMerge(target, source);

      expect(result).toEqual({ server: { port: 8080, host: 'localhost' } });
    });

    it('replaces arrays instead of merging them', () => {
      const target = { tags: ['a', 'b'] };
      const source = { tags: ['c'] };

      const result = deepMerge(target, source);

      expect(result).toEqual({ tags: ['c'] });
    });

    it('allows null values from source to override target', () => {
      const target = { a: 'value' };
      const source = { a: null };

      const result = deepMerge(target, source as Record<string, unknown>);

      expect(result).toEqual({ a: null });
    });

    it('does not mutate the target object', () => {
      const target = { a: 1, nested: { b: 2 } };
      const source = { a: 99, nested: { c: 3 } };

      const result = deepMerge(target, source);

      expect(target).toEqual({ a: 1, nested: { b: 2 } });
      expect(result).toEqual({ a: 99, nested: { b: 2, c: 3 } });
    });
  });
});
