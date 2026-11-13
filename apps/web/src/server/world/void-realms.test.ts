import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import {
  VOID_REALMS,
  VOID_REALM_COLUMNS,
  VOID_REALM_ROWS,
  isVoidRealmSectorId,
  parseVoidSectorId,
  voidSectorId,
} from '@/world/void-realms'
import { findWorldRoute, isSafe, isWalkable } from '@/world/travel'
import type { WorldSector } from '@/world/types'
import { resolveVoidSector, voidRealmLanding, voidRealmScenery } from './void-realms'

const sectorsFor = (id: (typeof VOID_REALMS)[number]['id']) =>
  Array.from({ length: VOID_REALM_ROWS }, (_, row) =>
    Array.from({ length: VOID_REALM_COLUMNS }, (_, column) =>
      resolveVoidSector(voidSectorId(id, column, row))!,
    ),
  ).flat()

// Same support contract as bridge placement: '=' over a continuous liquid
// corridor, both banks supplied and walkable, no more than nine crossing cells.
function supportedBridge(
  sector: WorldSector,
  x: number,
  y: number,
  lookup?: ReadonlyMap<string, WorldSector>,
) {
  const at = (cx: number, cy: number) => {
    if (cx >= 0 && cx < 13 && cy >= 0 && cy < 9) return sector.rows[cy]?.[cx]
    if (!lookup) return undefined
    const address = parseVoidSectorId(sector.id)!
    const column = address.column + Math.floor(cx / 13),
      row = address.row + Math.floor(cy / 9)
    if (column < 0 || column >= VOID_REALM_COLUMNS || row < 0 || row >= VOID_REALM_ROWS)
      return undefined
    return lookup.get(voidSectorId(address.realmId, column, row))?.rows[((cy % 9) + 9) % 9]?.[
      ((cx % 13) + 13) % 13
    ]
  }
  const liquid = (tile: string | undefined) => tile === '~' || tile === 'l'
  const walkable = (tile: string | undefined) => tile !== undefined && '.st='.includes(tile)
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
  ]) {
    const crossing = (cx: number, cy: number) => {
      if (at(cx, cy) !== '=') return false
      const sides = [-1, 1].map((sign) => {
        for (let distance = 1; distance <= 4; distance++) {
          const tile = at(cx + dy! * sign * distance, cy + dx! * sign * distance)
          if (liquid(tile)) return tile
          if (tile !== '=') break
        }
        return null
      })
      return sides[0] !== null && sides[0] === sides[1]
    }
    if (!crossing(x, y)) continue
    let before = 0,
      after = 0
    while (before < 5 && crossing(x - (before + 1) * dx!, y - (before + 1) * dy!)) before++
    while (after < 5 && crossing(x + (after + 1) * dx!, y + (after + 1) * dy!)) after++
    if (before === 5 || after === 5) continue
    const a = at(x - (before + 1) * dx!, y - (before + 1) * dy!)
    const b = at(x + (after + 1) * dx!, y + (after + 1) * dy!)
    if (walkable(a) && walkable(b) && !liquid(a) && !liquid(b)) return true
  }
  return false
}

describe('authored private Void worlds', () => {
  it('keeps only public identities and strict bounded addresses in the browser catalog', () => {
    expect(VOID_REALMS).toHaveLength(8)
    expect(new Set(VOID_REALMS.map((realm) => realm.id)).size).toBe(8)
    for (const realm of VOID_REALMS)
      expect(Object.keys(realm).sort()).toEqual(['id', 'name', 'summary'])
    expect(VOID_REALM_COLUMNS * VOID_REALM_ROWS * 13 * 9).toBe(359424)
    expect(parseVoidSectorId('void:ivory-veil:31:23')).toEqual({
      realmId: 'ivory-veil',
      column: 31,
      row: 23,
    })
    for (const id of [
      'void:ivory-veil:64:1',
      'void:ivory-veil:0:48',
      'void:ivory-veil:-1:0',
      'void:ivory-veil:01:0',
      'void:ivory-veil:0:0:more',
      'void:no-such-realm:0:0',
      'void:ivory-veil:1.5:2',
      'void:ivory-veil:1:2\n',
      'uncharted-landing',
    ]) {
      expect(parseVoidSectorId(id)).toBeNull()
      expect(isVoidRealmSectorId(id)).toBe(false)
      expect(resolveVoidSector(id)).toBeNull()
    }
    expect(() => voidSectorId('ivory-veil', 64, 0)).toThrow(RangeError)
    const source = readFileSync(new URL('../../world/void-realms.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/server\/|landmarks|warpedArt|void-relics/)
  })

  it('resolves deterministically and evicts rather than retaining all 24576 sectors', () => {
    const first = resolveVoidSector('void:ivory-veil:0:0')!
    expect(resolveVoidSector(first.id)).toBe(first)
    for (let n = 1; n <= 300; n++)
      resolveVoidSector(`void:ivory-veil:${n % 32}:${Math.floor(n / 32)}`)
    const afterEviction = resolveVoidSector(first.id)!
    expect(afterEviction).not.toBe(first)
    expect(afterEviction).toEqual(first)
  })

  for (const realm of VOID_REALMS) {
    it(`${realm.name} has a coherent large landmass, connected authored sites, and natural boundary crossings`, () => {
      const sectors = sectorsFor(realm.id)
      const lookup = new Map(sectors.map((sector) => [sector.id, sector]))
      const focal = sectors.flatMap((sector) =>
        sector.landmarks.map((landmark) => ({
          ...landmark,
          sectorId: sector.id,
        })),
      )
      expect(focal).toHaveLength(13)
      expect(new Set(focal.map((landmark) => landmark.name)).size).toBe(13)
      expect(focal.some((landmark) => landmark.kind === 'hamlet')).toBe(true)
      expect(focal.some((landmark) => landmark.sceneryIndex !== undefined)).toBe(true)
      expect(focal.some((landmark) => landmark.warpedArt !== undefined)).toBe(true)
      const landing = voidRealmLanding(realm.id)
      expect(landing).toMatchObject({ x: 6, y: 4 })
      expect(isSafe(lookup.get(landing.sectorId)!, landing)).toBe(true)
      let walkable = 0,
        water = 0,
        rock = 0
      for (const sector of sectors) {
        expect(sector.rows).toHaveLength(9)
        expect(sector.sceneColumn).toBeDefined()
        expect(sector.sceneRow).toBeDefined()
        expect(sector.atlasColumn).toBeUndefined()
        expect(sector.charted).toBe(false)
        expect(sector.rows.every((row) => /^[.st~#=l]{13}$/.test(row))).toBe(true)
        for (const row of sector.rows)
          for (const tile of row) {
            if ('.st='.includes(tile)) walkable++
            if (tile === '~') water++
            if (tile === '#') rock++
          }
        for (const road of sector.roads) {
          const target = lookup.get(road.to.sectorId)!
          expect(target).toBeDefined()
          expect(isWalkable(sector, road.from)).toBe(true)
          expect(isWalkable(target, road.to)).toBe(true)
          const deltaX =
            target.sceneColumn! * 13 + road.to.x - (sector.sceneColumn! * 13 + road.from.x)
          const deltaY = target.sceneRow! * 9 + road.to.y - (sector.sceneRow! * 9 + road.from.y)
          expect(Math.abs(deltaX) + Math.abs(deltaY)).toBe(1)
          expect(
            target.roads.some(
              (back) =>
                back.to.sectorId === sector.id &&
                back.from.x === road.to.x &&
                back.from.y === road.to.y &&
                back.to.x === road.from.x &&
                back.to.y === road.from.y,
            ),
          ).toBe(true)
        }
      }
      expect(walkable).toBeGreaterThan(218790)
      expect(walkable).toBeLessThan(350000)
      expect(water).toBeGreaterThan(5000)
      expect(rock).toBeGreaterThan(100)

      // Flood the finite tile plane once, then check every authored location. Roads
      // above prove every cardinal seam matches this geometry in the real engine.
      const width = VOID_REALM_COLUMNS * 13,
        height = VOID_REALM_ROWS * 9
      const cells = new Uint8Array(width * height)
      for (const sector of sectors)
        for (let y = 0; y < 9; y++)
          for (let x = 0; x < 13; x++)
            cells[(sector.sceneRow! * 9 + y) * width + sector.sceneColumn! * 13 + x] = isWalkable(
              sector,
              { x, y },
            )
              ? 1
              : 0
      const start = lookup.get(landing.sectorId)!
      const startIndex =
        (start.sceneRow! * 9 + landing.y) * width + start.sceneColumn! * 13 + landing.x
      const queue = [startIndex]
      cells[startIndex] = 2
      for (let n = 0; n < queue.length; n++) {
        const cell = queue[n]!,
          x = cell % width,
          y = Math.floor(cell / width)
        for (const next of [
          x > 0 ? cell - 1 : -1,
          x + 1 < width ? cell + 1 : -1,
          y > 0 ? cell - width : -1,
          y + 1 < height ? cell + width : -1,
        ])
          if (next >= 0 && cells[next] === 1) {
            cells[next] = 2
            queue.push(next)
          }
      }
      expect(queue.length).toBeGreaterThan(walkable * 0.999)
      for (const landmark of focal) {
        const sector = lookup.get(landmark.sectorId)!
        expect(
          cells[
            (sector.sceneRow! * 9 + landmark.y) * width + sector.sceneColumn! * 13 + landmark.x
          ],
        ).toBe(2)
      }
      const destination = focal.at(-1)!
      const route = findWorldRoute(
        landing,
        {
          sectorId: destination.sectorId,
          x: destination.x,
          y: destination.y,
        },
        sectors,
      )
      expect(route?.at(-1)?.position).toEqual({
        sectorId: destination.sectorId,
        x: destination.x,
        y: destination.y,
      })
      expect(route!.length).toBeGreaterThan(100)
      expect(
        route!.every((step) => isWalkable(lookup.get(step.position.sectorId)!, step.position)),
      ).toBe(true)
    }, 30000)
  }

  it('reserves the large crater footprint and keeps celestial/time scenery sparse', () => {
    const crater = resolveVoidSector('void:starfall-basin:16:10')!
    for (let y = 3; y <= 5; y++)
      for (let x = 5; x <= 7; x++) {
        expect(crater.rows[y]![x]).toBe('.')
        expect(crater.landmarks.some((landmark) => landmark.x === x && landmark.y === y)).toBe(
          false,
        )
        expect(crater.roads.some((road) => road.from.x === x && road.from.y === y)).toBe(false)
      }
    expect(voidRealmScenery(crater.id)).toBeUndefined()
    for (const realm of VOID_REALMS) {
      const scenic = sectorsFor(realm.id).filter((sector) => voidRealmScenery(sector.id))
      expect(scenic.length).toBeGreaterThan(0)
      expect(scenic.length).toBeLessThanOrEqual(12)
    }
  }, 30000)

  it('places the goldfall and water cascade beside real connected liquid runs', () => {
    for (const [id, liquid] of [
      ['void:cinder-choir:17:12', 'l'],
      ['void:ivory-veil:12:11', '~'],
    ] as const) {
      const sector = resolveVoidSector(id)!
      const cascade = sector.landmarks.find((landmark) => landmark.sceneryIndex === 4)!
      expect(cascade, id).toBeDefined()
      expect(cascade.kind).toBe('spring')
      expect(sector.name).not.toBe(cascade.name)
      expect(isWalkable(sector, cascade)).toBe(true)
      const nearby = sector.rows.flatMap((row, y) =>
        [...row].flatMap((tile, x) =>
          tile === liquid && Math.hypot(x - cascade.x, y - cascade.y) <= 4 ? [{ x, y }] : [],
        ),
      )
      expect(nearby.length, `${id}: ${sector.rows.join('/')}`).toBeGreaterThanOrEqual(3)
      expect(
        nearby.some(
          ({ x, y }) => sector.rows[y]?.[x + 1] === liquid || sector.rows[y + 1]?.[x] === liquid,
        ),
      ).toBe(true)
    }
  })

  it('authors one proven bridge over existing terrain in each realm', () => {
    for (const [id, x, y] of [
      ['void:ivory-veil:12:12', 12, 4],
      ['void:amber-drowned:14:6', 2, 2],
      ['void:cinder-choir:8:8', 4, 3],
      ['void:glass-tides:23:7', 5, 5],
      ['void:hollow-orchard:12:11', 2, 2],
      ['void:starfall-basin:23:6', 2, 7],
      ['void:violet-estuary:22:9', 1, 1],
      ['void:clockwound-waste:19:8', 7, 7],
    ] as const) {
      const sector = resolveVoidSector(id)!
      const address = parseVoidSectorId(id)!
      const lookup = new Map<string, WorldSector>()
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const neighbor = resolveVoidSector(
            voidSectorId(address.realmId, address.column + dx, address.row + dy),
          )!
          lookup.set(neighbor.id, neighbor)
        }
      const bridges = sector.landmarks.filter((site) => site.kind === 'bridge')
      expect(bridges, id).toHaveLength(1)
      expect(bridges[0]).toMatchObject({ x, y })
      expect(sector.rows[y]?.[x]).toBe('=')
      expect(supportedBridge(sector, x, y, lookup), id).toBe(true)
      expect(bridges[0]!.sceneryIndex).toBeUndefined()
      expect(bridges[0]!.warpedArt).toBeUndefined()
      expect(sector.name).not.toBe(bridges[0]!.name)
    }
  })

  it('has eight distinct macro geographies rather than palette substitutions', () => {
    const shapes = VOID_REALMS.map((realm) =>
      sectorsFor(realm.id)
        .map((sector) => sector.rows.join('').replace(/[.st=]/g, '.'))
        .join(''),
    )
    for (let a = 0; a < shapes.length; a++)
      for (let b = a + 1; b < shapes.length; b++) {
        const difference = [...shapes[a]!].filter(
          (tile, index) => tile !== shapes[b]![index],
        ).length
        expect(difference).toBeGreaterThan(8000)
      }
  }, 30_000)
})
