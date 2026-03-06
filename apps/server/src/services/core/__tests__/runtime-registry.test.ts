import { describe, it, expect, beforeEach } from 'vitest';
import { RuntimeRegistry } from '../runtime-registry.js';
import type { AgentRuntime, RuntimeCapabilities } from '@dorkos/shared/agent-runtime';

// Minimal mock runtime for testing
function createMockRuntime(type: string, overrides?: Partial<RuntimeCapabilities>): AgentRuntime {
  return {
    type,
    ensureSession: () => {},
    hasSession: () => false,
    updateSession: () => true,
    sendMessage: async function* () {},
    approveTool: () => true,
    submitAnswers: () => true,
    listSessions: async () => [],
    getSession: async () => null,
    getMessageHistory: async () => [],
    getSessionTasks: async () => [],
    getSessionETag: async () => null,
    readFromOffset: async () => ({ content: '', newOffset: 0 }),
    watchSession: () => () => {},
    acquireLock: () => true,
    releaseLock: () => {},
    isLocked: () => false,
    getLockInfo: () => null,
    getSupportedModels: async () => [],
    getCapabilities: () => ({
      type,
      supportsPermissionModes: true,
      supportsToolApproval: true,
      supportsCostTracking: true,
      supportsResume: true,
      supportsMcp: true,
      supportsQuestionPrompt: true,
      ...overrides,
    }),
    getCommands: async () => ({ commands: [], lastScanned: new Date().toISOString() }),
    checkSessionHealth: () => {},
    getInternalSessionId: () => undefined,
  } as AgentRuntime;
}

describe('RuntimeRegistry', () => {
  let registry: RuntimeRegistry;

  beforeEach(() => {
    registry = new RuntimeRegistry();
  });

  describe('register and get', () => {
    it('registers and retrieves a runtime by type', () => {
      const runtime = createMockRuntime('claude-code');
      registry.register(runtime);
      expect(registry.get('claude-code')).toBe(runtime);
    });

    it('throws when getting an unregistered type', () => {
      expect(() => registry.get('nonexistent')).toThrow("Runtime 'nonexistent' not registered");
    });

    it('replaces existing registration for the same type', () => {
      const runtime1 = createMockRuntime('claude-code');
      const runtime2 = createMockRuntime('claude-code');
      registry.register(runtime1);
      registry.register(runtime2);
      expect(registry.get('claude-code')).toBe(runtime2);
    });
  });

  describe('getDefault', () => {
    it('defaults to claude-code', () => {
      const runtime = createMockRuntime('claude-code');
      registry.register(runtime);
      expect(registry.getDefault()).toBe(runtime);
    });

    it('throws when default type is not registered', () => {
      expect(() => registry.getDefault()).toThrow("Runtime 'claude-code' not registered");
    });
  });

  describe('setDefault', () => {
    it('changes the default runtime type', () => {
      const cc = createMockRuntime('claude-code');
      const oc = createMockRuntime('opencode');
      registry.register(cc);
      registry.register(oc);
      registry.setDefault('opencode');
      expect(registry.getDefault()).toBe(oc);
    });

    it('throws when setting default to unregistered type', () => {
      expect(() => registry.setDefault('nonexistent')).toThrow(
        "Runtime 'nonexistent' not registered"
      );
    });
  });

  describe('resolveForAgent', () => {
    it('returns agent-specific runtime when meshCore provides it', () => {
      const cc = createMockRuntime('claude-code');
      const oc = createMockRuntime('opencode');
      registry.register(cc);
      registry.register(oc);
      const meshCore = { getAgent: () => ({ runtime: 'opencode' }) };
      expect(registry.resolveForAgent('agent-1', meshCore)).toBe(oc);
    });

    it('falls back to default when agent has no runtime field', () => {
      const cc = createMockRuntime('claude-code');
      registry.register(cc);
      const meshCore = { getAgent: () => ({}) };
      expect(registry.resolveForAgent('agent-1', meshCore)).toBe(cc);
    });

    it('falls back to default when agent is not found', () => {
      const cc = createMockRuntime('claude-code');
      registry.register(cc);
      const meshCore = { getAgent: () => undefined };
      expect(registry.resolveForAgent('unknown', meshCore)).toBe(cc);
    });

    it('falls back to default when meshCore is undefined', () => {
      const cc = createMockRuntime('claude-code');
      registry.register(cc);
      expect(registry.resolveForAgent('agent-1')).toBe(cc);
    });

    it('falls back to default when agent runtime type is not registered', () => {
      const cc = createMockRuntime('claude-code');
      registry.register(cc);
      const meshCore = { getAgent: () => ({ runtime: 'aider' }) };
      expect(registry.resolveForAgent('agent-1', meshCore)).toBe(cc);
    });
  });

  describe('listRuntimes', () => {
    it('returns empty array when no runtimes registered', () => {
      expect(registry.listRuntimes()).toEqual([]);
    });

    it('returns all registered runtimes', () => {
      const cc = createMockRuntime('claude-code');
      const oc = createMockRuntime('opencode');
      registry.register(cc);
      registry.register(oc);
      expect(registry.listRuntimes()).toHaveLength(2);
      expect(registry.listRuntimes()).toContain(cc);
      expect(registry.listRuntimes()).toContain(oc);
    });
  });

  describe('getAllCapabilities', () => {
    it('returns capabilities keyed by type', () => {
      registry.register(createMockRuntime('claude-code', { supportsCostTracking: true }));
      registry.register(createMockRuntime('opencode', { supportsCostTracking: false }));
      const caps = registry.getAllCapabilities();
      expect(caps['claude-code'].supportsCostTracking).toBe(true);
      expect(caps['opencode'].supportsCostTracking).toBe(false);
    });

    it('returns empty object when no runtimes registered', () => {
      expect(registry.getAllCapabilities()).toEqual({});
    });
  });

  describe('has', () => {
    it('returns true for registered types', () => {
      registry.register(createMockRuntime('claude-code'));
      expect(registry.has('claude-code')).toBe(true);
    });

    it('returns false for unregistered types', () => {
      expect(registry.has('claude-code')).toBe(false);
    });
  });

  describe('getDefaultType', () => {
    it('returns claude-code as the initial default type', () => {
      expect(registry.getDefaultType()).toBe('claude-code');
    });

    it('returns the updated default type after setDefault', () => {
      registry.register(createMockRuntime('claude-code'));
      registry.register(createMockRuntime('opencode'));
      registry.setDefault('opencode');
      expect(registry.getDefaultType()).toBe('opencode');
    });
  });
});
