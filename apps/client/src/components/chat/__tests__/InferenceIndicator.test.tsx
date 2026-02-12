// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InferenceIndicator } from '../InferenceIndicator';

afterEach(() => {
  cleanup();
});

// Mock motion/react to render plain elements
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: Record<string, unknown>) => {
      void initial; void animate; void exit; void transition;
      const { className, style, ...rest } = props as Record<string, unknown>;
      return <div className={className as string} style={style as React.CSSProperties} {...rest}>{children as React.ReactNode}</div>;
    },
    span: ({ children, initial, animate, exit, transition, ...props }: Record<string, unknown>) => {
      void initial; void animate; void exit; void transition;
      const { className, style, ...rest } = props as Record<string, unknown>;
      return <span className={className as string} style={style as React.CSSProperties} {...rest}>{children as React.ReactNode}</span>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the hooks to control their output
vi.mock('../../../hooks/use-elapsed-time', () => ({
  useElapsedTime: vi.fn(() => ({ formatted: '2m 14s', ms: 134000 })),
}));

vi.mock('../../../hooks/use-rotating-verb', () => ({
  useRotatingVerb: vi.fn(() => ({ verb: "Droppin' Science", key: 'verb-0' })),
}));

describe('InferenceIndicator', () => {
  it('returns null when idle with no tokens', () => {
    const { container } = render(
      <InferenceIndicator status="idle" streamStartTime={null} estimatedTokens={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders streaming state with all elements', () => {
    render(
      <InferenceIndicator status="streaming" streamStartTime={Date.now()} estimatedTokens={3200} />
    );

    expect(screen.getByTestId('inference-indicator-streaming')).toBeTruthy();
    expect(screen.getByText("Droppin' Science")).toBeTruthy();
    expect(screen.getByText('2m 14s')).toBeTruthy();
    expect(screen.getByText('~3.2k tokens')).toBeTruthy();
  });

  it('renders the theme icon with animation style', () => {
    render(
      <InferenceIndicator status="streaming" streamStartTime={Date.now()} estimatedTokens={100} />
    );

    const icon = screen.getByText('✨');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.style.animation).toContain('shimmer-pulse');
  });

  it('renders complete state with summary after streaming ends', () => {
    const { rerender } = render(
      <InferenceIndicator status="streaming" streamStartTime={Date.now()} estimatedTokens={3200} />
    );

    // Transition from streaming to idle
    rerender(
      <InferenceIndicator status="idle" streamStartTime={null} estimatedTokens={3200} />
    );

    expect(screen.getByTestId('inference-indicator-complete')).toBeTruthy();
    expect(screen.getByText('2m 14s')).toBeTruthy();
    expect(screen.getByText('~3.2k tokens')).toBeTruthy();
  });

  it('formats tokens below 1000 without k suffix', () => {
    render(
      <InferenceIndicator status="streaming" streamStartTime={Date.now()} estimatedTokens={450} />
    );

    expect(screen.getByText('~450 tokens')).toBeTruthy();
  });

  it('formats tokens at 1000+ with k suffix', () => {
    render(
      <InferenceIndicator status="streaming" streamStartTime={Date.now()} estimatedTokens={1250} />
    );

    expect(screen.getByText('~1.3k tokens')).toBeTruthy();
  });
});
