import { describe, it, expect } from 'vitest';
import { resolveAgentVisual } from '../resolve-agent-visual';
import { hashToHslColor, hashToEmoji } from '../favicon-utils';

describe('resolveAgentVisual', () => {
  it('uses color and icon overrides when present', () => {
    const result = resolveAgentVisual({ id: 'test-id', color: '#6366f1', icon: '🤖' });
    expect(result.color).toBe('#6366f1');
    expect(result.emoji).toBe('🤖');
  });

  it('hashes from id when no overrides are set', () => {
    const result = resolveAgentVisual({ id: 'test-id' });
    expect(result.color).toBe(hashToHslColor('test-id'));
    expect(result.emoji).toBe(hashToEmoji('test-id'));
  });

  it('handles partial overrides — color set, icon not', () => {
    const result = resolveAgentVisual({ id: 'test-id', color: '#ff0000' });
    expect(result.color).toBe('#ff0000');
    expect(result.emoji).toBe(hashToEmoji('test-id'));
  });

  it('handles partial overrides — icon set, color not', () => {
    const result = resolveAgentVisual({ id: 'test-id', icon: '🎯' });
    expect(result.color).toBe(hashToHslColor('test-id'));
    expect(result.emoji).toBe('🎯');
  });

  it('treats null overrides same as undefined (defensive against runtime data)', () => {
    const result = resolveAgentVisual({ id: 'test-id', color: null, icon: null });
    expect(result.color).toBe(hashToHslColor('test-id'));
    expect(result.emoji).toBe(hashToEmoji('test-id'));
  });

  it('produces same output for same id', () => {
    const a = resolveAgentVisual({ id: 'stable-id' });
    const b = resolveAgentVisual({ id: 'stable-id' });
    expect(a).toEqual(b);
  });
});
