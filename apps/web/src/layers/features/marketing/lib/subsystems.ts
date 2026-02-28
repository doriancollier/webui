export interface Subsystem {
  id: string
  benefit: string
  name: string
  description: string
  status: 'available' | 'coming-soon'
}

export const subsystems: Subsystem[] = [
  {
    id: 'pulse',
    benefit: 'Makes agents work autonomously',
    name: 'Pulse',
    description: 'Set tasks on a timer. Your agents start working on schedule, even at 3am.',
    status: 'available',
  },
  {
    id: 'relay',
    benefit: 'Delivers messages between agents and humans',
    name: 'Relay',
    description:
      'Your agents send you updates \u2014 Telegram, text, whatever you use.',
    status: 'available',
  },
  {
    id: 'mesh',
    benefit: 'Connects agents to each other',
    name: 'Mesh',
    description: 'Your agents find each other and divide the work without you in the middle.',
    status: 'available',
  },
  {
    id: 'console',
    benefit: 'Dashboard for chat and system management',
    name: 'Console',
    description: 'A dashboard that shows what every agent is doing, from anywhere.',
    status: 'available',
  },
  {
    id: 'loop',
    benefit: 'Continuous improvement engine',
    name: 'Loop',
    description: 'Your agents spot what\u2019s working, test new ideas, and improve over time.',
    status: 'available',
  },
  {
    id: 'wing',
    benefit: 'Your personal productivity pack',
    name: 'Wing',
    description: 'Your agents keep context across sessions. Nothing gets forgotten.',
    status: 'coming-soon',
  },
]
