export interface Subsystem {
  id: string
  gap: string
  name: string
  description: string
  status: 'available' | 'coming-soon'
}

export const subsystems: Subsystem[] = [
  {
    id: 'pulse',
    gap: 'No schedule',
    name: 'Pulse',
    description: 'Cron-based autonomous execution. Your agents run while you sleep.',
    status: 'available',
  },
  {
    id: 'relay',
    gap: 'No communication',
    name: 'Relay',
    description:
      'Built-in messaging. Telegram, webhooks, inter-agent channels. Your agents reach you.',
    status: 'available',
  },
  {
    id: 'mesh',
    gap: 'No coordination',
    name: 'Mesh',
    description: 'Agent discovery and network. Your agents find each other and collaborate.',
    status: 'available',
  },
  {
    id: 'console',
    gap: 'No oversight',
    name: 'Console',
    description: 'Browser-based command center. You see everything, from anywhere.',
    status: 'available',
  },
  {
    id: 'loop',
    gap: 'No feedback loop',
    name: 'Loop',
    description: 'Signal, hypothesis, dispatch, measure. Your agents improve.',
    status: 'available',
  },
  {
    id: 'wing',
    gap: 'No memory',
    name: 'Wing',
    description: 'Persistent context across sessions. Your agents remember.',
    status: 'coming-soon',
  },
]
