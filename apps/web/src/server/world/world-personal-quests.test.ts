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

const runId = '44444444-4444-4444-8444-444444444444'
const giverId = '55555555-5555-4555-8555-555555555555'
const giverPosition = { sectorId: 'verdant-expanse', x: 2, y: 4 }
const checkpoint = { sectorId: 'verdant-expanse', x: 3, y: 4 }
const restoration = {
  runId,
  title: 'The fragment mystery',
  body: 'Speak to the smith about the fragments.',
  discoveryClue: 'The two fragments fit together.',
  discovery: true,
  giverId,
  speaker: 'Restoration Smith',
  firstName: 'First Fragment',
  secondName: 'Second Fragment',
  outputName: 'Sanalex Sword',
  itemClaimPending: false,
  destination: giverPosition,
  progress: 'active',
  local: true,
  action: 'choose-restoration',
}

it('shows the projected recovery choice only at the giver and follows the selected checkpoint', () => {
  const offer = projectPersonalQuests([restoration])
  expect(offer.objectives).toEqual([
    expect.objectContaining({ progress: 'active', destination: giverPosition, autoPath: true }),
  ])
  expect(offer.interactions).toEqual([
    expect.objectContaining({
      speakerId: giverId,
      actionId: 'choose-restoration',
      actionLabel: 'Choose recovery route',
    }),
  ])

  const travelling = projectPersonalQuests([
    { ...restoration, destination: checkpoint, local: false, action: 'choose-restoration' },
  ])
  expect(travelling.objectives).toEqual([expect.objectContaining({ destination: checkpoint })])
  expect(travelling.interactions).toEqual([])
})

it('preserves the original discovery clue in the journal without replacing the giver dialogue', () => {
  const local = projectPersonalQuests([restoration])
  expect(local.objectives[0]?.description).toContain(restoration.discoveryClue)
  expect(local.interactions[0]?.body).toBe(restoration.body)
  const away = projectPersonalQuests([{ ...restoration, local: false, action: null }])
  expect(away.objectives[0]?.description).toContain(restoration.discoveryClue)
  expect(away.interactions).toEqual([])
})

it('offers a named and deliberate two-fragment hand-in only when the server says it is ready', () => {
  const action = { ...restoration, action: 'restore-item' }
  expect(projectPersonalQuests([action]).interactions[0]?.actionId).toBeNull()

  const ready = projectPersonalQuests([{ ...action, progress: 'ready' }])
  expect(ready.interactions).toEqual([
    expect.objectContaining({
      actionId: 'restore-item',
      actionLabel: 'Restore Sanalex Sword',
      confirmation: {
        prompt: 'Hand over 1 First Fragment and 1 Second Fragment to restore Sanalex Sword?',
        label: 'Confirm restoration',
        cancelLabel: 'Keep them for now',
      },
    }),
  ])
  expect(ready.objectives[0]?.description).toContain('1 First Fragment and 1 Second Fragment')
})

it('keeps an earned sword visible for collection until it is delivered', () => {
  const earned = { ...restoration, progress: 'completed', itemClaimPending: true }
  const away = projectPersonalQuests([{ ...earned, local: false, action: null }])
  expect(away.objectives).toEqual([
    expect.objectContaining({
      destination: giverPosition,
      autoPath: true,
      progress: 'ready',
      completed: false,
      description: expect.stringContaining('Sanalex Sword is reserved'),
    }),
  ])
  expect(away.interactions).toEqual([])
  const local = projectPersonalQuests([{ ...earned, action: 'claim-restoration' }])
  expect(local.interactions).toEqual([
    expect.objectContaining({
      actionId: 'claim-restoration',
      actionLabel: 'Collect Sanalex Sword',
    }),
  ])
  const delivered = projectPersonalQuests([
    { ...earned, itemClaimPending: false, destination: null, action: 'claim-restoration' },
  ])
  expect(delivered.objectives).toEqual([
    expect.objectContaining({ destination: null, autoPath: false, completed: true }),
  ])
  expect(delivered.interactions[0]?.actionId).toBeNull()
})
