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
    interactions: [{ id: 'origin-conversation' }],
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
  expect(next.interactions).toEqual([])
  const ferry = { port: 'mainland', nextDepartureAt: 300_000, fareCrowns: 0 } as const
  const atDock = mergeWorldMovement(view, { ...receipt, ferry })
  expect(atDock.ferry).toEqual(ferry)
  expect(mergeWorldMovement(atDock, { ...receipt, version: 3 }).ferry).toBeUndefined()
  const arrivalTopics = [{ id: 'destination-conversation' }] as WorldView['interactions']
  expect(mergeWorldMovement(view, { ...receipt, interactions: arrivalTopics }).interactions).toBe(
    arrivalTopics,
  )
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

it('keeps public ground when a newly reached sector displaces the 25th authority sector', async () => {
  const { worldRenderTerrain } = await import('@/components/world/map-render-terrain')
  const { encodeTerrainRows } = await import('./terrain')
  const cells = Array.from({ length: 117 }, (_, index) => ({
    x: index % 13,
    y: Math.floor(index / 13),
    terrain: '.',
    walkable: true,
    safe: false,
  }))
  const sectors = Array.from({ length: 26 }, (_, index) => ({
    id: `public-${index}`,
    name: 'Supplied public ground',
    coordinate: 'Public',
    regionId: 'frostmere',
    east: index * 13,
    north: 0,
    art: null,
    atlasColumn: index,
    atlasRow: 0,
    charted: true,
    cells,
    landmarks: [],
    buildings: [],
    exits: [],
  })) as WorldView['sectors']
  const currentSector = sectors[25]!
  const view = {
    characterId: 'owner',
    version: 1,
    position: { sectorId: sectors[0]!.id, x: 6, y: 4 },
    sectors: sectors.slice(0, 25),
    scenery: [[currentSector.id, encodeTerrainRows(Array(9).fill('.'.repeat(13))), null, [], []]],
    atlas: sectors.map((sector) => ({
      id: sector.id,
      name: sector.name,
      coordinate: sector.coordinate,
      regionId: sector.regionId,
      column: sector.atlasColumn!,
      row: sector.atlasRow!,
      charted: true,
    })),
    players: [],
  } as unknown as WorldView
  const before = worldRenderTerrain(view)
  const receipt = {
    kind: 'movement' as const,
    characterId: 'owner',
    version: 2,
    serverNow: 1000,
    position: { sectorId: currentSector.id, x: 6, y: 4 },
    route: [],
    nextStepAt: null,
    movementBlocked: null,
    battleSessionId: null,
    currentSector,
  }
  const next = mergeWorldMovement(view, receipt)
  expect(next.sectors).toHaveLength(25)
  expect(next.scenery).toHaveLength(1)
  const after = worldRenderTerrain(next, before)
  expect(after.map((sector) => sector.id).sort()).toEqual(before.map((sector) => sector.id).sort())
  expect(after.find((sector) => sector.id === 'public-24')?.cells).toEqual(cells)
  expect(after.find((sector) => sector.id === 'public-24')?.exits).toEqual([])
  // A later explicit scene withdrawal still clears the demoted presentation.
  expect(worldRenderTerrain({ ...next, scenery: [] }, after)).toHaveLength(25)
  const privateView = {
    ...view,
    sectors: view.sectors.map((sector, index) =>
      index === 24 ? { ...sector, charted: false, cells: cells.slice(0, 3) } : sector,
    ),
  }
  const privateNext = mergeWorldMovement(privateView, receipt)
  expect(worldRenderTerrain(privateNext).some((sector) => sector.id === 'public-24')).toBe(false)
  const bounded = mergeWorldMovement(
    {
      ...view,
      scenery: Array.from({ length: 512 }, (_, index) => [
        `previous-${index}`,
        encodeTerrainRows(Array(9).fill('.'.repeat(13))),
        null,
        [],
        [],
      ]),
    },
    receipt,
  )
  expect(bounded.scenery).toHaveLength(512)
  expect(bounded.scenery?.[0]?.[0]).toBe('public-24')
})
