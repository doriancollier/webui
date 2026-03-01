import { describe, it, expect } from 'vitest';
import { extractPayloadContent } from '../payload-utils.js';

describe('extractPayloadContent', () => {
  it('returns string payload directly', () => {
    expect(extractPayloadContent('hello')).toBe('hello');
  });

  it('extracts content field from object', () => {
    expect(extractPayloadContent({ content: 'hello', other: 123 })).toBe('hello');
  });

  it('extracts text field from object when content is missing', () => {
    expect(extractPayloadContent({ text: 'hello', other: 123 })).toBe('hello');
  });

  it('prefers content over text', () => {
    expect(extractPayloadContent({ content: 'a', text: 'b' })).toBe('a');
  });

  it('falls back to JSON.stringify for other objects', () => {
    expect(extractPayloadContent({ foo: 'bar' })).toBe('{"foo":"bar"}');
  });

  it('handles null payload', () => {
    expect(extractPayloadContent(null)).toBe('null');
  });

  it('handles undefined payload', () => {
    expect(extractPayloadContent(undefined)).toBe(undefined);
  });

  it('handles unserializable payload (circular reference)', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(extractPayloadContent(obj)).toBe('[unserializable payload]');
  });

  it('handles number payload', () => {
    expect(extractPayloadContent(42)).toBe('42');
  });

  it('handles empty string payload', () => {
    expect(extractPayloadContent('')).toBe('');
  });

  it('handles object with non-string content field', () => {
    expect(extractPayloadContent({ content: 42 })).toBe('{"content":42}');
  });

  it('handles object with non-string text field', () => {
    expect(extractPayloadContent({ text: true })).toBe('{"text":true}');
  });

  it('handles array payload', () => {
    expect(extractPayloadContent([1, 2, 3])).toBe('[1,2,3]');
  });

  it('handles deeply nested object without top-level content', () => {
    const payload = { nested: { deep: { content: 'found' } } };
    // Should NOT find nested content — only checks top-level
    expect(extractPayloadContent(payload)).toBe(JSON.stringify(payload));
  });

  it('handles boolean payload', () => {
    expect(extractPayloadContent(true)).toBe('true');
  });
});
