import { describe, expect, it } from 'vitest'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import type { WorldSectorView } from '@/world/types'
import { buildBiomeTransitions } from './map-biome-transitions'

function sector(id: string, column: number, row: number, regionId = 'verdant-expanse') {
  return {
    id,
    regionId,
    charted: true,
    atlasColumn: column,
    atlasRow: row,
    cells: Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, i) => ({
      x: i % GRID_WIDTH,
      y: Math.floor(i / GRID_WIDTH),
      terrain: '.',
      walkable: true,
      safe: false,
    })),
  } as WorldSectorView
}

describe('known public biome boundary transitions', () => {
  it.each([
    [0, 0, -1, 2, GRID_WIDTH],
    [1, 1, 0, 3, GRID_HEIGHT],
    [2, 0, 1, 0, GRID_WIDTH],
    [3, -1, 0, 1, GRID_HEIGHT],
  ] as const)(
    'feathers side %s with the same shared span on its opposite side',
    (side, dx, dy, opposite, length) => {
      const own = sector('own', 10, 10)
      const other = sector('other', 10 + dx, 10 + dy, 'umbral-march')
      const transitions = buildBiomeTransitions([own, other])
      expect(transitions.get(own.id)?.edges).toEqual([
        { regionId: other.regionId, side, from: 0, to: length, width: 3 },
      ])
      expect(transitions.get(other.id)?.edges).toEqual([
        { regionId: own.regionId, side: opposite, from: 0, to: length, width: 3 },
      ])
    },
  )

  it('does not introduce transitions inside one biome', () => {
    const own = sector('own', 10, 10)
    const other = sector('other', 11, 10)
    expect(buildBiomeTransitions([own, other]).get(own.id)?.edges).toEqual([])
    expect(buildBiomeTransitions([own, other]).get(other.id)?.edges).toEqual([])
  })

  it('does not blend into absent, private, unpositioned, or nonadjacent sectors', () => {
    const own = sector('own', 10, 10)
    const privateNeighbor = { ...sector('private', 11, 10, 'umbral-march'), charted: false }
    const unpositioned = { ...sector('unknown', 9, 10, 'umbral-march'), atlasColumn: undefined }
    const distant = sector('distant', 12, 10, 'umbral-march')
    const transitions = buildBiomeTransitions([own, privateNeighbor, unpositioned, distant])
    for (const entry of transitions.values()) expect(entry.edges).toEqual([])
    expect(buildBiomeTransitions([own]).get(own.id)?.edges).toEqual([])
  })

  it('splits paired dry runs around water, lava, and missing boundary cells', () => {
    const own = sector('own', 10, 10)
    const other = sector('other', 11, 10, 'umbral-march')
    own.cells.find((cell) => cell.x === GRID_WIDTH - 1 && cell.y === 2)!.terrain = '~'
    other.cells.find((cell) => cell.x === 0 && cell.y === 4)!.terrain = 'l'
    other.cells = other.cells.filter((cell) => cell.x !== 0 || cell.y !== 6)
    const transitions = buildBiomeTransitions([own, other])
    const runs = [
      { from: 0, to: 2 },
      { from: 3, to: 4 },
      { from: 5, to: 6 },
      { from: 7, to: GRID_HEIGHT },
    ]
    expect(transitions.get(own.id)?.edges).toEqual(
      runs.map((run) => ({ regionId: other.regionId, side: 1, width: 3, ...run })),
    )
    expect(transitions.get(other.id)?.edges).toEqual(
      runs.map((run) => ({ regionId: own.regionId, side: 3, width: 3, ...run })),
    )
  })

  it.each([
    [127, 0, 1, 3],
    [0, 127, 3, 1],
  ] as const)(
    'matches both sides of the longitude seam from column %s',
    (column, neighbor, side, opposite) => {
      const own = sector('own', column, 12)
      const other = sector('other', neighbor, 12, 'umbral-march')
      const transitions = buildBiomeTransitions([own, other])
      expect(transitions.get(own.id)?.edges).toEqual([
        { regionId: other.regionId, side, from: 0, to: GRID_HEIGHT, width: 3 },
      ])
      expect(transitions.get(other.id)?.edges[0]?.side).toBe(opposite)
    },
  )

  it('never wraps the northern and southern atlas boundaries together', () => {
    const north = sector('north', 10, 0)
    const south = sector('south', 10, 63, 'umbral-march')
    for (const entry of buildBiomeTransitions([north, south]).values())
      expect(entry.edges).toEqual([])
  })

  it('invalidates cached material when a neighbor loads, changes region, or changes boundary terrain', () => {
    const own = sector('own', 10, 10)
    const other = sector('other', 11, 10, 'umbral-march')
    const key = (sectors: WorldSectorView[]) => buildBiomeTransitions(sectors).get(own.id)!.key
    const unloaded = key([own])
    const loaded = key([own, other])
    expect(loaded).not.toBe(unloaded)
    expect(key([other, own])).toBe(loaded)
    expect(key([own, { ...other, regionId: 'frostmere' }])).not.toBe(loaded)
    other.cells.find((cell) => cell.x === 0 && cell.y === 2)!.terrain = '~'
    expect(key([own, other])).not.toBe(loaded)
    expect(key([{ ...own, regionId: 'emberreach' }, other])).not.toBe(key([own, other]))
  })
})

describe('four-sector biome corners', () => {
  function meeting(column = 10) {
    return [
      sector('own', column, 10),
      sector('north', column, 9, 'umbral-march'),
      sector('east', (column + 1) % 128, 10, 'frostmere'),
      sector('diagonal', (column + 1) % 128, 9, 'emberreach'),
    ]
  }
  it('mirrors the same four materials across every quadrant of a shared corner', () => {
    const transitions = buildBiomeTransitions(meeting())
    for (const [
      id,
      horizontalSide,
      verticalSide,
      horizontalRegionId,
      verticalRegionId,
      diagonalRegionId,
    ] of [
      ['own', 0, 1, 'umbral-march', 'frostmere', 'emberreach'],
      ['north', 2, 1, 'verdant-expanse', 'emberreach', 'frostmere'],
      ['east', 0, 3, 'emberreach', 'verdant-expanse', 'umbral-march'],
      ['diagonal', 2, 3, 'frostmere', 'umbral-march', 'verdant-expanse'],
    ] as const)
      expect(transitions.get(id)?.corners).toEqual([
        {
          horizontalSide,
          verticalSide,
          horizontalRegionId,
          verticalRegionId,
          diagonalRegionId,
          width: 3,
        },
      ])
  })

  it('includes a diagonal-only material change while omitting identical-biome corners', () => {
    const sectors = meeting().map((entry) => ({ ...entry, regionId: 'verdant-expanse' }))
    for (const entry of buildBiomeTransitions(sectors).values()) expect(entry.corners).toEqual([])
    sectors[3]!.regionId = 'emberreach'
    const own = buildBiomeTransitions(sectors).get('own')!
    expect(own.edges).toEqual([])
    expect(own.corners).toEqual([
      {
        horizontalSide: 0,
        verticalSide: 1,
        horizontalRegionId: 'verdant-expanse',
        verticalRegionId: 'verdant-expanse',
        diagonalRegionId: 'emberreach',
        width: 3,
      },
    ])
  })

  it('waits for known public horizontal, vertical, and diagonal neighbors', () => {
    const sectors = meeting()
    for (let missing = 0; missing < 4; missing++) {
      expect(
        buildBiomeTransitions(sectors.filter((_, index) => index !== missing)).get('own')
          ?.corners ?? [],
      ).toEqual([])
      const privateSectors = sectors.map((entry, index) =>
        index === missing ? { ...entry, charted: false } : entry,
      )
      expect(buildBiomeTransitions(privateSectors).get('own')!.corners).toEqual([])
    }
  })

  it.each(['~', 'l', undefined])('excludes a corner whose meeting cell is %s', (terrain) => {
    for (const [index, x, y] of [
      [0, 12, 0],
      [1, 12, 8],
      [2, 0, 0],
      [3, 0, 8],
    ]) {
      const sectors = meeting()
      const affected = sectors[index!]!
      affected.cells = affected.cells.filter((cell) => cell.x !== x || cell.y !== y)
      if (terrain !== undefined)
        affected.cells.push({ x: x!, y: y!, terrain, walkable: false, safe: false })
      for (const entry of buildBiomeTransitions(sectors).values()) expect(entry.corners).toEqual([])
    }
  })

  it('tracks diagonal arrival, material change, and wetness in the cache key', () => {
    const sectors = meeting()
    const key = (entries: WorldSectorView[]) => buildBiomeTransitions(entries).get('own')!.key
    const loaded = key(sectors)
    expect(key(sectors.slice(0, 3))).not.toBe(loaded)
    expect(key([...sectors].reverse())).toBe(loaded)
    expect(
      key(
        sectors.map((entry) =>
          entry.id === 'diagonal' ? { ...entry, regionId: 'frostmere' } : entry,
        ),
      ),
    ).not.toBe(loaded)
    sectors[3]!.cells.find((cell) => cell.x === 0 && cell.y === 8)!.terrain = '~'
    expect(key(sectors)).not.toBe(loaded)
  })

  it('mirrors diagonal corners across the longitude seam without polar wrapping', () => {
    const wrapped = buildBiomeTransitions(meeting(127))
    expect(wrapped.get('own')!.corners[0]).toMatchObject({
      horizontalSide: 0,
      verticalSide: 1,
      diagonalRegionId: 'emberreach',
    })
    expect(wrapped.get('diagonal')!.corners[0]).toMatchObject({
      horizontalSide: 2,
      verticalSide: 3,
      diagonalRegionId: 'verdant-expanse',
    })
    const polar = meeting().map((entry) => ({ ...entry, atlasRow: entry.atlasRow === 10 ? 0 : 63 }))
    for (const entry of buildBiomeTransitions(polar).values()) expect(entry.corners).toEqual([])
  })
})
