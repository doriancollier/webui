/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Radix UI's @radix-ui/react-use-size calls ResizeObserver which jsdom doesn't provide.
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock sound effects — use importOriginal to preserve other exports (DEFAULT_FONT, etc.)
const mockPlaySliderTick = vi.fn();
const mockPlayCelebration = vi.fn();
vi.mock('@/layers/shared/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/layers/shared/lib')>();
  return {
    ...actual,
    playSliderTick: (...a: unknown[]) => mockPlaySliderTick(...a),
    playCelebration: (...a: unknown[]) => mockPlayCelebration(...a),
  };
});

const mockMutate = vi.fn();
let mockIsPending = false;
vi.mock('@/layers/features/agent-creation', () => ({
  useCreateAgent: () => ({
    mutate: mockMutate,
    isPending: mockIsPending,
  }),
}));

import { MeetDorkBotStep } from '../MeetDorkBotStep';

describe('MeetDorkBotStep', () => {
  const onStepComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
  });

  afterEach(() => {
    cleanup();
  });

  // --- Phase 1: Setup ---

  it('renders Phase 1 with name input defaulting to dorkbot', () => {
    render(<MeetDorkBotStep onStepComplete={onStepComplete} />);

    expect(screen.getByText('Meet DorkBot')).toBeInTheDocument();
    const input = screen.getByLabelText('Name') as HTMLInputElement;
    expect(input.value).toBe('dorkbot');
  });

  it('shows directory path with current name', () => {
    render(<MeetDorkBotStep onStepComplete={onStepComplete} />);

    expect(screen.getByTestId('directory-path')).toHaveTextContent('~/.dork/agents/dorkbot/');
  });

  it('updates directory path when name changes', async () => {
    const user = userEvent.setup();
    render(<MeetDorkBotStep onStepComplete={onStepComplete} />);

    const input = screen.getByLabelText('Name');
    await user.clear(input);
    await user.type(input, 'my-agent');

    expect(screen.getByTestId('directory-path')).toHaveTextContent('~/.dork/agents/my-agent/');
  });

  it('validates name in real-time and shows error for invalid names', async () => {
    const user = userEvent.setup();
    render(<MeetDorkBotStep onStepComplete={onStepComplete} />);

    const input = screen.getByLabelText('Name');
    await user.clear(input);
    await user.type(input, 'INVALID');

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows error when name is cleared', async () => {
    const user = userEvent.setup();
    render(<MeetDorkBotStep onStepComplete={onStepComplete} />);

    const input = screen.getByLabelText('Name');
    await user.clear(input);

    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
  });

  it('disables Next button when name is invalid', async () => {
    const user = userEvent.setup();
    render(<MeetDorkBotStep onStepComplete={onStepComplete} />);

    const input = screen.getByLabelText('Name');
    await user.clear(input);

    expect(screen.getByText('Next: Personality')).toBeDisabled();
  });

  it('advances to Phase 2 when Next: Personality is clicked', async () => {
    const user = userEvent.setup();
    render(<MeetDorkBotStep onStepComplete={onStepComplete} />);

    await user.click(screen.getByText('Next: Personality'));

    // Phase 2 should be visible
    expect(screen.getByTestId('personality-sliders')).toBeInTheDocument();
    expect(screen.getByTestId('personality-preview')).toBeInTheDocument();
  });

  // --- Phase 2: Personality ---

  function renderAtPhase2() {
    const result = render(<MeetDorkBotStep onStepComplete={onStepComplete} />);
    fireEvent.click(screen.getByText('Next: Personality'));
    return result;
  }

  it('renders 5 trait sliders in Phase 2', () => {
    renderAtPhase2();

    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(5);
  });

  it('renders trait labels for each slider', () => {
    renderAtPhase2();

    // Check endpoint labels exist
    expect(screen.getByText('Serious')).toBeInTheDocument();
    expect(screen.getByText('Playful')).toBeInTheDocument();
    expect(screen.getByText('Ask first')).toBeInTheDocument();
    expect(screen.getByText('Act alone')).toBeInTheDocument();
    expect(screen.getByText('Conservative')).toBeInTheDocument();
    expect(screen.getByText('Bold')).toBeInTheDocument();
    expect(screen.getByText('Terse')).toBeInTheDocument();
    expect(screen.getByText('Thorough')).toBeInTheDocument();
    expect(screen.getByText('By the book')).toBeInTheDocument();
    expect(screen.getByText('Inventive')).toBeInTheDocument();
  });

  it('displays preview text in Phase 2', () => {
    renderAtPhase2();

    const preview = screen.getByTestId('personality-preview');
    // Default traits at level 3 should produce preview containing 'Balanced'
    expect(preview.textContent).toContain('Balanced');
  });

  it('avatar has breathe animation class', () => {
    renderAtPhase2();

    const avatar = screen.getByTestId('dorkbot-avatar');
    expect(avatar.className).toContain('dorkbot-avatar');
  });

  it('calls createAgent with correct defaults when Create button clicked', () => {
    renderAtPhase2();

    fireEvent.click(screen.getByTestId('create-dorkbot'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [opts] = mockMutate.mock.calls[0];
    expect(opts).toEqual({
      name: 'dorkbot',
      traits: { tone: 3, autonomy: 3, caution: 3, communication: 3, creativity: 3 },
      conventions: { soul: true, nope: true, dorkosKnowledge: true },
    });
  });

  it('calls onStepComplete and playCelebration on creation success', () => {
    renderAtPhase2();

    fireEvent.click(screen.getByTestId('create-dorkbot'));

    // Extract the onSuccess callback and invoke it
    const [, callbacks] = mockMutate.mock.calls[0];
    callbacks.onSuccess();

    expect(mockPlayCelebration).toHaveBeenCalledTimes(1);
    expect(onStepComplete).toHaveBeenCalledTimes(1);
  });

  it('shows error message on creation failure and allows retry', () => {
    renderAtPhase2();

    fireEvent.click(screen.getByTestId('create-dorkbot'));

    // Simulate error — wrap in act because onError triggers setState
    const [, callbacks] = mockMutate.mock.calls[0];
    act(() => {
      callbacks.onError(new Error('Network error'));
    });

    expect(screen.getByTestId('create-error')).toHaveTextContent('Network error');

    // Button should still be clickable for retry
    fireEvent.click(screen.getByTestId('create-dorkbot'));
    expect(mockMutate).toHaveBeenCalledTimes(2);
  });

  it('shows generic error message for non-Error failures', () => {
    renderAtPhase2();

    fireEvent.click(screen.getByTestId('create-dorkbot'));

    const [, callbacks] = mockMutate.mock.calls[0];
    act(() => {
      callbacks.onError('some string error');
    });

    expect(screen.getByTestId('create-error')).toHaveTextContent('Failed to create agent');
  });
});
