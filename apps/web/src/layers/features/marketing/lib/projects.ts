import type { Project } from './types'

export const projects: Project[] = [
  {
    id: 'chat-interface',
    title: 'Chat Interface',
    description: 'Rich markdown rendering, streaming responses, and a familiar chat experience for Claude Code in your browser.',
    status: 'stable',
    type: 'Core',
  },
  {
    id: 'tool-approval',
    title: 'Tool Approval',
    description: 'Review and approve or deny tool calls before they execute. Stay in control of every action Claude takes.',
    status: 'stable',
    type: 'Core',
  },
  {
    id: 'session-management',
    title: 'Session Management',
    description: 'Browse, resume, and sync sessions across clients. Works with CLI-started sessions too.',
    status: 'stable',
    type: 'Core',
  },
  {
    id: 'slash-commands',
    title: 'Slash Commands',
    description: 'Discover and run slash commands from .claude/commands/ with a searchable palette.',
    status: 'stable',
    type: 'Developer',
  },
  {
    id: 'dark-mode',
    title: 'Dark Mode',
    description: 'Full dark theme support with automatic system preference detection.',
    status: 'stable',
    type: 'Interface',
  },
  {
    id: 'mobile-responsive',
    title: 'Mobile Responsive',
    description: 'Use DorkOS on any device. The interface adapts from desktop to mobile seamlessly.',
    status: 'beta',
    type: 'Interface',
  },
]
