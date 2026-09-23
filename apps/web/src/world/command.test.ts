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
  ])
    expect(parseWorldCommand(input)).toBeNull()
})

it('requires the character the command was prepared for', () => {
  expect(
    parseWorldCommand({ expectedVersion: 1, commandId: base.commandId, intent: { kind: 'stop' } }),
  ).toBeNull()
})
