// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { AgentAvatar } from '../ui/AgentAvatar';
import { AgentIdentity } from '../ui/AgentIdentity';

beforeEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// AgentAvatar
// ---------------------------------------------------------------------------

describe('AgentAvatar', () => {
  it('renders emoji inside a colored circle', () => {
    const { container } = render(<AgentAvatar color="#6366f1" emoji="🔍" />);
    const avatar = container.querySelector('[data-slot="agent-avatar"]')!;
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveTextContent('🔍');
  });

  it('applies background color via inline style', () => {
    const { container } = render(<AgentAvatar color="#6366f1" emoji="🔍" />);
    const avatar = container.querySelector('[data-slot="agent-avatar"]') as HTMLElement;
    expect(avatar.style.backgroundColor).toContain('color-mix');
  });

  it('renders different sizes via size prop', () => {
    const { container, rerender } = render(<AgentAvatar color="#fff" emoji="🤖" size="xs" />);
    const getAvatar = () => container.querySelector('[data-slot="agent-avatar"]') as HTMLElement;

    const xsClasses = getAvatar().className;
    rerender(<AgentAvatar color="#fff" emoji="🤖" size="lg" />);
    const lgClasses = getAvatar().className;

    // Different sizes produce different class lists
    expect(xsClasses).not.toEqual(lgClasses);
  });

  it('shows active health pulse indicator', () => {
    const { container } = render(<AgentAvatar color="#fff" emoji="🤖" healthStatus="active" />);
    const avatar = container.querySelector('[data-slot="agent-avatar"]')!;
    expect(avatar.className).toContain('ring-2');
    expect(avatar.querySelector('.animate-ping')).toBeInTheDocument();
  });

  it('shows health ring without pulse for non-active statuses', () => {
    const { container } = render(<AgentAvatar color="#fff" emoji="🤖" healthStatus="inactive" />);
    const avatar = container.querySelector('[data-slot="agent-avatar"]')!;
    expect(avatar.className).toContain('ring-2');
    expect(avatar.querySelector('.animate-ping')).not.toBeInTheDocument();
  });

  it('has no health ring when healthStatus is omitted', () => {
    const { container } = render(<AgentAvatar color="#fff" emoji="🤖" />);
    const avatar = container.querySelector('[data-slot="agent-avatar"]')!;
    expect(avatar.className).not.toContain('ring-2');
  });
});

// ---------------------------------------------------------------------------
// AgentIdentity
// ---------------------------------------------------------------------------

describe('AgentIdentity', () => {
  const baseProps = { color: '#6366f1', emoji: '🔍', name: 'code-reviewer' };

  it('renders avatar + name', () => {
    const { container } = render(<AgentIdentity {...baseProps} />);
    expect(container.querySelector('[data-slot="agent-avatar"]')).toBeInTheDocument();
    expect(screen.getByText('code-reviewer')).toBeInTheDocument();
  });

  it('renders detail when provided', () => {
    render(<AgentIdentity {...baseProps} detail="claude-code" />);
    expect(screen.getByText('claude-code')).toBeInTheDocument();
  });

  it('omits detail element when not provided', () => {
    const { container } = render(<AgentIdentity {...baseProps} />);
    const identity = container.querySelector('[data-slot="agent-identity"]')!;
    expect(identity.querySelectorAll('[class*="muted-foreground"]')).toHaveLength(0);
  });

  it('uses inline layout for xs/sm sizes', () => {
    const { container } = render(<AgentIdentity {...baseProps} size="xs" detail="runtime" />);
    const identity = container.querySelector('[data-slot="agent-identity"]')!;
    expect(identity.querySelector('.items-center')).toBeInTheDocument();
    expect(identity.querySelector('.flex-col')).not.toBeInTheDocument();
  });

  it('uses stacked layout for md/lg sizes', () => {
    const { container } = render(<AgentIdentity {...baseProps} size="md" detail="runtime" />);
    const identity = container.querySelector('[data-slot="agent-identity"]')!;
    expect(identity.querySelector('.flex-col')).toBeInTheDocument();
  });

  it('forwards healthStatus to AgentAvatar', () => {
    const { container } = render(<AgentIdentity {...baseProps} healthStatus="active" />);
    const avatar = container.querySelector('[data-slot="agent-avatar"]')!;
    expect(avatar.className).toContain('ring-2');
    expect(avatar.querySelector('.animate-ping')).toBeInTheDocument();
  });

  it('applies custom className to root', () => {
    const { container } = render(<AgentIdentity {...baseProps} className="my-custom-class" />);
    const identity = container.querySelector('[data-slot="agent-identity"]')!;
    expect(identity.className).toContain('my-custom-class');
  });
});
