import { describe, it, expect, vi } from 'vitest';
import type { McpToolDeps } from '../mcp-tool-server.js';
import {
  handlePing,
  handleGetServerInfo,
  createGetSessionCountHandler,
  createDorkOsToolServer,
} from '../mcp-tool-server.js';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  createSdkMcpServer: vi.fn((config: Record<string, unknown>) => config),
  tool: vi.fn(
    (
      name: string,
      desc: string,
      schema: Record<string, unknown>,
      handler: (...args: unknown[]) => unknown
    ) => ({
      name,
      description: desc,
      schema,
      handler,
    })
  ),
}));

/** Passthrough shape returned by mocked createSdkMcpServer */
interface MockServer {
  name: string;
  version: string;
  tools: { name: string; description: string }[];
}

/** Create a mock McpToolDeps with a stubbed transcript reader */
function makeMockDeps(
  overrides: { listSessions?: ReturnType<typeof vi.fn> } = {}
): McpToolDeps {
  return {
    transcriptReader: {
      listSessions: overrides.listSessions ?? vi.fn().mockResolvedValue([]),
    } as unknown as McpToolDeps['transcriptReader'],
    defaultCwd: '/test/cwd',
  };
}

describe('MCP Tool Handlers', () => {
  describe('handlePing', () => {
    it('returns pong status with timestamp', async () => {
      const result = await handlePing();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe('pong');
      expect(parsed.server).toBe('dorkos');
      expect(parsed.timestamp).toBeDefined();
    });

    it('returns valid ISO timestamp', async () => {
      const result = await handlePing();
      const parsed = JSON.parse(result.content[0].text);
      expect(() => new Date(parsed.timestamp)).not.toThrow();
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });

    it('returns single content block with type text', async () => {
      const result = await handlePing();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleGetServerInfo', () => {
    it('returns server info without uptime by default', async () => {
      const result = await handleGetServerInfo({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.product).toBe('DorkOS');
      expect(parsed.port).toBeDefined();
      expect(parsed.uptime_seconds).toBeUndefined();
    });

    it('includes uptime when requested', async () => {
      const result = await handleGetServerInfo({ include_uptime: true });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.uptime_seconds).toBeTypeOf('number');
      expect(parsed.uptime_seconds).toBeGreaterThanOrEqual(0);
    });

    it('uses DORKOS_PORT env var when set', async () => {
      const original = process.env.DORKOS_PORT;
      process.env.DORKOS_PORT = '9999';
      try {
        const result = await handleGetServerInfo({});
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.port).toBe('9999');
      } finally {
        if (original !== undefined) process.env.DORKOS_PORT = original;
        else delete process.env.DORKOS_PORT;
      }
    });

    it('uses DORKOS_VERSION env var when set', async () => {
      const original = process.env.DORKOS_VERSION;
      process.env.DORKOS_VERSION = '2.0.0';
      try {
        const result = await handleGetServerInfo({});
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.version).toBe('2.0.0');
      } finally {
        if (original !== undefined) process.env.DORKOS_VERSION = original;
        else delete process.env.DORKOS_VERSION;
      }
    });

    it('defaults port to 4242 when env var unset', async () => {
      const original = process.env.DORKOS_PORT;
      delete process.env.DORKOS_PORT;
      try {
        const result = await handleGetServerInfo({});
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.port).toBe('4242');
      } finally {
        if (original !== undefined) process.env.DORKOS_PORT = original;
      }
    });

    it('defaults version to development when env var unset', async () => {
      const original = process.env.DORKOS_VERSION;
      delete process.env.DORKOS_VERSION;
      try {
        const result = await handleGetServerInfo({});
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.version).toBe('development');
      } finally {
        if (original !== undefined) process.env.DORKOS_VERSION = original;
      }
    });
  });

  describe('createGetSessionCountHandler', () => {
    it('returns session count from transcript reader', async () => {
      const listSessions = vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }, { id: 's3' }]);
      const handler = createGetSessionCountHandler(makeMockDeps({ listSessions }));
      const result = await handler();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(3);
      expect(parsed.cwd).toBe('/test/cwd');
      expect(listSessions).toHaveBeenCalledWith('/test/cwd');
    });

    it('returns isError when transcript reader fails', async () => {
      const listSessions = vi.fn().mockRejectedValue(new Error('ENOENT'));
      const handler = createGetSessionCountHandler(makeMockDeps({ listSessions }));
      const result = await handler();
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('ENOENT');
    });

    it('returns zero for empty session directory', async () => {
      const handler = createGetSessionCountHandler(makeMockDeps());
      const result = await handler();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(0);
    });

    it('handles non-Error exceptions gracefully', async () => {
      const listSessions = vi.fn().mockRejectedValue('string error');
      const handler = createGetSessionCountHandler(makeMockDeps({ listSessions }));
      const result = await handler();
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Failed to list sessions');
    });
  });

  describe('createDorkOsToolServer', () => {
    it('creates server with name dorkos and version 1.0.0', () => {
      const server = createDorkOsToolServer(makeMockDeps()) as unknown as MockServer;
      expect(server).toBeDefined();
      expect(server.name).toBe('dorkos');
      expect(server.version).toBe('1.0.0');
    });

    it('registers 8 tools (3 core + 5 pulse)', () => {
      const server = createDorkOsToolServer(makeMockDeps()) as unknown as MockServer;
      expect(server.tools).toHaveLength(8);
    });

    it('registers tools with correct names', () => {
      const server = createDorkOsToolServer(makeMockDeps()) as unknown as MockServer;
      const toolNames = server.tools.map((t) => t.name);
      expect(toolNames).toContain('ping');
      expect(toolNames).toContain('get_server_info');
      expect(toolNames).toContain('get_session_count');
      expect(toolNames).toContain('list_schedules');
      expect(toolNames).toContain('create_schedule');
      expect(toolNames).toContain('update_schedule');
      expect(toolNames).toContain('delete_schedule');
      expect(toolNames).toContain('get_run_history');
    });
  });
});
