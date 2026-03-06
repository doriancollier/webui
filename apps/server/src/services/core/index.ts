/**
 * Core services — agent orchestration, context building, configuration,
 * SSE streaming, MCP tools, and infrastructure utilities.
 *
 * @module services/core
 */
export { ClaudeCodeRuntime as AgentManager } from '../runtimes/claude-code/claude-code-runtime.js';
export type { AgentSession, ToolState } from '../runtimes/claude-code/agent-types.js';
export { createToolState } from '../runtimes/claude-code/agent-types.js';
export { buildSystemPromptAppend } from '../runtimes/claude-code/context-builder.js';
export { mapSdkMessage } from '../runtimes/claude-code/sdk-event-mapper.js';
export { CommandRegistryService } from '../runtimes/claude-code/command-registry.js';
export { configManager, initConfigManager } from './config-manager.js';
export { fileLister } from './file-lister.js';
export { getGitStatus, parsePorcelainOutput } from './git-status.js';
export {
  handleAskUserQuestion,
  createCanUseTool,
  handleToolApproval,
} from '../runtimes/claude-code/interactive-handlers.js';
export type { PendingInteraction, InteractiveSession } from '../runtimes/claude-code/interactive-handlers.js';
export {
  handlePing,
  handleGetServerInfo,
  createGetSessionCountHandler,
  createListSchedulesHandler,
  createCreateScheduleHandler,
  createUpdateScheduleHandler,
  createDeleteScheduleHandler,
  createGetRunHistoryHandler,
  createRelaySendHandler,
  createRelayInboxHandler,
  createRelayListEndpointsHandler,
  createRelayRegisterEndpointHandler,
  createBindingListHandler,
  createBindingCreateHandler,
  createBindingDeleteHandler,
  createDorkOsToolServer,
} from '../runtimes/claude-code/mcp-tools/index.js';
export type { McpToolDeps } from '../runtimes/claude-code/mcp-tools/index.js';
export { generateOpenAPISpec } from './openapi-registry.js';
export { initSSEStream, sendSSEEvent, endSSEStream } from './stream-adapter.js';
export { TunnelManager, tunnelManager } from './tunnel-manager.js';
export type { TunnelConfig } from './tunnel-manager.js';
export type { TunnelStatus } from '@dorkos/shared/types';
export { getLatestVersion, resetCache } from './update-checker.js';
