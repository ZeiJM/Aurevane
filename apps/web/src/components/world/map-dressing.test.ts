import { expect, it, vi } from 'vitest'
import { GRID_HEIGHT, GRID_WIDTH, WORLD_REGIONS } from '@/world/catalog'
import { projectWorld } from '@/server/world/world-service'
import { warpedContinentSectors } from '@/server/world/warped-continent'
import { newWorldState, revealNearby } from '@/world/travel'
import type { WorldSectorView } from '@/world/types'
import { naturalDressing, regionalScenery, sceneryDressing } from './map-dressing'

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

it('fills regional wilderness with stable local points of interest while leaving movement and private reveal intact', () => {
  const natural = {
    ...winter,
    id: 'scenic-field',
    townId: undefined,
    landmarks: [],
    buildings: [],
    cells: cells.map((c) => ({ ...c, safe: false, terrain: '.', walkable: true })),
  }
  while (regionalScenery(natural).length === 0) natural.id += 'x'
  const entries = [
    'verdant-expanse',
    'frostmere',
    'emberreach',
    'glasswind-desert',
    'hollow-coast',
    'starfall-highlands',
    'umbral-march',
  ].map((regionId) => {
    const sector = { ...natural, regionId }
    const props = regionalScenery(sector)
    expect(props).toHaveLength(1)
    expect(regionalScenery(sector)).toEqual(props)
    const prop = props[0]!
    expect(['regional-scenery', 'regional-scenery-extra']).toContain(prop.sheet)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        expect(
          sector.cells.some((c) => c.x === prop.x + dx && c.y === prop.y + dy && c.terrain === '.'),
        ).toBe(true)
    expect(regionalScenery({ ...sector, townId: 'town' })).toEqual([])
    expect(
      regionalScenery({
        ...sector,
        cells: sector.cells.map((c) => ({ ...c, terrain: '=', safe: true })),
      }),
    ).toEqual([])
    expect(regionalScenery({ ...sector, charted: false })).toEqual([])
    return `${prop.sheet}:${prop.index}`
  })
  expect(new Set(entries).size).toBe(7)
  const privateSector = { ...natural, charted: false, warpedTheme: 'ashen' as const }
  expect(regionalScenery(privateSector)[0]).toBeDefined()
  expect(regionalScenery({ ...privateSector, cells: [] })).toEqual([])
  expect(regionalScenery({ ...privateSector, cells: [natural.cells[0]!] })).toEqual([])
})

it('uses all twelve ordinary assets and sparse multi-tile celestial/time ruins, weighted toward the Void', () => {
  const natural = {
    ...winter,
    townId: undefined,
    landmarks: [],
    buildings: [],
    cells: cells.map((c) => ({ ...c, safe: false, terrain: '.', walkable: true })),
  }
  const ordinary = new Set<string>()
  const rare = new Set<number>()
  let voidRare = 0,
    ordinaryVoid = 0
  for (let i = 0; i < 160; i++) {
    for (const regionId of WORLD_REGIONS.map((r) => r.id)) {
      const prop = regionalScenery({ ...natural, id: `field-${i}-${i * 137}`, regionId })[0]
      if (!prop) continue
      if (prop.sheet === 'rare-scenery') {
        expect(prop.scale).toBeGreaterThan(2)
        rare.add(prop.index)
      } else ordinary.add(`${prop.sheet}:${prop.index}`)
    }
    const source = { ...natural, id: `private-${i}`, charted: false, warpedTheme: 'ashen' as const }
    const prop = regionalScenery(source)[0]
    if (!prop) continue
    expect(regionalScenery(source)).toEqual([prop])
    if (prop.sheet === 'rare-scenery') {
      voidRare++
      rare.add(prop.index)
      expect(prop.scale).toBeGreaterThan(2)
    } else {
      ordinaryVoid++
      ordinary.add(`${prop.sheet}:${prop.index}`)
    }
    expect(
      regionalScenery({
        ...source,
        cells: source.cells.filter((c) => c.x !== prop.x - 1 || c.y !== prop.y),
      }),
    ).not.toEqual([prop])
  }
  expect(ordinary.size).toBe(12)
  expect([...rare].sort()).toEqual([0, 1, 2, 3])
  expect(voidRare).toBeGreaterThan(0)
  expect(voidRare).toBeLessThan(ordinaryVoid)
})

it('never relocates already visible scenery as additional private ground is revealed', () => {
  const source = {
    ...winter,
    id: 'stable-scenery',
    charted: false,
    warpedTheme: 'ashen' as const,
    townId: undefined,
    landmarks: [],
    buildings: [],
    cells: cells.map((c) => ({ ...c, safe: false, terrain: '.', walkable: true })),
  }
  while (regionalScenery(source).length === 0) source.id += 'x'
  const complete = regionalScenery(source)
  let visible = 0
  for (let y = 2; y <= 6; y++)
    for (let x = 2; x <= 10; x++) {
      const partial = {
        ...source,
        cells: source.cells.filter((c) => Math.abs(c.x - x) <= 2 && Math.abs(c.y - y) <= 2),
      }
      const painted = regionalScenery(partial)
      for (const prop of painted) {
        expect(complete).toContainEqual(prop)
        visible++
      }
    }
  expect(visible).toBe(0)
  expect(regionalScenery(source)).toEqual(complete)
  expect(complete).toHaveLength(1)
})
