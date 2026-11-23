import { describe, expect, it } from 'vitest'
import { TRAIL_SECTORS, WILD_DOORS, WORLD_REGIONS } from './catalog'
import type { WorldSector } from './types'
import { isWalkable, positionKey } from './travel'
import { EDGE_TILE, MAP_DIRECTIONS, OPPOSITE, wildSectorId } from './wild-ids'
import { resolveWildSector, wildNeighbor } from './wilds'
import { parseWildId } from './wild-ids'

function reachable(sector: WorldSector, start: { x: number; y: number }) {
  const seen = new Set([`${start.x},${start.y}`])
  const queue = [start]
  while (queue.length) {
    const { x, y } = queue.shift()!
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = { x: x + dx, y: y + dy }
      if (!isWalkable(sector, next) || seen.has(`${next.x},${next.y}`)) continue
      seen.add(`${next.x},${next.y}`)
      queue.push(next)
    }
  }
  return seen
}
function checkSector(sector: WorldSector) {
  expect(sector.rows).toHaveLength(9)
  sector.rows.forEach((row) => expect(row).toHaveLength(13))
  const ends = sector.roads.map((road) => road.from)
  expect(ends.length).toBeGreaterThan(0)
  for (const end of ends) expect(isWalkable(sector, end)).toBe(true)
  const seen = reachable(sector, ends[0]!)
  for (const end of ends) expect(seen.has(`${end.x},${end.y}`)).toBe(true)
  for (const poi of sector.landmarks) {
    expect(isWalkable(sector, poi)).toBe(true)
    expect(seen.has(`${poi.x},${poi.y}`)).toBe(true)
  }
}

describe('generated world', () => {
  it('spaces every linked place apart with connected trail sectors that carry points of interest', () => {
    expect(TRAIL_SECTORS.length).toBeGreaterThanOrEqual(48)
    TRAIL_SECTORS.forEach(checkSector)
    expect(TRAIL_SECTORS.some((s) => s.landmarks.length > 0)).toBe(true)
    expect(TRAIL_SECTORS.some((s) => s.rows.some((r) => r.includes('~')))).toBe(true)
  })

  it('opens every region edge without an authored road onto endless wilds', () => {
    expect(WILD_DOORS.length).toBeGreaterThanOrEqual(WORLD_REGIONS.length)
    for (const door of WILD_DOORS) {
      for (const [k, b] of [
        [1, 0],
        [2, 0],
        [5, 0],
        [3, -2],
        [4, 2],
        [40, 0],
        [3, 30],
      ] as const) {
        const id = wildSectorId({ ...door, k, b })
        const sector = resolveWildSector(id)
        if (!sector) {
          expect(door.root === 'hollow-coast' && b > 0).toBe(true)
          continue
        }
        checkSector(sector)
        expect(sector.regionId).toBe(door.root)
        expect(sector.generated).toBe(true)
        expect(resolveWildSector(id)).toBe(sector)
      }
    }
  })

  it('is deterministic and joins neighbouring sectors back to each other', () => {
    const door = WILD_DOORS[0]!
    const address = { ...door, k: 3, b: 1 }
    const id = wildSectorId(address)
    expect(JSON.stringify(resolveWildSector(id))).toBe(JSON.stringify(resolveWildSector(id)))
    const sector = resolveWildSector(id)!
    for (const road of sector.roads) {
      const back = resolveWildSector(road.to.sectorId)
      if (!back) continue
      expect(back.roads.some((r) => positionKey(r.to) === positionKey(road.from))).toBe(true)
      expect(positionKey(road.to)).toBe(
        positionKey({
          sectorId: road.to.sectorId,
          ...EDGE_TILE[
            OPPOSITE[
              MAP_DIRECTIONS.find(
                (d) => EDGE_TILE[d].x === road.from.x && EDGE_TILE[d].y === road.from.y,
              )!
            ]
          ],
        }),
      )
    }
    expect(parseWildId(id)).toEqual(address)
    expect(parseWildId('wild:verdant-expanse:west:0:0')).toBeNull()
    expect(wildNeighbor({ ...door, k: 1, b: 0 }, OPPOSITE[door.dir])).toEqual({
      regionId: door.root,
    })
  })

  it('never opens the sea south of the Hollow Coast onto walkable wilds', () => {
    expect(WILD_DOORS.some((d) => d.root === 'hollow-coast' && d.dir === 'south')).toBe(false)
  })
})
