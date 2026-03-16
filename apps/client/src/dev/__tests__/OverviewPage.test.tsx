/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OverviewPage } from '../pages/OverviewPage';
import { TOKENS_SECTIONS, COMPONENTS_SECTIONS, CHAT_SECTIONS } from '../playground-registry';
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

  it('renders all three category cards', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    expect(screen.getByRole('heading', { name: 'Design Tokens' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Components' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chat Components' })).toBeInTheDocument();
  });

  it('displays the correct section count for tokens', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    expect(screen.getByText(`${TOKENS_SECTIONS.length} sections`)).toBeInTheDocument();
  });

  it('displays the correct section count for components', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    expect(screen.getByText(`${COMPONENTS_SECTIONS.length} sections`)).toBeInTheDocument();
  });

  it('displays the correct section count for chat', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    expect(screen.getByText(`${CHAT_SECTIONS.length} sections`)).toBeInTheDocument();
  });

  it('calls onNavigate with "tokens" when the Design Tokens card is clicked', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /design tokens/i }));
    expect(onNavigate).toHaveBeenCalledWith('tokens');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('calls onNavigate with "components" when the Components card is clicked', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /^components/i }));
    expect(onNavigate).toHaveBeenCalledWith('components');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('calls onNavigate with "chat" when the Chat Components card is clicked', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /chat components/i }));
    expect(onNavigate).toHaveBeenCalledWith('chat');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('renders category card descriptions', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    expect(screen.getByText(/Color palette, typography/)).toBeInTheDocument();
    expect(screen.getByText(/Interactive gallery of shared UI primitives/)).toBeInTheDocument();
    expect(screen.getByText(/Visual testing gallery for chat UI/)).toBeInTheDocument();
  });

  it('each category card is an accessible button', () => {
    render(<OverviewPage onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });
});
