// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InferenceIndicator } from '../ui/InferenceIndicator';

afterEach(() => {
  cleanup();
});

// Mock the hooks to control their output
vi.mock('@/layers/shared/model/use-elapsed-time', () => ({
  useElapsedTime: vi.fn(() => ({ formatted: '2m 14s', ms: 134000 })),
}));

vi.mock('../model/use-rotating-verb', () => ({
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
    rerender(<InferenceIndicator status="idle" streamStartTime={null} estimatedTokens={3200} />);

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

  it('renders waiting-for-approval state', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isWaitingForUser={true}
        waitingType="approval"
      />
    );
    expect(screen.getByTestId('inference-indicator-waiting')).toBeTruthy();
    expect(screen.getByText('Waiting for your approval')).toBeTruthy();
  });

  it('renders waiting-for-answer state', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isWaitingForUser={true}
        waitingType="question"
      />
    );
    expect(screen.getByTestId('inference-indicator-waiting')).toBeTruthy();
    expect(screen.getByText('Waiting for your answer')).toBeTruthy();
  });

  it('shows elapsed time in waiting state', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isWaitingForUser={true}
        waitingType="approval"
      />
    );
    expect(screen.getByText('2m 14s')).toBeTruthy();
  });

  it('does not show waiting when not streaming', () => {
    const { container } = render(
      <InferenceIndicator
        status="idle"
        streamStartTime={null}
        estimatedTokens={0}
        isWaitingForUser={true}
        waitingType="approval"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('prefers waiting state over streaming state', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isWaitingForUser={true}
        waitingType="approval"
      />
    );
    // Should show waiting, not streaming
    expect(screen.getByTestId('inference-indicator-waiting')).toBeTruthy();
    expect(screen.queryByTestId('inference-indicator-streaming')).toBeNull();
  });

  it('renders rate-limited state with countdown', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isRateLimited={true}
        rateLimitRetryAfter={30}
      />
    );
    expect(screen.getByTestId('inference-indicator-rate-limited')).toBeTruthy();
    expect(screen.getByText(/Rate limited.*retrying in 30s/)).toBeTruthy();
  });

  it('renders rate-limited state without countdown when retryAfter is null', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isRateLimited={true}
        rateLimitRetryAfter={null}
      />
    );
    expect(screen.getByTestId('inference-indicator-rate-limited')).toBeTruthy();
    expect(screen.getByText(/Rate limited.*retrying shortly/)).toBeTruthy();
  });

  it('does not show rate-limited state when not streaming', () => {
    const { container } = render(
      <InferenceIndicator
        status="idle"
        streamStartTime={null}
        estimatedTokens={0}
        isRateLimited={true}
        rateLimitRetryAfter={30}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows elapsed time in rate-limited state', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isRateLimited={true}
        rateLimitRetryAfter={30}
      />
    );
    // The mocked useElapsedTime returns '2m 14s'
    expect(screen.getByText('2m 14s')).toBeTruthy();
  });

  it('prefers waiting-for-user over rate-limited state', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isWaitingForUser={true}
        waitingType="approval"
        isRateLimited={true}
        rateLimitRetryAfter={30}
      />
    );
    // Waiting state takes priority
    expect(screen.getByTestId('inference-indicator-waiting')).toBeTruthy();
    expect(screen.queryByTestId('inference-indicator-rate-limited')).toBeNull();
  });

  it('does not show normal streaming state when rate-limited', () => {
    render(
      <InferenceIndicator
        status="streaming"
        streamStartTime={Date.now()}
        estimatedTokens={100}
        isRateLimited={true}
        rateLimitRetryAfter={30}
      />
    );
    // Should show rate-limited, not normal streaming
    expect(screen.getByTestId('inference-indicator-rate-limited')).toBeTruthy();
    expect(screen.queryByTestId('inference-indicator-streaming')).toBeNull();
  });
});
