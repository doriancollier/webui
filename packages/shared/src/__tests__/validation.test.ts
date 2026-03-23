import { describe, it, expect } from 'vitest';
import { AGENT_NAME_REGEX, validateAgentName } from '../validation.js';
import { CreateAgentOptionsSchema } from '../mesh-schemas.js';

describe('AGENT_NAME_REGEX', () => {
  it('matches a single lowercase letter', () => {
    expect(AGENT_NAME_REGEX.test('a')).toBe(true);
  });

  it('matches a simple kebab-case name', () => {
    expect(AGENT_NAME_REGEX.test('my-agent')).toBe(true);
  });

  it('matches a name with trailing digits', () => {
    expect(AGENT_NAME_REGEX.test('agent-123')).toBe(true);
  });

  it('matches a 64-character name', () => {
    // a + 62 chars + z = 64 chars
    const name = 'a' + 'b'.repeat(62) + 'z';
    expect(name).toHaveLength(64);
    expect(AGENT_NAME_REGEX.test(name)).toBe(true);
  });

  it('rejects a name starting with a digit', () => {
    expect(AGENT_NAME_REGEX.test('0starts-with-number')).toBe(false);
  });

  it('rejects a name starting with a hyphen', () => {
    expect(AGENT_NAME_REGEX.test('-starts-with-dash')).toBe(false);
  });

  it('rejects uppercase letters', () => {
    expect(AGENT_NAME_REGEX.test('My-Agent')).toBe(false);
  });

  it('rejects underscores', () => {
    expect(AGENT_NAME_REGEX.test('agent_name')).toBe(false);
  });

  it('rejects path traversal characters', () => {
    expect(AGENT_NAME_REGEX.test('../traversal')).toBe(false);
  });

  it('rejects hidden file names', () => {
    expect(AGENT_NAME_REGEX.test('.hidden')).toBe(false);
  });
});

describe('validateAgentName', () => {
  it('returns valid for a single letter', () => {
    expect(validateAgentName('a')).toEqual({ valid: true });
  });

  it('returns valid for a kebab-case name', () => {
    expect(validateAgentName('my-agent')).toEqual({ valid: true });
  });

  it('returns valid for a name with digits', () => {
    expect(validateAgentName('agent-123')).toEqual({ valid: true });
  });

  it('returns valid for a 64-character name', () => {
    const name = 'a' + 'b'.repeat(62) + 'z';
    expect(validateAgentName(name)).toEqual({ valid: true });
  });

  it('returns error for empty string', () => {
    const result = validateAgentName('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Name is required');
  });

  it('returns error for uppercase letters', () => {
    const result = validateAgentName('My Agent');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Lowercase');
  });

  it('returns error for underscores', () => {
    const result = validateAgentName('agent_name');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Lowercase');
  });

  it('returns error for path traversal', () => {
    const result = validateAgentName('../traversal');
    expect(result.valid).toBe(false);
  });

  it('returns error for hidden file names', () => {
    const result = validateAgentName('.hidden');
    expect(result.valid).toBe(false);
  });

  it('returns error for names starting with a dash', () => {
    const result = validateAgentName('-starts-with-dash');
    expect(result.valid).toBe(false);
  });

  it('returns error for names starting with a number', () => {
    const result = validateAgentName('0starts-with-number');
    expect(result.valid).toBe(false);
  });

  it('returns error for names exceeding 64 characters', () => {
    const name = 'a' + 'b'.repeat(64);
    expect(name.length).toBeGreaterThan(64);
    const result = validateAgentName(name);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Name must be 64 characters or less');
  });
});

describe('CreateAgentOptionsSchema', () => {
  it('accepts a minimal valid object with just a name', () => {
    const result = CreateAgentOptionsSchema.parse({ name: 'my-agent' });
    expect(result.name).toBe('my-agent');
    expect(result.directory).toBeUndefined();
    expect(result.template).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.runtime).toBeUndefined();
    expect(result.traits).toBeUndefined();
    expect(result.conventions).toBeUndefined();
  });

  it('rejects an invalid name', () => {
    expect(() => CreateAgentOptionsSchema.parse({ name: 'My Agent' })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => CreateAgentOptionsSchema.parse({ name: '' })).toThrow();
  });

  it('accepts all optional fields', () => {
    const result = CreateAgentOptionsSchema.parse({
      name: 'my-agent',
      directory: '/home/user/project',
      template: 'backend',
      description: 'A test agent',
      runtime: 'claude-code',
      traits: { tone: 4, autonomy: 2 },
      conventions: { soul: true, nope: false, dorkosKnowledge: true },
    });
    expect(result.name).toBe('my-agent');
    expect(result.directory).toBe('/home/user/project');
    expect(result.template).toBe('backend');
    expect(result.description).toBe('A test agent');
    expect(result.runtime).toBe('claude-code');
    expect(result.traits?.tone).toBe(4);
    expect(result.conventions?.soul).toBe(true);
    expect(result.conventions?.nope).toBe(false);
  });

  it('rejects a name with path traversal characters', () => {
    expect(() => CreateAgentOptionsSchema.parse({ name: '../evil' })).toThrow();
  });

  it('accepts a single-letter name', () => {
    const result = CreateAgentOptionsSchema.parse({ name: 'a' });
    expect(result.name).toBe('a');
  });
});
