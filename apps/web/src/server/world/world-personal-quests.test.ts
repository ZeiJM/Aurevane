import { expect, it, vi } from 'vitest'
import { projectPersonalQuests, projectRepeatableTravel } from './world-personal-quests'

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
it('shows owned hunt progress and keeps a pending XP reward visible alongside its cooldown', () => {
  const hunt = {
    runId,
    title: 'Alder Venn’s Wolf Hunt',
    body: 'Follow the tracks beyond the farms.',
    giverId,
    speaker: 'Alder Venn',
    progress: 'active',
    defeats: 3,
    requiredDefeats: 5,
    local: true,
  }
  const active = projectRepeatableTravel([hunt])
  expect(active.objectives[0]?.description).toContain('3 of 5 qualifying defeats.')
  expect(active.interactions[0]?.body).toContain('3 of 5 qualifying defeats.')
  const pending = projectRepeatableTravel([
    {
      ...hunt,
      progress: 'completed',
      defeats: 5,
      action: 'claim-hunt-reward',
      rewardPending: true,
      destination: giverPosition,
      nextAvailableAt: '2026-11-08T00:00:00Z',
    },
  ])
  expect(pending.objectives[0]).toMatchObject({
    progress: 'ready',
    destination: giverPosition,
    description: expect.stringContaining('Available again'),
  })
  expect(pending.interactions[0]).toMatchObject({
    actionId: 'claim-hunt-reward',
    actionLabel: 'Collect Character XP',
  })
})
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
  outputName: 'Cinderwake',
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

it('offers the trial as a distinct private choice while keeping recovery as the primary reply', () => {
  const trialOffer = 'You may also prove your skill against the forge champion.'
  const authored = {
    ...restoration,
    trialOffer,
    alternativeAction: 'choose-restoration-trial',
    trialNpcRevisionId: 'private revision',
  }
  const local = projectPersonalQuests([authored])
  expect(local.interactions).toEqual([
    expect.objectContaining({
      actionId: 'choose-restoration',
      actionLabel: 'Choose recovery route',
      alternative: { actionId: 'choose-restoration-trial', label: 'Choose trial route' },
    }),
  ])
  expect(local.objectives[0]?.description).toContain(trialOffer)
  expect(JSON.stringify(local)).not.toContain(authored.trialNpcRevisionId)

  const away = projectPersonalQuests([{ ...authored, local: false, action: null }])
  expect(away.objectives[0]?.description).toContain(trialOffer)
  expect(away.interactions).toEqual([])
  for (const unqualified of [
    projectPersonalQuests([{ ...authored, discovery: false }]),
    projectRepeatableTravel([authored]),
  ]) {
    expect(JSON.stringify(unqualified)).not.toContain(trialOffer)
    expect(JSON.stringify(unqualified)).not.toContain('choose-restoration-trial')
  }
})

it('uses the projected trial opponent until an authoritative result returns the quest to the giver', () => {
  const underway = projectPersonalQuests([
    {
      ...restoration,
      body: 'Talk to the forge champion and choose Challenge.',
      destination: checkpoint,
      local: false,
      action: null,
    },
  ])
  expect(underway.objectives).toEqual([
    expect.objectContaining({
      description: expect.stringContaining('choose Challenge'),
      destination: checkpoint,
      autoPath: true,
      progress: 'active',
    }),
  ])
  expect(underway.interactions).toEqual([])

  const won = projectPersonalQuests([
    {
      ...restoration,
      body: 'Return to the smith with your fragments.',
      progress: 'ready',
      action: 'restore-item',
    },
  ])
  expect(won.objectives).toEqual([
    expect.objectContaining({ destination: giverPosition, progress: 'ready' }),
  ])
  expect(won.interactions[0]).toMatchObject({
    actionId: 'restore-item',
    confirmation: { label: 'Confirm restoration' },
  })
  expect(won.interactions[0]).not.toHaveProperty('alternative')
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
      actionLabel: 'Restore Cinderwake',
      confirmation: {
        prompt: 'Hand over 1 First Fragment and 1 Second Fragment to restore Cinderwake?',
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
      description: expect.stringContaining('Cinderwake is reserved'),
    }),
  ])
  expect(away.interactions).toEqual([])
  const local = projectPersonalQuests([{ ...earned, action: 'claim-restoration' }])
  expect(local.interactions).toEqual([
    expect.objectContaining({
      actionId: 'claim-restoration',
      actionLabel: 'Collect Cinderwake',
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
