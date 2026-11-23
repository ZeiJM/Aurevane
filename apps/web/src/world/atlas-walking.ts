import { atlasSectors } from './atlas'
import { GRID_HEIGHT, GRID_WIDTH } from './catalog'
import { ATLAS_ROWS, WORLD_MAP_WIDTH } from './topology'
import { terrainWalkable } from './terrain'
import { validCell } from './travel'
import type { WorldPosition } from './types'

const height = ATLAS_ROWS * GRID_HEIGHT
let walkingMap: ReturnType<typeof buildWalkingMap> | undefined

function buildWalkingMap() {
  const size = WORLD_MAP_WIDTH * height
  const labels = new Int32Array(size)
  const origins = new Map<string, number>()
  for (const sector of atlasSectors()) {
    const origin =
      sector.atlasRow! * GRID_HEIGHT * WORLD_MAP_WIDTH + sector.atlasColumn! * GRID_WIDTH
    origins.set(sector.id, origin)
    for (let y = 0; y < GRID_HEIGHT; y++)
      for (let x = 0; x < GRID_WIDTH; x++)
        if (terrainWalkable(sector.rows[y]![x]!)) labels[origin + y * WORLD_MAP_WIDTH + x] = -1
  }
  const queue = new Int32Array(size)
  let component = 0
  for (let cell = 0; cell < size; cell++) {
    if (labels[cell] !== -1) continue
    component++
    labels[cell] = component
    queue[0] = cell
    let end = 1
    const visit = (index: number) => {
      if (labels[index] !== -1) return
      labels[index] = component
      queue[end++] = index
    }
    for (let start = 0; start < end; start++) {
      const current = queue[start]!
      const x = current % WORLD_MAP_WIDTH
      visit(current + (x === 0 ? WORLD_MAP_WIDTH - 1 : -1))
      visit(current + (x === WORLD_MAP_WIDTH - 1 ? 1 - WORLD_MAP_WIDTH : 1))
      visit(current - WORLD_MAP_WIDTH)
      visit(current + WORLD_MAP_WIDTH)
    }
  }
  return { labels, origins }
}

function arrivalComponent(position: WorldPosition) {
  if (!validCell(position)) return 0
  walkingMap ??= buildWalkingMap()
  const { labels, origins } = walkingMap
  const origin = origins.get(position.sectorId)
  return origin === undefined ? 0 : labels[origin + position.y * WORLD_MAP_WIDTH + position.x]!
}

/** Charted sectors use cardinal walking and matching land on both sides of every seam. */
export function canWalkPublicAtlas(from: WorldPosition, to: WorldPosition) {
  const component = arrivalComponent(from)
  return component > 0 && component === arrivalComponent(to)
}

/** A sector entry may still be reachable when its preferred tile is blocked. */
export function reachableAtlasArrival(from: WorldPosition, preferred: WorldPosition) {
  const component = arrivalComponent(from)
  const target = walkingMap?.origins.get(preferred.sectorId)
  if (component === 0 || target === undefined) return null
  if (arrivalComponent(preferred) === component) return preferred

  const { labels } = walkingMap!
  let nearest: WorldPosition | null = null
  let distance = Infinity
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (labels[target + y * WORLD_MAP_WIDTH + x] !== component) continue
      const steps = Math.abs(x - preferred.x) + Math.abs(y - preferred.y)
      if (steps >= distance) continue
      nearest = { sectorId: preferred.sectorId, x, y }
      distance = steps
    }
  }
  return nearest
}
