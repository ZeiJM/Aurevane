import 'server-only'
import { atlasSectors } from '@/world/atlas'
import { GRAND_DISCOVERY_SITES } from '@/world/discovery-sites'
import { grandDiscoveryBarrier } from '@/world/discovery-collision'
import { terrainWalkable } from '@/world/terrain'
import type { WorldPosition, WorldSector } from '@/world/types'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { ATLAS_COLUMNS } from '@/world/topology'

const CELLS = GRID_WIDTH * GRID_HEIGHT
type PublicComponent = {
  sectors: WorldSector[]
  index: Map<string, number>
  connected: Map<string, WorldPosition[]>
}

/** Construct the canonical public travel component only when an old saved wall
 * origin needs repair. The cached map is based on the same sector rows and
 * cross-sector roads as the normal server pathfinder. */
let componentCache: PublicComponent | null = null
function publicComponent(): PublicComponent {
  if (componentCache) return componentCache
  const sectors = atlasSectors()
  const index = new Map(sectors.map((sector, i) => [sector.id, i]))
  const bridge = new Map<number, number[]>()
  for (let i = 0; i < sectors.length; i++) {
    for (const road of sectors[i]!.roads) {
      const to = index.get(road.to.sectorId)
      if (to === undefined) continue
      const fromCell = i * CELLS + road.from.y * GRID_WIDTH + road.from.x
      const toCell = to * CELLS + road.to.y * GRID_WIDTH + road.to.x
      const edges = bridge.get(fromCell) ?? []
      edges.push(toCell)
      bridge.set(fromCell, edges)
    }
  }
  const visited = new Uint8Array(sectors.length * CELLS)
  const queue: number[] = []
  const enqueue = (code: number) => {
    if (visited[code]) return
    const si = Math.floor(code / CELLS)
    const local = code % CELLS
    const x = local % GRID_WIDTH
    const y = Math.floor(local / GRID_WIDTH)
    if (!terrainWalkable(sectors[si]?.rows[y]?.[x] ?? '#')) return
    visited[code] = 1
    queue.push(code)
  }
  const start = index.get('umbral-march')
  if (start === undefined) throw new Error('Canonical Umbral March recovery is unavailable')
  enqueue(start * CELLS + 4 * GRID_WIDTH + 6)
  for (let head = 0; head < queue.length; head++) {
    const code = queue[head]!
    const local = code % CELLS
    const x = local % GRID_WIDTH
    const y = Math.floor(local / GRID_WIDTH)
    if (x > 0) enqueue(code - 1)
    if (x + 1 < GRID_WIDTH) enqueue(code + 1)
    if (y > 0) enqueue(code - GRID_WIDTH)
    if (y + 1 < GRID_HEIGHT) enqueue(code + GRID_WIDTH)
    for (const target of bridge.get(code) ?? []) enqueue(target)
  }
  const connected = new Map<string, WorldPosition[]>()
  for (const code of queue) {
    const si = Math.floor(code / CELLS)
    const local = code % CELLS
    const sectorId = sectors[si]!.id
    const list = connected.get(sectorId) ?? []
    list.push({ sectorId, x: local % GRID_WIDTH, y: Math.floor(local / GRID_WIDTH) })
    connected.set(sectorId, list)
  }
  componentCache = { sectors, index, connected }
  return componentCache
}

/** Return null for ordinary locations and all private worlds. A blocked former
 * arena/valley position is moved only to a cell in the connected legal mainland.
 * The application never accepts a destination supplied by the browser. */
export function savedWorldGeometryRecovery(
  position: WorldPosition,
): WorldPosition | null {
  if (
    !position ||
    !Number.isInteger(position.x) ||
    !Number.isInteger(position.y) ||
    position.x < 0 ||
    position.x >= GRID_WIDTH ||
    position.y < 0 ||
    position.y >= GRID_HEIGHT
  )
    return null
  const { sectors, index, connected } = publicComponent()
  const si = index.get(position.sectorId)
  if (si === undefined) return null
  const sector = sectors[si]!
  const at = sector.rows[position.y]?.[position.x] ?? '#'
  if (terrainWalkable(at)) return null
  const globalX = sector.atlasColumn! * GRID_WIDTH + position.x
  const globalY = sector.atlasRow! * GRID_HEIGHT + position.y
  if (
    !GRAND_DISCOVERY_SITES.some(
      (site) =>
        grandDiscoveryBarrier(site.id, globalX - site.left, globalY - site.top),
    )
  )
    return null

  // Pick the nearest legal cell in the same public connected component, with
  // geographic wrapping. Deterministic ordering makes repeated reads idempotent.
  let best: WorldPosition | null = null
  let bestDistance = Infinity
  const worldWidth = ATLAS_COLUMNS * GRID_WIDTH
  const choose = (target: WorldPosition, candidateSector: WorldSector) => {
    const tx = candidateSector.atlasColumn! * GRID_WIDTH + target.x
    const ty = candidateSector.atlasRow! * GRID_HEIGHT + target.y
    const dx = Math.abs(tx - globalX)
    const distance = Math.min(dx, worldWidth - dx) ** 2 + (ty - globalY) ** 2
    if (
      distance < bestDistance ||
      (distance === bestDistance &&
        (target.sectorId + ':' + target.y + ':' + target.x) <
          ((best?.sectorId ?? '~') + ':' + (best?.y ?? 0) + ':' + (best?.x ?? 0)))
    ) {
      best = target
      bestDistance = distance
    }
  }
  for (const targetSector of sectors) {
    const candidates = connected.get(targetSector.id)
    if (!candidates?.length) continue
    const deltaX = Math.abs(targetSector.atlasColumn! - sector.atlasColumn!)
    const sectorDistance =
      Math.min(deltaX, ATLAS_COLUMNS - deltaX) +
      Math.abs(targetSector.atlasRow! - sector.atlasRow!)
    if (sectorDistance > 4) continue
    for (const candidate of candidates) choose(candidate, targetSector)
  }
  if (best) return best
  return { sectorId: 'umbral-march', x: 6, y: 4 }
}
