/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { AssistantMessageContent } from '../AssistantMessageContent';
import type { ChatMessage } from '../../../model/use-chat-session';

// Mock StreamingText to simplify rendering
vi.mock('../../StreamingText', () => ({
  StreamingText: ({ content }: { content: string }) => (
    <span data-testid="streaming-text">{content}</span>
  ),
}));

// Mock ToolCallCard
vi.mock('../../ToolCallCard', () => ({
  ToolCallCard: ({ toolCall }: { toolCall: { toolName: string } }) => (
    <div data-testid="tool-call-card">{toolCall.toolName}</div>
  ),
}));

// Mock ToolApproval
vi.mock('../../ToolApproval', () => ({
  ToolApproval: ({ toolName }: { toolName: string }) => (
    <div data-testid="tool-approval">{toolName}</div>
  ),
}));

// Mock QuestionPrompt
vi.mock('../../QuestionPrompt', () => ({
  QuestionPrompt: () => <div data-testid="question-prompt" />,
}));

// Mock MessageContext
vi.mock('../MessageContext', () => ({
  useMessageContext: () => ({
    sessionId: 'test-session',
    isStreaming: false,
    activeToolCallId: null,
    onToolRef: undefined,
    focusedOptionIndex: -1,
    onToolDecided: undefined,
  }),
}));

// Mock useAppStore
vi.mock('@/layers/shared/model', () => ({
  useAppStore: () => ({ expandToolCalls: false, autoHideToolCalls: false }),
}));

function makeMessage(parts: ChatMessage['parts']): ChatMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: '',
    parts: parts ?? [],
    timestamp: new Date().toISOString(),
  };
}

describe('AssistantMessageContent — React key stability', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Catch any React reconciliation warnings ("same key" errors)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('renders multi-block parts (text, tool_call, text) without key warnings', () => {
    // Purpose: verify stable _partId keys prevent collisions when parts array
    // has mixed types — the exact shape that triggered the key storm in production.
    const parts = [
      { type: 'text' as const, text: 'First block', _partId: 'text-part-0' },
      {
        type: 'tool_call' as const,
        toolCallId: 'tc-1',
        toolName: 'Read',
        input: '{}',
        status: 'complete' as const,
      },
      { type: 'text' as const, text: 'Second block', _partId: 'text-part-2' },
    ];

    render(<AssistantMessageContent message={makeMessage(parts)} />);

    const keyWarnings = consoleErrorSpy.mock.calls
      .flat()
      .filter((arg) => typeof arg === 'string' && arg.includes('same key'));
    expect(keyWarnings).toHaveLength(0);
  });

  it('renders a single text part with _partId without key warnings', () => {
    const parts = [{ type: 'text' as const, text: 'Hello world', _partId: 'text-part-0' }];

    render(<AssistantMessageContent message={makeMessage(parts)} />);

    const keyWarnings = consoleErrorSpy.mock.calls
      .flat()
      .filter((arg) => typeof arg === 'string' && arg.includes('same key'));
    expect(keyWarnings).toHaveLength(0);
  });

  it('falls back to index key for history parts without _partId (no warnings)', () => {
    // Purpose: confirm history-loaded parts (no _partId) still render without
    // errors — the fallback key `text-${i}` is safe for static history.
    const parts = [{ type: 'text' as const, text: 'History message' }];

    render(<AssistantMessageContent message={makeMessage(parts)} />);

    const keyWarnings = consoleErrorSpy.mock.calls
      .flat()
      .filter((arg) => typeof arg === 'string' && arg.includes('same key'));
    expect(keyWarnings).toHaveLength(0);
  });
});
