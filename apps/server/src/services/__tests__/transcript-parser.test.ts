import { describe, it, expect } from 'vitest';
import {
  stripRelayContext,
  parseTranscript,
  applyToolResult,
  buildCommandMessage,
} from '../runtimes/claude-code/transcript-parser.js';
import type { HistoryToolCall, ToolCallPart } from '@dorkos/shared/types';

describe('stripRelayContext', () => {
  it('returns original text when no relay_context prefix', () => {
    expect(stripRelayContext('Hello world')).toBe('Hello world');
  });

  it('returns user content after closing tag', () => {
    const text =
      '<relay_context>\nAgent-ID: abc\nSubject: test\n</relay_context>\n\nWrite a bubble sort';
    expect(stripRelayContext(text)).toBe('Write a bubble sort');
  });

  it('returns null for pure relay metadata (no content after closing tag)', () => {
    const text = '<relay_context>\nAgent-ID: abc\n</relay_context>';
    expect(stripRelayContext(text)).toBeNull();
  });

  it('returns null for malformed relay_context (no closing tag)', () => {
    const text = '<relay_context>\nAgent-ID: abc\nno closing tag';
    expect(stripRelayContext(text)).toBeNull();
  });

  it('handles multiple paragraphs of user content after closing tag', () => {
    const text =
      '<relay_context>\nAgent-ID: abc\n</relay_context>\n\nParagraph 1\n\nParagraph 2';
    expect(stripRelayContext(text)).toBe('Paragraph 1\n\nParagraph 2');
  });

  it('preserves command-like text after relay context', () => {
    const text = '<relay_context>\nAgent-ID: abc\n</relay_context>\n\n/help';
    expect(stripRelayContext(text)).toBe('/help');
  });
});

describe('parseTranscript relay context handling', () => {
  it('strips relay_context wrapper and preserves user content in history', () => {
    const lines = [
      JSON.stringify({
        type: 'user',
        message: {
          content:
            '<relay_context>\nAgent-ID: 9c99edf1\nSubject: relay.agent.test\n</relay_context>\n\nWrite a JavaScript bubble sort function with comments',
        },
        uuid: 'msg-1',
      }),
    ];
    const result = parseTranscript(lines);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Write a JavaScript bubble sort function with comments');
  });

  it('skips pure relay metadata with no user content', () => {
    const lines = [
      JSON.stringify({
        type: 'user',
        message: { content: '<relay_context>\nAgent-ID: abc\n</relay_context>' },
        uuid: 'msg-1',
      }),
    ];
    const result = parseTranscript(lines);
    expect(result).toHaveLength(0);
  });
});

describe('parseTranscript Skill tool_result suppression', () => {
  it('suppresses text blocks when tool_result is present in same message', () => {
    const lines = [
      // Assistant calls Skill tool
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Skill',
              input: { skill: 'test-skill', args: 'arg1' },
            },
          ],
        },
        uuid: 'msg-1',
      }),
      // User message with tool_result AND text blocks (SDK skill expansion)
      JSON.stringify({
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'tool-1', content: 'skill output' },
            { type: 'text', text: 'Internal SDK skill expansion prompt that should not appear' },
          ],
        },
        uuid: 'msg-2',
      }),
    ];
    const result = parseTranscript(lines);
    // Should have assistant message with tool call, but NO user message for the expansion text
    const userMessages = result.filter((m) => m.role === 'user');
    expect(userMessages).toHaveLength(0);
  });

  it('preserves Skill tool call card after tool_result suppression', () => {
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Skill',
              input: { skill: 'test-skill' },
            },
          ],
        },
        uuid: 'msg-1',
      }),
      JSON.stringify({
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'tool-1', content: 'skill output' },
            { type: 'text', text: 'expansion text' },
          ],
        },
        uuid: 'msg-2',
      }),
    ];
    const result = parseTranscript(lines);
    const assistantMsg = result.find((m) => m.role === 'assistant');
    expect(assistantMsg?.toolCalls).toBeDefined();
    expect(assistantMsg!.toolCalls![0].toolName).toBe('Skill');
    expect(assistantMsg!.toolCalls![0].result).toBe('skill output');
  });

  it('handles multiple tool_result blocks in single user message', () => {
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'tool-1', name: 'ToolA', input: {} },
            { type: 'tool_use', id: 'tool-2', name: 'ToolB', input: {} },
          ],
        },
        uuid: 'msg-1',
      }),
      JSON.stringify({
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'tool-1', content: 'result A' },
            { type: 'tool_result', tool_use_id: 'tool-2', content: 'result B' },
            { type: 'text', text: 'should be suppressed' },
          ],
        },
        uuid: 'msg-2',
      }),
    ];
    const result = parseTranscript(lines);
    const userMessages = result.filter((m) => m.role === 'user');
    expect(userMessages).toHaveLength(0);
  });
});

describe('applyToolResult', () => {
  it('sets result on HistoryToolCall', () => {
    const tc: HistoryToolCall = { toolCallId: 'id-1', toolName: 'BashTool', status: 'complete' };
    applyToolResult(tc, undefined, 'output text', undefined);
    expect(tc.result).toBe('output text');
  });

  it('sets result on ToolCallPart', () => {
    const tcPart: ToolCallPart = {
      type: 'tool_call',
      toolCallId: 'id-1',
      toolName: 'BashTool',
      status: 'complete',
    };
    applyToolResult(undefined, tcPart, 'part output', undefined);
    expect(tcPart.result).toBe('part output');
  });

  it('resolves AskUserQuestion answers via SDK answers on HistoryToolCall', () => {
    const tc: HistoryToolCall = {
      toolCallId: 'id-2',
      toolName: 'AskUserQuestion',
      status: 'complete',
      questions: [{ question: 'Proceed?', type: 'text' }],
    };
    const sdkAnswers = { 'Proceed?': 'yes' };
    applyToolResult(tc, undefined, '', sdkAnswers);
    expect(tc.answers).toEqual({ '0': 'yes' });
  });

  it('does not overwrite existing answers on AskUserQuestion', () => {
    const tc: HistoryToolCall = {
      toolCallId: 'id-3',
      toolName: 'AskUserQuestion',
      status: 'complete',
      questions: [{ question: 'Proceed?', type: 'text' }],
      answers: { '0': 'already-set' },
    };
    applyToolResult(tc, undefined, '', { 'Proceed?': 'new-value' });
    expect(tc.answers).toEqual({ '0': 'already-set' });
  });

  it('handles undefined tc and tcPart gracefully', () => {
    expect(() => applyToolResult(undefined, undefined, 'result', undefined)).not.toThrow();
  });
});

describe('buildCommandMessage', () => {
  it('builds a command message with args', () => {
    const msg = buildCommandMessage('/test', 'arg1', 'uuid-1');
    expect(msg).toEqual({
      id: 'uuid-1',
      role: 'user',
      content: '/test arg1',
      messageType: 'command',
      commandName: '/test',
      commandArgs: 'arg1',
    });
  });

  it('builds a command message without args', () => {
    const msg = buildCommandMessage('/help', '', 'uuid-2');
    expect(msg).toEqual({
      id: 'uuid-2',
      role: 'user',
      content: '/help',
      messageType: 'command',
      commandName: '/help',
      commandArgs: undefined,
    });
  });

  it('generates a random UUID when none provided', () => {
    const msg = buildCommandMessage('/test', '');
    expect(msg.id).toBeTruthy();
    expect(typeof msg.id).toBe('string');
  });
});
