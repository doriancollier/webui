export interface TimelineEntry {
  id: string
  time: string
  paragraphs: string[]
}

export const timelineEntries: TimelineEntry[] = [
  {
    id: '1114pm',
    time: '11:14 PM',
    paragraphs: [
      'You queue three tasks. A test suite that needs expanding. A dependency upgrade across two services. A refactor you\u2019ve been putting off.',
      'You type one command. [PULSE] schedules all three.',
      'You close the laptop.',
    ],
  },
  {
    id: '1115pm',
    time: '11:15 PM',
    paragraphs: [
      'The first agent picks up the test suite. It reads the coverage report, identifies the gaps, starts writing.',
      'You are brushing your teeth.',
    ],
  },
  {
    id: '247am',
    time: '2:47 AM',
    paragraphs: [
      'CI breaks on the dependency upgrade. [PULSE] detects it. Dispatches an agent. The agent reads the error, traces the cause, opens a fix. Tests go green.',
      'Your phone buzzes once. A Telegram message from [RELAY]: \u201CCI was red. Fixed. PR #247 ready for review.\u201D',
      'You do not see it until morning.',
    ],
  },
  {
    id: '248am',
    time: '2:48 AM',
    paragraphs: [
      'The agent that fixed CI notices the test suite agent is working in the same service. [MESH] routes a coordination signal \u2014 one waits for the other to merge first, avoiding a conflict.',
      'No human involved. No terminal open.',
    ],
  },
  {
    id: '700am',
    time: '7:00 AM',
    paragraphs: [
      'You open your laptop. [CONSOLE] shows the night at a glance: three PRs ready for review, one CI fix merged, the refactor at 80% \u2014 waiting on a design question it queued for you. The overnight cost: $4.20 in API calls.',
    ],
  },
  {
    id: '704am',
    time: '7:04 AM',
    paragraphs: [
      'You approve two PRs. You request a change on the third. You queue two more tasks for the day.',
      'Your agents have been productive for eight hours. You have been awake for four minutes.',
    ],
  },
]
