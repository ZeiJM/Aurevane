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

/** Charted sectors use cardinal walking and matching land on both sides of every seam. */
export function canWalkPublicAtlas(from: WorldPosition, to: WorldPosition) {
  if (!validCell(from) || !validCell(to)) return false
  walkingMap ??= buildWalkingMap()
  const { labels, origins } = walkingMap
  const source = origins.get(from.sectorId)
  const target = origins.get(to.sectorId)
  if (source === undefined || target === undefined) return false
  const component = labels[target + to.y * WORLD_MAP_WIDTH + to.x]
  return !!component && labels[source + from.y * WORLD_MAP_WIDTH + from.x] === component
}
