import { expect, it, vi } from 'vitest'
import { sceneryDressing, naturalDressing } from './map-dressing'
import { atlasSectors } from '@/world/atlas'
import { settlementComposition } from './map-settlement-composition'
import { WORLD_REGIONS, GRID_WIDTH, GRID_HEIGHT } from '@/world/catalog'
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import type { WorldSectorView } from '@/world/types'
vi.mock('server-only', () => ({}))
it('adds distinct regional supporting compositions to all eight existing town centres', () => {
  const signatures = WORLD_REGIONS.map(({ id }) => {
    const state = { ...newWorldState(), position: { sectorId: id, x: 6, y: 4 } }
    const sector = projectWorld(state, [], 1000).sectors.find((s) => s.id === id)!
    const before = structuredClone(sector),
      props = settlementComposition(sector)
    expect(props.length, id).toBeGreaterThan(0)
    expect(props.length).toBeLessThanOrEqual(3)
    for (const prop of props) {
      expect(sector.cells.find((c) => c.x === prop.x && c.y === prop.y)?.terrain).toBe('.')
      expect(
        sector.landmarks.every((l) => Math.abs(l.x - prop.x) + Math.abs(l.y - prop.y) >= 2),
      ).toBe(true)
    }
    expect(sector).toEqual(before)
    return props.map((p) => `${p.sheet}:${p.index}`).join('/')
  })
  expect(new Set(signatures).size).toBe(8)
})
it('uses deterministic hamlet yards without placing props on roads, water or hidden scenes', () => {
  const initial = projectWorld(newWorldState(), [], 1000).sectors[0]!
  const sector: WorldSectorView = {
    ...initial,
    id: 'atlas:46:26',
    townId: undefined,
    regionId: 'aureth-crown',
    charted: true,
    landmarks: [{ id: 'h', name: 'Hayward Farmstead', kind: 'hamlet', x: 6, y: 4 }],
    buildings: [],
    cells: Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, i) => ({
      x: i % GRID_WIDTH,
      y: Math.floor(i / GRID_WIDTH),
      terrain: i % GRID_WIDTH === 2 ? '~' : Math.floor(i / GRID_WIDTH) === 3 ? '=' : '.',
      walkable: i % GRID_WIDTH !== 2,
      safe: false,
    })),
  }
  const props = settlementComposition(sector)
  expect(props.length).toBe(2)
  expect(settlementComposition(structuredClone(sector))).toEqual(props)
  for (const { x, y } of props)
    expect(sector.cells.find((c) => c.x === x && c.y === y)?.terrain).toBe('.')
  for (const altered of [
    { ...sector, charted: false },
    { ...sector, id: 'ferry:one' },
    { ...sector, warpedTheme: 'ashen' as const },
    { ...sector, cells: [] },
  ])
    expect(settlementComposition(altered)).toEqual([])
})

it('keeps new working yards clear of existing props in every public town and hamlet', () => {
  const sectors = atlasSectors().filter(
    (s) => s.id === s.townId || s.landmarks.some((l) => l.kind === 'hamlet'),
  )
  expect(sectors.length).toBe(80)
  for (const original of sectors) {
    const state = { ...newWorldState(), position: { sectorId: original.id, x: 6, y: 4 } }
    const sector = projectWorld(state, [], 1000).sectors.find((s) => s.id === original.id)!
    const reserved = [...sceneryDressing(sector), ...naturalDressing(sector)]
    for (const prop of settlementComposition(sector))
      expect(
        reserved.every((p) => Math.abs(p.x - prop.x) + Math.abs(p.y - prop.y) >= 3),
        `${sector.id} ${prop.x}:${prop.y}`,
      ).toBe(true)
  }
})
