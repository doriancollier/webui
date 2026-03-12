/**
 * Named scenario keys for the DorkOS test simulation infrastructure.
 * Used by FakeAgentRuntime (Vitest) and TestModeRuntime (browser) to load
 * pre-defined StreamEvent sequences without string coordination.
 *
 * @module test-utils/test-scenarios
 */
export const TestScenario = {
  /** Simple text response: session_status → text_delta → done */
  SimpleText: 'simple-text',
  /** Response with a single Bash tool call */
  ToolCall: 'tool-call',
  /** TodoWrite tool call creating 3 tasks, then a text response */
  TodoWrite: 'todo-write',
  /** Error result from the SDK */
  Error: 'error',
  /** Multi-turn: first call returns text, second returns a tool call */
  MultiTurn: 'multi-turn',
} as const;

export type TestScenarioKey = (typeof TestScenario)[keyof typeof TestScenario];
