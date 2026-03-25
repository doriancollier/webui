/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatusLine } from '../ui/StatusLine';

// ResizeObserver is not available in jsdom — provide a minimal stub.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('StatusLine', () => {
  describe('container visibility', () => {
    it('does not render the toolbar when no items are visible', () => {
      render(
        <StatusLine sessionId="s1" isStreaming={false}>
          <StatusLine.Item itemKey="cwd" visible={false}>
            <span>cwd</span>
          </StatusLine.Item>
        </StatusLine>
      );
      expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    it('renders the toolbar when at least one item is visible', () => {
      render(
        <StatusLine sessionId="s1" isStreaming={false}>
          <StatusLine.Item itemKey="cwd" visible>
            <span>cwd content</span>
          </StatusLine.Item>
        </StatusLine>
      );
      expect(screen.getByRole('toolbar')).toBeInTheDocument();
    });

    it('has the correct ARIA attributes on the toolbar container', () => {
      render(
        <StatusLine sessionId="s1" isStreaming={false}>
          <StatusLine.Item itemKey="cwd" visible>
            <span>content</span>
          </StatusLine.Item>
        </StatusLine>
      );
      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveAttribute('aria-label', 'Session status');
      expect(toolbar).toHaveAttribute('aria-live', 'polite');
      expect(toolbar).toHaveAttribute('data-testid', 'status-line');
    });
  });

  describe('StatusLine.Item visibility', () => {
    it('renders visible items', () => {
      render(
        <StatusLine sessionId="s1" isStreaming={false}>
          <StatusLine.Item itemKey="cwd" visible>
            <span>cwd content</span>
          </StatusLine.Item>
        </StatusLine>
      );
      expect(screen.getByText('cwd content')).toBeInTheDocument();
    });

    it('does not render invisible items', () => {
      render(
        <StatusLine sessionId="s1" isStreaming={false}>
          <StatusLine.Item itemKey="cwd" visible={false}>
            <span>should not appear</span>
          </StatusLine.Item>
          <StatusLine.Item itemKey="git" visible>
            <span>git content</span>
          </StatusLine.Item>
        </StatusLine>
      );
      expect(screen.queryByText('should not appear')).not.toBeInTheDocument();
      expect(screen.getByText('git content')).toBeInTheDocument();
    });

    it('renders all visible items when multiple are provided', () => {
      render(
        <StatusLine sessionId="s1" isStreaming={false}>
          <StatusLine.Item itemKey="a" visible>
            <span>item a</span>
          </StatusLine.Item>
          <StatusLine.Item itemKey="b" visible>
            <span>item b</span>
          </StatusLine.Item>
          <StatusLine.Item itemKey="c" visible>
            <span>item c</span>
          </StatusLine.Item>
        </StatusLine>
      );
      expect(screen.getByText('item a')).toBeInTheDocument();
      expect(screen.getByText('item b')).toBeInTheDocument();
      expect(screen.getByText('item c')).toBeInTheDocument();
    });
  });

  describe('separator logic', () => {
    it('renders no separator when only one item is visible', () => {
      const { container } = render(
        <StatusLine sessionId="s1" isStreaming={false}>
          <StatusLine.Item itemKey="only" visible>
            <span>only item</span>
          </StatusLine.Item>
        </StatusLine>
      );
      expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(0);
    });

    it('renders exactly one separator between two visible items', () => {
      const { container } = render(
        <StatusLine sessionId="s1" isStreaming={false}>
          <StatusLine.Item itemKey="a" visible>
            <span>a</span>
          </StatusLine.Item>
          <StatusLine.Item itemKey="b" visible>
            <span>b</span>
          </StatusLine.Item>
        </StatusLine>
      );
      expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(1);
    });

    it('renders N-1 separators for N visible items', () => {
      const { container } = render(
        <StatusLine sessionId="s1" isStreaming={false}>
          <StatusLine.Item itemKey="a" visible>
            <span>a</span>
          </StatusLine.Item>
          <StatusLine.Item itemKey="b" visible>
            <span>b</span>
          </StatusLine.Item>
          <StatusLine.Item itemKey="c" visible>
            <span>c</span>
          </StatusLine.Item>
        </StatusLine>
      );
      expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(2);
    });

    it('does not render a separator before the first visible item when earlier items are invisible', () => {
      const { container } = render(
        <StatusLine sessionId="s1" isStreaming={false}>
          <StatusLine.Item itemKey="hidden" visible={false}>
            <span>hidden</span>
          </StatusLine.Item>
          <StatusLine.Item itemKey="first-visible" visible>
            <span>first visible</span>
          </StatusLine.Item>
          <StatusLine.Item itemKey="second-visible" visible>
            <span>second visible</span>
          </StatusLine.Item>
        </StatusLine>
      );
      expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(1);
    });

    it('renders the middot character as separator content', () => {
      const { container } = render(
        <StatusLine sessionId="s1" isStreaming={false}>
          <StatusLine.Item itemKey="a" visible>
            <span>a</span>
          </StatusLine.Item>
          <StatusLine.Item itemKey="b" visible>
            <span>b</span>
          </StatusLine.Item>
        </StatusLine>
      );
      const separator = container.querySelector('span[aria-hidden="true"]');
      expect(separator?.textContent).toBe('\u00B7');
    });
  });

  describe('provider guard', () => {
    it('throws when StatusLine.Item is used outside a StatusLine', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        render(
          <StatusLine.Item itemKey="orphan" visible>
            <span>orphan</span>
          </StatusLine.Item>
        )
      ).toThrow('StatusLine.Item must be used within a StatusLine.');
      errorSpy.mockRestore();
    });
  });
});
