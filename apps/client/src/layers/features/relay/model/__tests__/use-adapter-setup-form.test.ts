import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  unflattenConfig,
  initializeValues,
  generateDefaultId,
  useAdapterSetupForm,
} from '../use-adapter-setup-form';
import type { AdapterManifest, CatalogInstance } from '@dorkos/shared/relay-schemas';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseManifest: AdapterManifest = {
  type: 'telegram',
  displayName: 'Telegram',
  description: 'Telegram bot adapter',
  category: 'messaging',
  builtin: true,
  multiInstance: true,
  configFields: [
    { key: 'token', label: 'Bot Token', type: 'password', required: true },
    { key: 'channel', label: 'Channel', type: 'text', required: true, default: '#general' },
    { key: 'verbose', label: 'Verbose', type: 'boolean', required: false },
    { key: 'timeout', label: 'Timeout', type: 'number', required: false },
  ],
};

const nestedManifest: AdapterManifest = {
  ...baseManifest,
  configFields: [
    { key: 'inbound.subject', label: 'Inbound Subject', type: 'text', required: true },
    { key: 'outbound.topic', label: 'Outbound Topic', type: 'text', required: true },
    { key: 'simple', label: 'Simple', type: 'text', required: false, default: 'val' },
  ],
};

const manifestWithSteps: AdapterManifest = {
  ...baseManifest,
  setupSteps: [
    { stepId: 'auth', title: 'Authentication', fields: ['token'] },
    { stepId: 'settings', title: 'Settings', fields: ['channel', 'timeout'] },
  ],
};

const existingInstance: CatalogInstance & { config?: Record<string, unknown> } = {
  id: 'telegram-1',
  enabled: true,
  status: {
    id: 'telegram-1',
    type: 'telegram',
    displayName: 'Telegram',
    state: 'connected',
    messageCount: { inbound: 0, outbound: 0 },
    errorCount: 0,
  },
  config: { token: 'secret-token', channel: '#dev', label: 'My Bot' },
};

// ---------------------------------------------------------------------------
// unflattenConfig
// ---------------------------------------------------------------------------

describe('unflattenConfig', () => {
  it('converts flat dot-notation keys to nested objects', () => {
    const flat = {
      'inbound.subject': 'x',
      'inbound.queue': 'q1',
      'outbound.topic': 'y',
      simple: 'value',
    };
    expect(unflattenConfig(flat)).toEqual({
      inbound: { subject: 'x', queue: 'q1' },
      outbound: { topic: 'y' },
      simple: 'value',
    });
  });

  it('handles deeply nested keys', () => {
    expect(unflattenConfig({ 'a.b.c': 42 })).toEqual({ a: { b: { c: 42 } } });
  });

  it('returns empty object for empty input', () => {
    expect(unflattenConfig({})).toEqual({});
  });

  it('overwrites non-object intermediate values', () => {
    // If 'a' was set to a primitive first, then 'a.b' needs to create a sub-object
    const flat = { a: 'primitive', 'a.b': 'nested' };
    const result = unflattenConfig(flat);
    expect(result.a).toEqual({ b: 'nested' });
  });
});

// ---------------------------------------------------------------------------
// initializeValues
// ---------------------------------------------------------------------------

describe('initializeValues', () => {
  it('initializes with defaults when no existing config', () => {
    const values = initializeValues(baseManifest);
    expect(values).toEqual({
      token: '',
      channel: '#general',
      verbose: false,
      timeout: '',
    });
  });

  it('uses existing config values for non-password fields', () => {
    const values = initializeValues(baseManifest, { channel: '#support', timeout: 30 });
    expect(values.channel).toBe('#support');
    expect(values.timeout).toBe(30);
  });

  it('uses sentinel for password fields when existing config has a value', () => {
    const values = initializeValues(baseManifest, { token: 'real-secret' });
    expect(values.token).toBe('***');
  });

  it('uses default for password fields when no existing config', () => {
    const values = initializeValues(baseManifest);
    expect(values.token).toBe('');
  });

  it('handles nested config keys via getNestedValue', () => {
    const values = initializeValues(nestedManifest, {
      inbound: { subject: 'my-subject' },
      outbound: { topic: 'my-topic' },
    });
    expect(values['inbound.subject']).toBe('my-subject');
    expect(values['outbound.topic']).toBe('my-topic');
  });

  it('falls back to boolean false for boolean fields without defaults', () => {
    const values = initializeValues(baseManifest);
    expect(values.verbose).toBe(false);
  });

  it('falls back to empty string for text/number fields without defaults', () => {
    const values = initializeValues(baseManifest);
    expect(values.timeout).toBe('');
  });
});

// ---------------------------------------------------------------------------
// generateDefaultId
// ---------------------------------------------------------------------------

describe('generateDefaultId', () => {
  it('returns the manifest type when no collisions', () => {
    expect(generateDefaultId(baseManifest)).toBe('telegram');
  });

  it('returns the manifest type when existing IDs do not collide', () => {
    expect(generateDefaultId(baseManifest, ['slack', 'webhook'])).toBe('telegram');
  });

  it('appends -2 when the base ID is taken', () => {
    expect(generateDefaultId(baseManifest, ['telegram'])).toBe('telegram-2');
  });

  it('appends -3 when -2 is also taken', () => {
    expect(generateDefaultId(baseManifest, ['telegram', 'telegram-2'])).toBe('telegram-3');
  });

  it('finds the first available slot', () => {
    expect(
      generateDefaultId(baseManifest, ['telegram', 'telegram-2', 'telegram-3', 'telegram-4'])
    ).toBe('telegram-5');
  });
});

// ---------------------------------------------------------------------------
// useAdapterSetupForm hook
// ---------------------------------------------------------------------------

describe('useAdapterSetupForm', () => {
  it('initializes adapterId from manifest type when no existing instance', () => {
    const { result } = renderHook(() => useAdapterSetupForm(baseManifest));
    expect(result.current.adapterId).toBe('telegram');
  });

  it('initializes adapterId from existing instance when provided', () => {
    const { result } = renderHook(() => useAdapterSetupForm(baseManifest, existingInstance));
    expect(result.current.adapterId).toBe('telegram-1');
  });

  it('generates non-colliding ID when existing IDs provided', () => {
    const { result } = renderHook(() =>
      useAdapterSetupForm(baseManifest, undefined, ['telegram', 'telegram-2'])
    );
    expect(result.current.adapterId).toBe('telegram-3');
  });

  it('initializes label from existing config', () => {
    const { result } = renderHook(() => useAdapterSetupForm(baseManifest, existingInstance));
    expect(result.current.label).toBe('My Bot');
  });

  it('initializes label as empty string when no existing config', () => {
    const { result } = renderHook(() => useAdapterSetupForm(baseManifest));
    expect(result.current.label).toBe('');
  });

  it('updates label via setLabel', () => {
    const { result } = renderHook(() => useAdapterSetupForm(baseManifest));
    act(() => {
      result.current.setLabel('New Label');
    });
    expect(result.current.label).toBe('New Label');
  });

  it('handleFieldChange updates values and clears field error', () => {
    const { result } = renderHook(() => useAdapterSetupForm(baseManifest));

    // First trigger a validation error
    act(() => {
      result.current.validate(baseManifest.configFields);
    });
    expect(result.current.errors.token).toBeDefined();

    // Then change the field — error should clear
    act(() => {
      result.current.handleFieldChange('token', 'new-token');
    });
    expect(result.current.values.token).toBe('new-token');
    expect(result.current.errors.token).toBeUndefined();
  });

  it('validate returns false when required fields are empty', () => {
    const { result } = renderHook(() => useAdapterSetupForm(baseManifest));

    let valid: boolean;
    act(() => {
      valid = result.current.validate(baseManifest.configFields);
    });
    expect(valid!).toBe(false);
    expect(result.current.errors.token).toBe('Bot Token is required');
  });

  it('validate returns true when all required fields are filled', () => {
    const { result } = renderHook(() => useAdapterSetupForm(baseManifest));

    act(() => {
      result.current.handleFieldChange('token', 'my-token');
      result.current.handleFieldChange('channel', '#general');
    });

    let valid: boolean;
    act(() => {
      valid = result.current.validate(baseManifest.configFields);
    });
    expect(valid!).toBe(true);
    expect(Object.keys(result.current.errors)).toHaveLength(0);
  });

  it('unflattenConfig method returns unflattened values', () => {
    const { result } = renderHook(() => useAdapterSetupForm(nestedManifest));
    const config = result.current.unflattenConfig();
    expect(config).toEqual({
      inbound: { subject: '' },
      outbound: { topic: '' },
      simple: 'val',
    });
  });

  it('reset restores initial values', () => {
    const { result } = renderHook(() => useAdapterSetupForm(baseManifest, existingInstance));

    // Change some values
    act(() => {
      result.current.handleFieldChange('channel', '#changed');
      result.current.setLabel('Changed Label');
    });
    expect(result.current.values.channel).toBe('#changed');
    expect(result.current.label).toBe('Changed Label');

    // Reset
    act(() => {
      result.current.reset();
    });
    expect(result.current.values.channel).toBe('#dev');
    expect(result.current.label).toBe('My Bot');
  });

  // -------------------------------------------------------------------------
  // Setup steps
  // -------------------------------------------------------------------------

  it('returns all config fields when no setup steps defined', () => {
    const { result } = renderHook(() => useAdapterSetupForm(baseManifest));
    expect(result.current.visibleFields).toHaveLength(baseManifest.configFields.length);
    expect(result.current.hasSetupSteps).toBeFalsy();
  });

  it('filters visible fields by current setup step', () => {
    const { result } = renderHook(() => useAdapterSetupForm(manifestWithSteps));
    expect(result.current.hasSetupSteps).toBe(true);

    // Step 0: Authentication — only 'token'
    expect(result.current.visibleFields).toHaveLength(1);
    expect(result.current.visibleFields[0].key).toBe('token');

    // Advance to step 1
    act(() => {
      result.current.setSetupStepIndex(1);
    });

    // Step 1: Settings — 'channel' and 'timeout'
    expect(result.current.visibleFields).toHaveLength(2);
    expect(result.current.visibleFields.map((f) => f.key)).toEqual(['channel', 'timeout']);
  });

  it('tracks botUsername state', () => {
    const { result } = renderHook(() => useAdapterSetupForm(baseManifest));
    expect(result.current.botUsername).toBe('');

    act(() => {
      result.current.setBotUsername('mybot');
    });
    expect(result.current.botUsername).toBe('mybot');
  });
});
