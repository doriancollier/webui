// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QuestionPrompt } from '../QuestionPrompt';
import type { QuestionItem } from '@lifeos/shared/types';

// Mock Radix Tabs with controlled state support for jsdom
vi.mock('@radix-ui/react-tabs', () => {
  const React = require('react');
  const TabsContext = React.createContext({ value: '', onValueChange: (_v: string) => {} });

  function Root({ children, value, onValueChange, ...props }: Record<string, unknown> & { children?: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) {
    return React.createElement(TabsContext.Provider, { value: { value: value || '', onValueChange: onValueChange || (() => {}) } },
      React.createElement('div', props, children));
  }
  function List({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) {
    return React.createElement('div', { role: 'tablist', ...props }, children);
  }
  function Trigger({ children, value, ...props }: Record<string, unknown> & { children?: React.ReactNode; value?: string }) {
    const ctx = React.useContext(TabsContext);
    const isActive = ctx.value === value;
    return React.createElement('button', {
      role: 'tab',
      'data-state': isActive ? 'active' : 'inactive',
      'data-value': value,
      onClick: () => ctx.onValueChange(value || ''),
      ...props,
    }, children);
  }
  function Content({ children, value, ...props }: Record<string, unknown> & { children?: React.ReactNode; value?: string }) {
    const ctx = React.useContext(TabsContext);
    if (ctx.value !== value) return null;
    return React.createElement('div', { role: 'tabpanel', 'data-state': 'active', ...props }, children);
  }

  return { Root, List, Trigger, Content };
});

// Mock motion/react to render plain elements (no animation delays)
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: Record<string, unknown>) => {
      void initial; void animate; void exit; void transition;
      const { className, style, ...rest } = props as Record<string, unknown>;
      return <div className={className as string} style={style as React.CSSProperties} {...rest}>{children as React.ReactNode}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockSubmitAnswers = vi.fn().mockResolvedValue({ ok: true });
vi.mock('../../../contexts/TransportContext', () => ({
  useTransport: () => ({
    submitAnswers: mockSubmitAnswers,
  }),
}));

afterEach(() => {
  cleanup();
  mockSubmitAnswers.mockClear();
});

const singleSelectQuestion: QuestionItem = {
  header: 'Approach',
  question: 'How should I handle the conflicting meeting times?',
  options: [
    { label: 'Reschedule the internal meeting', description: 'External meetings are harder to move.' },
    { label: 'Decline the external meeting' },
  ],
  multiSelect: false,
};

const multiSelectQuestion: QuestionItem = {
  header: 'Features',
  question: 'Which features should we include?',
  options: [
    { label: 'Dark mode' },
    { label: 'Notifications' },
    { label: 'Search' },
  ],
  multiSelect: true,
};

const baseProps = {
  sessionId: 'session-1',
  toolCallId: 'tc-1',
};

describe('QuestionPrompt', () => {
  it('renders question text and header', () => {
    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    expect(screen.getByText('Approach')).toBeDefined();
    expect(screen.getByText('How should I handle the conflicting meeting times?')).toBeDefined();
  });

  it('renders radio buttons for single-select questions', () => {
    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    const radios = screen.getAllByRole('radio');
    // 2 options + 1 "Other" = 3 radio buttons
    expect(radios.length).toBe(3);
    expect(screen.getByText('Reschedule the internal meeting')).toBeDefined();
    expect(screen.getByText('Decline the external meeting')).toBeDefined();
    expect(screen.getByText('Other')).toBeDefined();
  });

  it('renders checkboxes for multi-select questions', () => {
    render(
      <QuestionPrompt {...baseProps} questions={[multiSelectQuestion]} />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // 3 options + 1 "Other" = 4 checkboxes
    expect(checkboxes.length).toBe(4);
    expect(screen.getByText('Dark mode')).toBeDefined();
    expect(screen.getByText('Notifications')).toBeDefined();
    expect(screen.getByText('Search')).toBeDefined();
  });

  it('renders "Other" option with text input when selected (single-select)', () => {
    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    // Text input should not be visible initially
    expect(screen.queryByPlaceholderText('Type your answer...')).toBeNull();

    // Select "Other"
    const otherRadio = screen.getAllByRole('radio')[2]; // Last radio is "Other"
    fireEvent.click(otherRadio);

    // Text input should now be visible
    expect(screen.getByPlaceholderText('Type your answer...')).toBeDefined();
  });

  it('submit button is disabled when no selection made', () => {
    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton.hasAttribute('disabled')).toBe(true);
  });

  it('submit button is enabled when selection is made', () => {
    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    const radio = screen.getAllByRole('radio')[0];
    fireEvent.click(radio);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton.hasAttribute('disabled')).toBe(false);
  });

  it('calls transport.submitAnswers() with correct answer format on submit (single-select)', async () => {
    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    // Select first option
    const radio = screen.getAllByRole('radio')[0];
    fireEvent.click(radio);

    // Submit
    const submitButton = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitAnswers).toHaveBeenCalledWith(
        'session-1',
        'tc-1',
        { '0': 'Reschedule the internal meeting' }
      );
    });
  });

  it('for multi-select, answer is JSON-stringified array', async () => {
    render(
      <QuestionPrompt {...baseProps} questions={[multiSelectQuestion]} />
    );
    // Select first two checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Dark mode
    fireEvent.click(checkboxes[1]); // Notifications

    const submitButton = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitAnswers).toHaveBeenCalledWith(
        'session-1',
        'tc-1',
        { '0': JSON.stringify(['Dark mode', 'Notifications']) }
      );
    });
  });

  it('for "Other" selection, answer is the user\'s typed text (single-select)', async () => {
    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    // Select "Other"
    const otherRadio = screen.getAllByRole('radio')[2];
    fireEvent.click(otherRadio);

    // Type custom text
    const textInput = screen.getByPlaceholderText('Type your answer...');
    fireEvent.change(textInput, { target: { value: 'My custom answer' } });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitAnswers).toHaveBeenCalledWith(
        'session-1',
        'tc-1',
        { '0': 'My custom answer' }
      );
    });
  });

  it('collapses to compact summary after successful submission (shows emerald styling)', async () => {
    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    // Select and submit
    const radio = screen.getAllByRole('radio')[0];
    fireEvent.click(radio);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      // After submission, the form should collapse
      expect(screen.queryByRole('radio')).toBeNull();
      // Header should still be visible in summary (vertical layout, no colon)
      expect(screen.getByText('Approach')).toBeDefined();
      // Selected value should be displayed
      expect(screen.getByText('Reschedule the internal meeting')).toBeDefined();
    });

    // Check emerald styling on the container
    const container = screen.getByText('Approach').closest('div[class*="emerald"]');
    expect(container).not.toBeNull();
  });

  it('shows error text when submission fails', async () => {
    mockSubmitAnswers.mockRejectedValueOnce(new Error('Network error'));

    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    // Select and submit
    const radio = screen.getAllByRole('radio')[0];
    fireEvent.click(radio);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });

    // Form should still be visible (not collapsed)
    expect(screen.getAllByRole('radio').length).toBe(3);
  });

  it('shows "Submitting..." text during submission', async () => {
    // Make submitAnswers hang so we can observe the submitting state
    let resolveSubmit: (value: unknown) => void;
    mockSubmitAnswers.mockImplementationOnce(() => new Promise(resolve => {
      resolveSubmit = resolve;
    }));

    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    // Select and submit
    const radio = screen.getAllByRole('radio')[0];
    fireEvent.click(radio);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    // Should show "Submitting..." while waiting
    expect(screen.getByText('Submitting...')).toBeDefined();

    // Resolve the promise to clean up
    resolveSubmit!({ ok: true });
    await waitFor(() => {
      expect(screen.queryByText('Submitting...')).toBeNull();
    });
  });

  it('submit button stays disabled when "Other" is selected but no text entered', () => {
    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    // Select "Other" without typing anything
    const otherRadio = screen.getAllByRole('radio')[2];
    fireEvent.click(otherRadio);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton.hasAttribute('disabled')).toBe(true);
  });

  it('renders option descriptions when provided', () => {
    render(
      <QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />
    );
    expect(screen.getByText('External meetings are harder to move.')).toBeDefined();
  });
});

describe('Multi-question tabs', () => {
  // Verifies tab bar renders with correct question headers
  it('renders tab bar when multiple questions provided', () => {
    render(<QuestionPrompt {...baseProps} questions={[singleSelectQuestion, multiSelectQuestion]} />);
    expect(screen.getByRole('tablist')).toBeDefined();
    expect(screen.getByRole('tab', { name: /Approach/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Features/i })).toBeDefined();
  });

  // Verifies single question has no tab overhead
  it('does not render tab bar for single question', () => {
    render(<QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  // Verifies only active tab's content is visible
  it('shows only active tab content', () => {
    render(<QuestionPrompt {...baseProps} questions={[singleSelectQuestion, multiSelectQuestion]} />);
    // First tab active by default — its question text should be visible
    expect(screen.getByText(singleSelectQuestion.question)).toBeDefined();
    // Second tab's question text should not be in the DOM (Radix lazy mounts)
    expect(screen.queryByText(multiSelectQuestion.question)).toBeNull();
  });

  // Verifies tab switching activates the clicked tab and shows its content
  it('switches content when tab is clicked', () => {
    render(<QuestionPrompt {...baseProps} questions={[singleSelectQuestion, multiSelectQuestion]} />);
    const featuresTab = screen.getByRole('tab', { name: /Features/i });
    expect(featuresTab.getAttribute('data-state')).toBe('inactive');
    fireEvent.click(featuresTab);
    expect(featuresTab.getAttribute('data-state')).toBe('active');
    // Second tab's content should now be visible
    expect(screen.getByText(multiSelectQuestion.question)).toBeDefined();
    // First tab's content should be hidden
    expect(screen.queryByText(singleSelectQuestion.question)).toBeNull();
  });

  // Verifies submit requires ALL questions answered across tabs
  it('submit disabled until all questions answered across tabs', () => {
    render(<QuestionPrompt {...baseProps} questions={[singleSelectQuestion, multiSelectQuestion]} />);
    // Answer first question only
    fireEvent.click(screen.getAllByRole('radio')[0]);
    expect(screen.getByRole('button', { name: /submit/i }).hasAttribute('disabled')).toBe(true);
  });

  // Verifies checkmark appears on answered tabs
  it('shows checkmark on answered tabs', () => {
    render(<QuestionPrompt {...baseProps} questions={[singleSelectQuestion, multiSelectQuestion]} />);
    fireEvent.click(screen.getAllByRole('radio')[0]);
    // First tab should now have a check icon (svg)
    const firstTab = screen.getByRole('tab', { name: /Approach/i });
    expect(firstTab.querySelector('svg')).not.toBeNull();
  });
});

describe('Answer summary layout', () => {
  // Verifies vertical layout renders header and value on separate elements
  it('renders vertical stacked summary after submission', async () => {
    render(<QuestionPrompt {...baseProps} questions={[singleSelectQuestion]} />);
    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      // Header as label, value as separate text
      expect(screen.getByText('Approach')).toBeDefined();
      expect(screen.getByText('Reschedule the internal meeting')).toBeDefined();
    });
  });

  // Verifies pre-answered questions (from history) use vertical layout
  it('renders vertical summary for pre-answered questions', () => {
    render(
      <QuestionPrompt
        {...baseProps}
        questions={[singleSelectQuestion, multiSelectQuestion]}
        answers={{ '0': 'Reschedule the internal meeting', '1': JSON.stringify(['Dark mode', 'Search']) }}
      />
    );
    expect(screen.getByText('Approach')).toBeDefined();
    expect(screen.getByText('Reschedule the internal meeting')).toBeDefined();
    expect(screen.getByText('Features')).toBeDefined();
    expect(screen.getByText('Dark mode, Search')).toBeDefined();
  });
});
