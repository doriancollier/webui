/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Mock motion/react before importing the component
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/layers/shared/model', () => ({
  useIsMobile: vi.fn(() => false),
}));

const mockCompleteStep = vi.fn();
const mockSkipStep = vi.fn();
const mockDismiss = vi.fn();
const mockStartOnboarding = vi.fn();

vi.mock('../model/use-onboarding', () => ({
  useOnboarding: vi.fn(() => ({
    shouldShowOnboarding: true,
    state: {
      completedSteps: [],
      skippedSteps: [],
      startedAt: null,
      dismissedAt: null,
    },
    completeStep: mockCompleteStep,
    skipStep: mockSkipStep,
    dismiss: mockDismiss,
    startOnboarding: mockStartOnboarding,
  })),
}));

// Mock step components to isolate OnboardingFlow navigation logic
vi.mock('../ui/AgentDiscoveryStep', () => ({
  AgentDiscoveryStep: ({ onStepComplete }: { onStepComplete: () => void }) => (
    <div data-testid="discovery-step">
      <button onClick={onStepComplete}>Complete Discovery</button>
    </div>
  ),
}));

vi.mock('../ui/PulsePresetsStep', () => ({
  PulsePresetsStep: ({ onStepComplete }: { onStepComplete: () => void }) => (
    <div data-testid="pulse-step">
      <button onClick={onStepComplete}>Complete Pulse</button>
    </div>
  ),
}));

vi.mock('../ui/AdapterSetupStep', () => ({
  AdapterSetupStep: ({ onStepComplete }: { onStepComplete: () => void }) => (
    <div data-testid="adapter-step">
      <button onClick={onStepComplete}>Complete Adapter</button>
    </div>
  ),
}));

vi.mock('../ui/OnboardingComplete', () => ({
  OnboardingComplete: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="onboarding-complete">
      <button onClick={onComplete}>Finish</button>
    </div>
  ),
}));

import { OnboardingFlow } from '../ui/OnboardingFlow';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OnboardingFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Step 1 (discovery) initially', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />);

    expect(screen.getByTestId('discovery-step')).toBeTruthy();
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
  });

  it('calls startOnboarding on mount', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />);

    expect(mockStartOnboarding).toHaveBeenCalled();
  });

  it('shows step indicator dots', () => {
    const { container } = render(<OnboardingFlow onComplete={vi.fn()} />);

    // Three step indicator dots rendered as div elements with rounded-full class
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots).toHaveLength(3);
  });

  it('shows Skip button', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
  });

  it('shows Skip all button', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Skip all' })).toBeTruthy();
  });

  it('initialStep=1 renders the pulse step', () => {
    render(<OnboardingFlow onComplete={vi.fn()} initialStep={1} />);

    expect(screen.getByTestId('pulse-step')).toBeTruthy();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
  });

  it('initialStep=2 renders the adapter step', () => {
    render(<OnboardingFlow onComplete={vi.fn()} initialStep={2} />);

    expect(screen.getByTestId('adapter-step')).toBeTruthy();
    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
  });

  it('Back button is disabled on the first step', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />);

    const backBtn = screen.getByRole('button', { name: 'Back' });
    expect(backBtn.hasAttribute('disabled')).toBe(true);
  });

  it('completing a step calls completeStep and advances', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />);

    fireEvent.click(screen.getByText('Complete Discovery'));

    expect(mockCompleteStep).toHaveBeenCalledWith('discovery');
    // Should advance to step 2
    expect(screen.getByTestId('pulse-step')).toBeTruthy();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
  });

  it('completing all steps shows completion screen', () => {
    render(<OnboardingFlow onComplete={vi.fn()} initialStep={2} />);

    fireEvent.click(screen.getByText('Complete Adapter'));

    expect(mockCompleteStep).toHaveBeenCalledWith('adapters');
    expect(screen.getByTestId('onboarding-complete')).toBeTruthy();
  });

  it('Skip all calls dismiss and onComplete', () => {
    const onComplete = vi.fn();

    render(<OnboardingFlow onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip all' }));

    expect(mockDismiss).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it('Skip calls skipStep with current step and advances', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(mockSkipStep).toHaveBeenCalledWith('discovery');
  });
});
