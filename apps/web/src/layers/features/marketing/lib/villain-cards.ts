export interface VillainCard {
  id: string
  label: string
  body: string
}

export const villainCards: VillainCard[] = [
  {
    id: 'goldfish',
    label: 'The Goldfish',
    body: '\u201CLet me give you some context\u2026\u201D\n\nYou have typed this sentence hundreds of times. Every session begins at zero. Every session, you re-introduce yourself to something that was sharp and useful five minutes ago.',
  },
  {
    id: 'tab-graveyard',
    label: 'The Tab Graveyard',
    body: 'Ten agents. Ten terminals. One is waiting for approval. One finished twenty minutes ago. One is quietly breaking something.\n\nYou are the only thread between them.',
  },
  {
    id: 'dead-terminal',
    label: 'The Dead Terminal',
    body: 'Your agent finished at 11:47pm. Clean code. Tests passing. Then the terminal closed.\n\nYour best teammate shipped \u2014 and had no way to tell you.',
  },
  {
    id: '3am-build',
    label: 'The 3am Build',
    body: 'Tests broke at 2:47am. The fix was three lines. Your agent could have written them. Your terminal was closed.\n\nThe build stayed red until morning.',
  },
]
