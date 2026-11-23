import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { wrappedMapX } from '@/world/topology'
import type { WorldView } from '@/world/types'
import { MAP_X, MAP_Y } from './map-projection'
import type { MapPoint } from './world-motion'
import { worldRenderTerrain } from './map-render-terrain'

/** Presentation coverage never grants navigation or player-presence authority. */
export function worldSceneCoversViewport(
  view: WorldView,
  points: readonly MapPoint[],
  viewport: { width: number; height: number; tile: number },
): boolean {
  if (!viewport.width || !viewport.height || !Number.isFinite(viewport.tile) || viewport.tile <= 0)
    return false
  const supplied = new Set(
    worldRenderTerrain(view)
      .filter((sector) => sector.cells.length === GRID_WIDTH * GRID_HEIGHT)
      .map((sector) => sector.id),
  )
  const halfWidth = viewport.width / viewport.tile / 2
  const halfHeight = viewport.height / viewport.tile / 2
  for (const point of points)
    for (const sector of view.atlas ?? []) {
      if (!sector.charted || supplied.has(sector.id)) continue
      const dx = wrappedMapX(sector.column * GRID_WIDTH, point.x) - point.x
      const dy = sector.row * GRID_HEIGHT - point.y
      const x = (dx - dy) * MAP_X,
        y = (dx + dy) * MAP_Y
      if (
        x - GRID_HEIGHT * MAP_X <= halfWidth &&
        x + GRID_WIDTH * MAP_X >= -halfWidth &&
        y <= halfHeight &&
        y + (GRID_WIDTH + GRID_HEIGHT) * MAP_Y >= -halfHeight
      )
        return false
    }
  return true
}
