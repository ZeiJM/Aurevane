import { expect, it, vi } from 'vitest'
import { projectPersonalQuests } from './world-personal-quests'

vi.mock('server-only', () => ({}))

it('projects a revealed inventory clue to the owned journal without offering an interaction', () => {
  const runId = '44444444-4444-4444-8444-444444444444'
  const title = 'The fragment mystery'
  const body = 'The two fragments fit together.'
  const clue = { runId, title, body, discovery: true }
  expect(projectPersonalQuests([clue])).toEqual({
    objectives: [
      {
        id: `quest-run-${runId}`,
        name: title,
        description: body,
        kind: 'quest',
        authority: 'personal-quest',
        autoPath: false,
        guidance: 'clue',
        destination: null,
        completed: false,
        progress: 'active',
      },
    ],
    interactions: [],
  })
  expect(
    projectPersonalQuests([{ ...clue, discovery: false, firstItemId: 'secret.fragment' }]),
  ).toEqual({ objectives: [], interactions: [] })
})
