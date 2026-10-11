import { STEP_MS, WILD_DOORS, WORLD_REGIONS } from './catalog'
import { generateSectorTerrain, riverFor } from './terrain-gen'
import type { WorldRoad, WorldSector } from './types'
import {
  EDGE_TILE,
  MAP_DIRECTIONS,
  OPPOSITE,
  parseWildId,
  wildSectorId,
  type MapDirection,
  type WildAddress,
} from './wild-ids'

/**
 * Endless generated wilds. Every authored region edge without a road opens onto a lattice of
 * sectors that continues forever: sector (k, b) lies k sectors out along the door's direction
 * and b sectors to the side. The ground is a pure function of the id, so every player sees the
 * same world; per-character knowledge is saved in their discoveries as they explore.
 */
const LATERAL: Record<MapDirection, readonly [MapDirection, MapDirection]> = {
  west: ['north', 'south'],
  east: ['north', 'south'],
  north: ['west', 'east'],
  south: ['west', 'east'],
}
const LETTER: Record<MapDirection, string> = { west: 'W', east: 'E', north: 'N', south: 'S' }

/** The coast: sectors south of a coastal region's road are open sea. */
function exists(a: WildAddress) {
  if (!WILD_DOORS.some((door) => door.root === a.root && door.dir === a.dir)) return false
  if (a.root === 'hollow-coast' && (a.dir === 'west' || a.dir === 'east') && a.b > 0) return false
  return true
}

/** The sector reached by leaving `address` through map edge `edge`, or null at a closed edge. */
export function wildNeighbor(
  address: WildAddress,
  edge: MapDirection,
): { sectorId: string } | { regionId: string } | null {
  const { dir, k, b } = address
  let next: WildAddress | null = null
  if (edge === dir) next = { ...address, k: k + 1 }
  else if (edge === OPPOSITE[dir]) {
    if (k > 1) next = { ...address, k: k - 1 }
    else if (b === 0) return { regionId: address.root }
  } else next = { ...address, b: b + (edge === LATERAL[dir][0] ? -1 : 1) }
  if (!next || !exists(next) || next.k > 400 || Math.abs(next.b) > 400) return null
  return { sectorId: wildSectorId(next) }
}

const wildCache = new Map<string, WorldSector | null>()
export function resolveWildSector(id: string): WorldSector | null {
  if (wildCache.has(id)) return wildCache.get(id)!
  const built = buildWildSector(id)
  if (wildCache.size > 4000) wildCache.clear()
  wildCache.set(id, built)
  return built
}
function buildWildSector(id: string): WorldSector | null {
  const a = parseWildId(id)
  if (!a || !exists(a)) return null
  const root = WORLD_REGIONS.find((region) => region.id === a.root)
  if (!root) return null

  const open = Object.fromEntries(
    MAP_DIRECTIONS.map((edge) => [edge, wildNeighbor(a, edge)]),
  ) as Record<MapDirection, ReturnType<typeof wildNeighbor>>
  const roads: WorldRoad[] = []
  for (const edge of MAP_DIRECTIONS) {
    const target = open[edge]
    if (!target) continue
    const from = { sectorId: id, ...EDGE_TILE[edge] }
    const to =
      'regionId' in target
        ? { sectorId: target.regionId, ...EDGE_TILE[OPPOSITE[edge]] }
        : { sectorId: target.sectorId, ...EDGE_TILE[OPPOSITE[edge]] }
    roads.push({ from, to, name: `${root.name} Wilds`, durationMs: STEP_MS })
  }

  // A river follows a whole lattice line so it stays continuous between neighbouring sectors.
  const lateralAxis = a.dir === 'west' || a.dir === 'east' ? 'v' : 'h'
  const river = riverFor(`${a.root}:${a.dir}:${a.k}`, lateralAxis)
  const shore = a.root === 'hollow-coast' && (a.dir === 'west' || a.dir === 'east') && a.b === 0
  const terrain = generateSectorTerrain({
    id,
    arms: {
      w: open.west ? 4 : undefined,
      e: open.east ? 4 : undefined,
      n: Boolean(open.north),
      s: Boolean(open.south),
    },
    river: shore ? null : river,
    seaFrom: shore ? 6 : undefined,
  })

  const stepsEast =
    a.dir === 'east'
      ? a.k
      : a.dir === 'west'
        ? -a.k
        : a.dir === 'north' || a.dir === 'south'
          ? a.b
          : 0
  const stepsSouth = a.dir === 'south' ? a.k : a.dir === 'north' ? -a.k : a.b
  const side = a.b === 0 ? '' : `${a.b > 0 ? '+' : '−'}${Math.abs(a.b)}`
  return {
    id,
    name: `${root.name} Wilds`,
    coordinate: `${root.sector}·${LETTER[a.dir]}${a.k}${side}`,
    regionId: root.id,
    art: null,
    east: 12 + stepsEast * 13,
    north: 28 - stepsSouth * 9,
    rows: terrain.rows,
    charted: false,
    generated: true,
    landmarks: terrain.landmarks,
    roads,
  }
}
