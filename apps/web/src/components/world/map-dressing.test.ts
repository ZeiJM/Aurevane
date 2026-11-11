import { expect, it, vi } from 'vitest'
import { GRID_HEIGHT, GRID_WIDTH, WORLD_REGIONS } from '@/world/catalog'
import { projectWorld } from '@/server/world/world-service'
import { warpedContinentSectors } from '@/server/world/warped-continent'
import { newWorldState, revealNearby } from '@/world/travel'
import type { WorldSectorView } from '@/world/types'
import { naturalDressing, sceneryDressing } from './map-dressing'

vi.mock('server-only', () => ({}))

const town = projectWorld(newWorldState(), [], 1000).sectors[0]!
const cells = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, index) => {
  const x = index % GRID_WIDTH
  const y = Math.floor(index / GRID_WIDTH)
  const terrain = x === 2 ? '~' : y === 4 ? '=' : '.'
  return { x, y, terrain, safe: x > 2, walkable: terrain !== '~' }
})
const market = { id: 'market', name: 'Market', x: 4, y: 3, kind: 'marketplace' } as const
const forge = { id: 'forge', x: 6, y: 3, width: 2, height: 2, artIndex: 2 }
const winter: WorldSectorView = {
  ...town,
  id: 'frostmere',
  townId: 'frostmere',
  regionId: 'frostmere',
  buildings: [forge],
  landmarks: [market],
  cells,
}

it('places Frostmere dressing on dry side ground without covering roads or authored sites', () => {
  const dressing = sceneryDressing(winter)
  expect(
    dressing.filter(({ sheet }) => sheet === 'settlement-dressing').map(({ index }) => index),
  ).toEqual([0, 1])
  expect(sceneryDressing(winter)).toEqual(dressing)
  for (const { x, y } of dressing) {
    expect(cells.find((cell) => cell.x === x && cell.y === y)?.terrain).toBe('.')
    expect(Math.abs(x - market.x) + Math.abs(y - market.y)).toBeGreaterThan(0)
    expect(
      x < forge.x || x >= forge.x + forge.width || y < forge.y || y >= forge.y + forge.height,
    ).toBe(true)
  }
  expect(sceneryDressing({ ...winter, townId: undefined, landmarks: [] })).toEqual([])
})

it('uses different art for woodland markets and coastal fishing gear', () => {
  expect(sceneryDressing({ ...winter, regionId: 'verdant-expanse' })[0]?.index).toBe(2)
  expect(sceneryDressing({ ...winter, regionId: 'hollow-coast' })[0]?.index).toBe(3)
})

it('draws private focal art only on the supplied known cell', () => {
  const warpedScenery = { x: 5, y: 3, index: 1, sheet: 'void-dressing' } as const
  const sector = { ...winter, charted: false, townId: undefined, warpedScenery }
  expect(sceneryDressing({ ...sector, warpedTheme: 'ashen' })).toMatchObject([warpedScenery])
  expect(sceneryDressing({ ...sector, charted: true, warpedTheme: 'ashen' })).toEqual([])
  expect(sceneryDressing({ ...sector, cells: [], warpedTheme: 'ashen' })).toEqual([])
})

it('gives all eight mainland town centres their own focal prop on projected ground', () => {
  const focal = WORLD_REGIONS.map(({ id }) => {
    const state = newWorldState()
    state.position = { sectorId: id, x: 6, y: 4 }
    const town = projectWorld(state, [], 1000).sectors.find((sector) => sector.id === id)!
    return sceneryDressing(town).find(({ sheet }) => sheet.startsWith('town-centres'))
  })
  expect(focal.every(Boolean)).toBe(true)
  expect(new Set(focal.map((prop) => prop && `${prop.sheet}:${prop.index}`)).size).toBe(8)
})

it('gives all thirteen private districts distinct compositions on known ground', () => {
  const signatures = warpedContinentSectors.map((sector) => {
    const state = revealNearby({
      ...newWorldState(),
      position: { sectorId: sector.id, x: 6, y: 4 },
      warpedPhase: 0,
    })
    const view = projectWorld(state, [], 1000).sectors.find((chunk) => chunk.id === sector.id)!
    const props = sceneryDressing(view)
    expect(props.length, sector.id).toBeGreaterThan(0)
    for (const { x, y } of props)
      expect(view.cells.some((cell) => cell.x === x && cell.y === y && cell.walkable)).toBe(true)
    expect(sceneryDressing({ ...view, cells: [] })).toEqual([])
    return props.map(({ sheet, index, x, y }) => `${sheet}:${index}@${x},${y}`).join('/')
  })
  expect(new Set(signatures).size).toBe(13)
})

it('uses different low vegetation in wild habitats and leaves roads, towns and hidden ground clear', () => {
  const wilderness = {
    ...winter,
    townId: undefined,
    landmarks: [],
    buildings: [],
    cells: cells.map((cell) => ({ ...cell, safe: false })),
  }
  const wetlands = naturalDressing({ ...wilderness, regionId: 'hollow-coast' })
  const dunes = naturalDressing({ ...wilderness, regionId: 'glasswind-desert' })
  expect(wetlands.some(({ index }) => index === 1)).toBe(true)
  expect(dunes.some(({ index }) => index === 3)).toBe(true)
  expect(wetlands.length).toBeLessThanOrEqual(2)
  expect(dunes.length).toBeLessThanOrEqual(2)
  expect(
    [...wetlands, ...dunes].every(({ x, y }) =>
      wilderness.cells.some((cell) => cell.x === x && cell.y === y && cell.terrain === '.'),
    ),
  ).toBe(true)
  expect(naturalDressing(winter)).toEqual([])
  expect(naturalDressing({ ...wilderness, cells: [] })).toEqual([])
})

it('assigns the four mainland hamlet families different working scenery', () => {
  const hamlets = ['Hayward Farmstead', "Millers' Rest", 'Thistledown Farm', 'Brookside Steading']
  const indices = hamlets.map(
    (name) =>
      sceneryDressing({
        ...winter,
        id: name,
        townId: undefined,
        landmarks: [{ ...market, kind: 'hamlet', name }],
      }).find(({ sheet }) => sheet === 'hamlet-dressing')?.index,
  )
  expect(indices).toEqual([0, 1, 2, 3])
})

it('reveals a fixed district prop only after its own ground is surveyed', () => {
  const marker = (x: number) => {
    const state = revealNearby({
      ...newWorldState(),
      position: { sectorId: 'uncharted-belfry', x, y: 4 },
      warpedPhase: 0,
    })
    const view = projectWorld(state, [], 1000).sectors.find((s) => s.id === 'uncharted-belfry')!
    return sceneryDressing(view).find(
      ({ sheet, index }) => sheet === 'void-dressing' && index === 1,
    )
  }
  expect(marker(0)).toBeUndefined()
  expect(marker(1)).toBeUndefined()
  expect(marker(3)).toMatchObject({ x: 5, y: 6 })
  expect(marker(6)).toEqual(marker(3))
})
