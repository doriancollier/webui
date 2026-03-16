/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ToolArgumentsDisplay } from '../tool-arguments-formatter';

describe('ToolArgumentsDisplay', () => {
  it('returns null for empty input', () => {
    const { container } = render(<ToolArgumentsDisplay toolName="Read" input="" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders key-value pairs for valid JSON', () => {
    const input = JSON.stringify({ file_path: '/src/app.ts', limit: 100 });
    render(<ToolArgumentsDisplay toolName="Read" input={input} />);
    expect(screen.getByText('File path')).toBeTruthy();
    expect(screen.getByText(/\/src\/app\.ts/)).toBeTruthy();
    expect(screen.getByText('Limit')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('falls back to pre for invalid JSON', () => {
    const { container } = render(<ToolArgumentsDisplay toolName="Bash" input="not json" />);
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toBe('not json');
  });

  it('truncates long strings', () => {
    const longStr = 'a'.repeat(200);
    const input = JSON.stringify({ content: longStr });
    render(<ToolArgumentsDisplay toolName="Write" input={input} />);
    // Should show truncated text (120 chars + ellipsis)
    const dd = screen.getByText(/a{10,}/);
    expect(dd.textContent!.length).toBeLessThan(200);
  });

  it('renders file paths in code elements', () => {
    const input = JSON.stringify({ file_path: '/src/index.ts' });
    const { container } = render(<ToolArgumentsDisplay toolName="Read" input={input} />);
    const code = container.querySelector('code');
    expect(code).not.toBeNull();
    expect(code!.textContent).toContain('/src/index.ts');
  });

  it('renders booleans with distinct styling', () => {
    const input = JSON.stringify({ enabled: true });
    render(<ToolArgumentsDisplay toolName="Test" input={input} />);
    const boolEl = screen.getByText('true');
    expect(boolEl.className).toContain('amber');
  });

  it('renders nested objects with {...', () => {
    const input = JSON.stringify({ config: { nested: { deep: 'value' } } });
    render(<ToolArgumentsDisplay toolName="Test" input={input} />);
    expect(screen.getByText('{...')).toBeTruthy();
  });

  it('renders arrays with "and N more" for long arrays', () => {
    const arr = Array.from({ length: 8 }, (_, i) => `item${i}`);
    const input = JSON.stringify({ items: arr });
    render(<ToolArgumentsDisplay toolName="Test" input={input} />);
    expect(screen.getByText(/and 3 more/)).toBeTruthy();
  });

  it('falls back to pre for non-object JSON (e.g. array)', () => {
    const input = JSON.stringify([1, 2, 3]);
    const { container } = render(<ToolArgumentsDisplay toolName="Test" input={input} />);
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
  });

  it('renders null values with italic styling', () => {
    const input = JSON.stringify({ value: null });
    render(<ToolArgumentsDisplay toolName="Test" input={input} />);
    const nullEl = screen.getByText('null');
    expect(nullEl.className).toContain('italic');
  });
});

describe('ToolArgumentsDisplay raw fallback truncation — regression', () => {
  it('renders valid object JSON as key-value grid without raw truncation', () => {
    const validJson = JSON.stringify({ command: 'echo hello', description: 'test' });
    render(<ToolArgumentsDisplay toolName="Bash" input={validJson} />);

    // Should render as a structured display, not a <pre> block
    expect(screen.getByText('Command')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });
});

describe('ToolArgumentsDisplay raw fallback truncation', () => {
  it('renders short invalid JSON input fully without truncation', () => {
    const shortInput = 'this is not valid json';
    render(<ToolArgumentsDisplay toolName="Bash" input={shortInput} />);
    expect(screen.getByText(shortInput)).toBeTruthy();
  });

  it('truncates invalid JSON input over 5KB with ellipsis', () => {
    const longInput = 'a'.repeat(6000);
    const { container } = render(<ToolArgumentsDisplay toolName="Bash" input={longInput} />);

    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    // 5120 chars + 1 ellipsis character = 5121
    expect(pre!.textContent!.length).toBe(5121);
    expect(pre!.textContent!.endsWith('\u2026')).toBe(true);
  });

  it('truncates non-object parsed JSON over 5KB with ellipsis', () => {
    const longArray = JSON.stringify(Array.from({ length: 2000 }, (_, i) => i));
    expect(longArray.length).toBeGreaterThan(5120);

    const { container } = render(<ToolArgumentsDisplay toolName="Bash" input={longArray} />);

    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre!.textContent!.length).toBe(5121);
    expect(pre!.textContent!.endsWith('\u2026')).toBe(true);
  });
});
