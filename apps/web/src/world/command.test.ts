import { expect, it } from 'vitest'
import { parseWorldCommand, parseWorldRoutePreviewRequest } from './command'
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


it('accepts a bounded read-only route preview request without a command id or client state', () => {
  expect(
    parseWorldRoutePreviewRequest({
      operation: 'preview-route',
      characterId: base.characterId,
      expectedVersion: 1,
      destination: { sectorId: 'verdant-expanse', x: 6, y: 4 },
      state: { route: ['forged'] },
    }),
  ).toEqual({
    operation: 'preview-route',
    characterId: base.characterId,
    expectedVersion: 1,
    destination: { sectorId: 'verdant-expanse', x: 6, y: 4 },
  })
})

it('rejects malformed route preview requests', () => {
  for (const input of [
    null,
    {},
    {
      operation: 'preview-route',
      characterId: base.characterId,
      expectedVersion: 0,
      destination: { sectorId: 'verdant-expanse', x: 6, y: 4 },
    },
    {
      operation: 'preview-route',
      characterId: 'not-a-uuid',
      expectedVersion: 1,
      destination: { sectorId: 'verdant-expanse', x: 6, y: 4 },
    },
    {
      operation: 'preview-route',
      characterId: base.characterId,
      expectedVersion: 1,
      destination: { sectorId: 'verdant-expanse', x: 13, y: 4 },
    },
  ])
    expect(parseWorldRoutePreviewRequest(input)).toBeNull()
})

it('requires the character the command was prepared for', () => {
  expect(
    parseWorldCommand({ expectedVersion: 1, commandId: base.commandId, intent: { kind: 'stop' } }),
  ).toBeNull()
})
