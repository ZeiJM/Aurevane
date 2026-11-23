import { expect, it } from 'vitest'
import { parseWorldCommand } from './command'
const base = {
  characterId: '00000000-0000-4000-8000-000000000011',
  expectedVersion: 1,
  commandId: '00000000-0000-4000-8000-000000000001',
}
it('accepts intent but never accepts client state', () => {
  expect(
    parseWorldCommand({
      ...base,
      intent: { kind: 'walk', destination: { sectorId: 'verdant-expanse', x: 5, y: 4 } },
      state: { reward: 99 },
    }),
  ).toEqual({
    ...base,
    intent: { kind: 'walk', destination: { sectorId: 'verdant-expanse', x: 5, y: 4 } },
  })
})
it('accepts bounded local interaction intent', () => {
  expect(
    parseWorldCommand({
      ...base,
      intent: { kind: 'interact', interactionId: 'eastern-watch-officer' },
    }),
  ).toEqual({
    ...base,
    intent: { kind: 'interact', interactionId: 'eastern-watch-officer' },
  })
})

it('keeps the selected dialogue reply explicit at the command boundary', () => {
  const intent = { kind: 'interact', interactionId: 'eastern-watch-officer', actionId: 'accept' }
  expect(parseWorldCommand({ ...base, intent })?.intent).toEqual(intent)
  expect(parseWorldCommand({ ...base, intent: { ...intent, actionId: 'continue' } })).toBeNull()
})

it.each(['challenge-avenger', 'claim-avenger-reward'])(
  'allows %s only for an explicit private encounter ticket',
  (actionId) => {
    const ticket = '00000000-0000-4000-8000-000000000047'
    const intent = { kind: 'interact', interactionId: `avenger-${ticket}`, actionId }
    expect(parseWorldCommand({ ...base, intent: { ...intent, npcId: base.characterId } })).toEqual({
      ...base,
      intent,
    })
    expect(
      parseWorldCommand({ ...base, intent: { ...intent, interactionId: `quest-run-${ticket}` } }),
    ).toBeNull()
  },
)

it('accepts hunt reward collection only for a repeatable attempt and ignores a caller-supplied reward', () => {
  const actionId = 'claim-hunt-reward'
  const intent = {
    kind: 'interact',
    interactionId: 'repeatable-travel-00000000-0000-4000-8000-000000000047',
    actionId,
  }
  expect(parseWorldCommand({ ...base, intent: { ...intent, awardedXp: 999 } })).toEqual({
    ...base,
    intent,
  })
  expect(
    parseWorldCommand({
      ...base,
      intent: { ...intent, interactionId: 'quest-run-00000000-0000-4000-8000-000000000047' },
    }),
  ).toBeNull()
})

it('rejects malformed and unbounded commands', () => {
  for (const input of [
    null,
    {},
    { ...base, expectedVersion: -1, intent: { kind: 'stop' } },
    {
      ...base,
      intent: { kind: 'walk', destination: { sectorId: 'verdant-expanse', x: 13, y: 4 } },
    },
    { ...base, intent: { kind: 'attack', targetId: 'not-a-uuid' } },
    { ...base, intent: { kind: 'interact', interactionId: '' } },
    { ...base, intent: { kind: 'interact', interactionId: 'A'.repeat(101) } },
  ])
    expect(parseWorldCommand(input)).toBeNull()
})

it('requires the character the command was prepared for', () => {
  expect(
    parseWorldCommand({ expectedVersion: 1, commandId: base.commandId, intent: { kind: 'stop' } }),
  ).toBeNull()
})

it('allows a quest reply to name the exchange action without taking quantities or item IDs from the caller', () => {
  const interactionId = 'quest-run-00000000-0000-4000-8000-000000000017'
  for (const actionId of ['hand-over', 'claim-exchange']) {
    const intent = { kind: 'interact', interactionId, actionId }
    expect(
      parseWorldCommand({ ...base, intent: { ...intent, itemId: 'forged.item', quantity: 999 } }),
    ).toEqual({ ...base, intent })
  }
})

it.each(['choose-restoration', 'choose-restoration-trial', 'restore-item', 'claim-restoration'])(
  'accepts %s only as a personal quest intent, never caller-chosen materials',
  (actionId) => {
    const interactionId = 'quest-run-00000000-0000-4000-8000-000000000017'
    const intent = { kind: 'interact', interactionId, actionId }
    expect(
      parseWorldCommand({
        ...base,
        intent: {
          ...intent,
          fragments: ['forged.item'],
          outputItemId: 'forged.sword',
          battleSessionId: '00000000-0000-4000-8000-000000000044',
          victory: true,
        },
      }),
    ).toEqual({ ...base, intent })
    expect(
      parseWorldCommand({ ...base, intent: { ...intent, interactionId: 'eastern-watch-officer' } }),
    ).toBeNull()
  },
)
