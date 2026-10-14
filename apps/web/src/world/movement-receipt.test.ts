import { expect, it } from 'vitest'
import { mergeWorldMovement } from './movement-receipt'
import type { WorldView } from './types'
it('updates only confirmed owned movement and retains the loaded scene and peer clocks', () => {
  const view = {
    characterId: 'owner',
    version: 1,
    sectors: [],
    atlas: [],
    players: [{ attackable: true }],
    environment: {},
    position: { sectorId: 'a', x: 1, y: 1 },
  } as unknown as WorldView
  const receipt = {
    kind: 'movement' as const,
    characterId: 'owner',
    version: 2,
    serverNow: 200,
    position: { sectorId: 'a', x: 2, y: 1 },
    route: [],
    nextStepAt: null,
    routeObjectiveId: null,
    routeDestination: null,
    battleSessionId: null,
    movementBlocked: null,
  }
  const next = mergeWorldMovement(view, receipt)
  expect(next.sectors).toBe(view.sectors)
  expect(next.atlas).toBe(view.atlas)
  expect(next.environment).toBe(view.environment)
  expect(next.players[0]?.attackable).toBe(false)
  expect(next.position).toEqual(receipt.position)
  expect(() => mergeWorldMovement(view, { ...receipt, characterId: 'other' })).toThrow()
  expect(() => mergeWorldMovement(view, { ...receipt, version: 0 })).toThrow()
})
it('supplies a newly reached canonical sector before full scene hydration without inventing its origin', async () => {
  const { mapPoint } = await import('@/components/world/world-motion')
  const position = { sectorId: 'b', x: 0, y: 4 }
  const currentSector = {
    id: 'b',
    atlasColumn: 1,
    atlasRow: 0,
    cells: [{ x: 0, y: 4, walkable: true, safe: false }],
    exits: [],
  } as unknown as WorldView['sectors'][number]
  const view = {
    characterId: 'owner',
    version: 1,
    position: { sectorId: 'a', x: 12, y: 4 },
    sectors: [{ id: 'a', atlasColumn: 0, atlasRow: 0, cells: [], exits: [] }],
    atlas: [],
    players: [],
  } as unknown as WorldView
  const receipt = {
    kind: 'movement' as const,
    characterId: 'owner',
    version: 2,
    serverNow: 1000,
    position,
    route: [],
    nextStepAt: null,
    movementBlocked: null,
    battleSessionId: null,
    currentSector,
  }
  const next = mergeWorldMovement(view, receipt)
  expect(mapPoint(next.position, next.sectors).x).toBe(13.5)
  expect(next.sectors.find((sector) => sector.id === 'b')).toBe(currentSector)
})
