import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld, projectWorldSector } from '@/server/world/world-service'
import { resolveSector } from '@/server/world/world-content'
import { atlasSectors } from '@/world/atlas'
import { newWorldState } from '@/world/travel'
import { grandBridgeArt, landmarkArtSize, lavaFallSite, waterfallArt } from './map-surface-art'

it('retains modest rural crossings and varies substantial town bridge art', () => {
  const view = projectWorld(newWorldState(), [], 1000)
  const town = view.sectors.find((s) => s.id === view.position.sectorId)!
  expect(grandBridgeArt({ ...town, regionId: 'aureth-crown' }, 2)).toBe(0)
  expect(grandBridgeArt({ ...town, townId: undefined, id: 'rural' }, 2)).toBeUndefined()
  expect(grandBridgeArt({ ...town, regionId: 'verdant-expanse' }, 3)).toBe(1)
  expect(grandBridgeArt({ ...town, regionId: 'frostmere' }, 3)).toBe(2)
})
it('proves lava cascade positions against actual known lava and keeps the bridge clear', () => {
  const state = { ...newWorldState(), position: { sectorId: 'emberreach', x: 6, y: 4 } }
  const sector = projectWorld(state, [], 1000).sectors.find((s) => s.id === 'emberreach')!
  const site = lavaFallSite(sector)
  expect(site).toEqual({ x: 10.5, y: 7.5, index: 1 })
  expect(lavaFallSite({ ...sector, cells: sector.cells.filter((c) => c.x !== 11) })).toBeUndefined()
  expect(
    lavaFallSite({
      ...sector,
      cells: sector.cells.map((c) => (c.terrain === 'l' ? { ...c, terrain: '~' } : c)),
    }),
  ).toBeUndefined()
})
it('chooses lush, alpine and volcanic cascade materials from geographic identity', () => {
  expect(waterfallArt('verdant-expanse')).toBe(0)
  expect(waterfallArt('frostmere')).toBe(1)
  expect(waterfallArt('emberreach')).toBe(2)
})

it('gives major shrines and ruins a broad footprint only on complete clear dry ground', () => {
  const view = projectWorld(newWorldState(), [], 1000)
  const shrine = {
    id: 'grand-shrine',
    name: 'Moonpetal Shrine',
    kind: 'shrine' as const,
    x: 6,
    y: 4,
  }
  const sector = {
    ...view.sectors[0]!,
    buildings: [],
    landmarks: [shrine],
    cells: Array.from({ length: 117 }, (_, index) => ({
      x: index % 13,
      y: Math.floor(index / 13),
      terrain: '.',
      safe: false,
      walkable: true,
    })),
  }
  expect(landmarkArtSize(sector, shrine, 1.55)).toBe(3.2)
  expect(landmarkArtSize(sector, { ...shrine, kind: 'ruin' }, 2.4)).toBe(3.2)
  expect(landmarkArtSize(sector, { ...shrine, kind: 'camp' }, 1.55)).toBe(1.55)
  expect(
    landmarkArtSize({ ...sector, cells: sector.cells.filter((c) => c.x !== 5) }, shrine, 1.55),
  ).toBe(1.55)
  for (const terrain of ['~', 'l', '#', '='])
    expect(
      landmarkArtSize(
        {
          ...sector,
          cells: sector.cells.map((c) => (c.x === 5 && c.y === 3 ? { ...c, terrain } : c)),
        },
        shrine,
        1.55,
      ),
    ).toBe(1.55)
  expect(
    landmarkArtSize(
      { ...sector, landmarks: [shrine, { ...shrine, id: 'nearby', x: 7 }] },
      shrine,
      1.55,
    ),
  ).toBe(1.55)
  expect(
    landmarkArtSize(
      { ...sector, buildings: [{ id: 'occupied', x: 5, y: 3, width: 2, height: 2, artIndex: 0 }] },
      shrine,
      1.55,
    ),
  ).toBe(1.55)
})

it('can render grand shrines on real mainland and Void ground without moving their anchors', () => {
  const mainland = atlasSectors().filter((s) => s.landmarks.some((l) => l.kind === 'shrine'))
  const voidShrine = resolveSector('void:ivory-veil:23:6')!
  for (const candidates of [mainland, [voidShrine]]) {
    const enlarged = candidates.some((sector) => {
      const state = {
        ...newWorldState(),
        position: { sectorId: sector.id, x: 6, y: 4 },
        discoveries: { [sector.id]: Array.from({ length: 117 }, (_, i) => i) },
      }
      const projected = projectWorldSector(state, sector)
      return projected.landmarks.some(
        (landmark) =>
          landmark.kind === 'shrine' && landmarkArtSize(projected, landmark, 1.55) === 3.2,
      )
    })
    expect(enlarged).toBe(true)
  }
})
