/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OverviewPage } from '../pages/OverviewPage';
import { PAGE_CONFIGS } from '../playground-config';
import type { Page } from '../playground-registry';

describe('OverviewPage', () => {
  let onNavigate: (page: Page) => void;

  beforeEach(() => {
    onNavigate = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the page header', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('DorkOS Dev Playground');
  });

  it('renders a card for every page in PAGE_CONFIGS', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    for (const config of PAGE_CONFIGS) {
      expect(screen.getByRole('heading', { name: config.label })).toBeInTheDocument();
    }
  });

  it('displays the correct section count for each page', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(PAGE_CONFIGS.length);
    for (let i = 0; i < PAGE_CONFIGS.length; i++) {
      expect(
        within(cards[i]).getByText(`${PAGE_CONFIGS[i].sections.length} sections`)
      ).toBeInTheDocument();
    }
  });

  it('calls onNavigate with the correct page ID when a card is clicked', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    const cards = screen.getAllByRole('button');
    for (let i = 0; i < PAGE_CONFIGS.length; i++) {
      (onNavigate as ReturnType<typeof vi.fn>).mockClear();
      fireEvent.click(cards[i]);
      expect(onNavigate).toHaveBeenCalledWith(PAGE_CONFIGS[i].id);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    }
  });

  it('renders category card descriptions', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    for (const config of PAGE_CONFIGS) {
      // Match first 30 chars of description to avoid brittle full-string matching
      const prefix = config.description.slice(0, 30);
      expect(
        screen.getByText(new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      ).toBeInTheDocument();
    }
  });

  it('each category card is an accessible button', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(PAGE_CONFIGS.length);
  });
});
