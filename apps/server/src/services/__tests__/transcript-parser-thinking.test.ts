import { describe, it, expect } from 'vitest';
import { parseTranscript } from '../runtimes/claude-code/transcript-parser.js';

describe('parseTranscript thinking blocks', () => {
  it('parses thinking + text content blocks into correct parts', () => {
    // Purpose: Verify thinking content blocks produce ThinkingPart in the parts array,
    // followed by text parts, with correct ordering.
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'Let me analyze this...' },
            { type: 'text', text: 'Here is my answer.' },
          ],
        },
        uuid: 'msg-1',
      }),
    ];

    const result = parseTranscript(lines);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('assistant');
    expect(result[0].parts).toHaveLength(2);
    expect(result[0].parts![0]).toEqual({
      type: 'thinking',
      text: 'Let me analyze this...',
      isStreaming: false,
    });
    expect(result[0].parts![1]).toEqual({
      type: 'text',
      text: 'Here is my answer.',
    });
  });

  it('skips thinking blocks with empty or missing thinking field', () => {
    // Purpose: Guard against malformed thinking blocks that have no text content.
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: '' },
            { type: 'thinking' }, // missing thinking field
            { type: 'text', text: 'Response' },
          ],
        },
        uuid: 'msg-1',
      }),
    ];

    const result = parseTranscript(lines);

    expect(result).toHaveLength(1);
    expect(result[0].parts).toHaveLength(1);
    expect(result[0].parts![0].type).toBe('text');
  });

  it('preserves part ordering: thinking → text → tool_call', () => {
    // Purpose: Verify parts array maintains document order when all three types coexist.
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'Reasoning about it' },
            { type: 'text', text: 'Let me check.' },
            { type: 'tool_use', id: 'tc-1', name: 'Read', input: { file_path: '/tmp/test.ts' } },
          ],
        },
        uuid: 'msg-1',
      }),
    ];

    const result = parseTranscript(lines);

    expect(result).toHaveLength(1);
    expect(result[0].parts).toHaveLength(3);
    expect(result[0].parts![0].type).toBe('thinking');
    expect(result[0].parts![1].type).toBe('text');
    expect(result[0].parts![2].type).toBe('tool_call');
  });

  it('sets isStreaming to false for all thinking parts from transcripts', () => {
    // Purpose: Transcript-parsed thinking blocks are always complete (history view),
    // so isStreaming must always be false.
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'Deep thought one' },
            { type: 'thinking', thinking: 'Deep thought two' },
            { type: 'text', text: 'Done' },
          ],
        },
        uuid: 'msg-1',
      }),
    ];

    const result = parseTranscript(lines);
    const thinkingParts = result[0].parts!.filter((p) => p.type === 'thinking');

    expect(thinkingParts).toHaveLength(2);
    for (const part of thinkingParts) {
      if (part.type === 'thinking') {
        expect(part.isStreaming).toBe(false);
      }
    }
  });

  it('does not regress: messages without thinking blocks parse normally', () => {
    // Purpose: Regression — ensure thinking support doesn't break normal text-only parsing.
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'World' },
          ],
        },
        uuid: 'msg-1',
      }),
    ];

    const result = parseTranscript(lines);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Hello\nWorld');
    expect(result[0].parts).toHaveLength(1); // Two text blocks merged into one
    expect(result[0].parts![0].type).toBe('text');
  });
});
