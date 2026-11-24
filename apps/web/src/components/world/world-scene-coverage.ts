import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { VOID_REALM_COLUMNS, VOID_REALM_ROWS } from '@/world/void-realms'
import { mapSceneDomain } from './map-scene-domain'
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
  const current = view.sectors.find((sector) => sector.id === view.position.sectorId)
  if (!current) return false
  const halfWidth = viewport.width / viewport.tile / 2
  const halfHeight = viewport.height / viewport.tile / 2
  const intersects = (dx: number, dy: number) => {
    const x = (dx - dy) * MAP_X,
      y = (dx + dy) * MAP_Y
    return (
      x - GRID_HEIGHT * MAP_X <= halfWidth &&
      x + GRID_WIDTH * MAP_X >= -halfWidth &&
      y <= halfHeight &&
      y + (GRID_WIDTH + GRID_HEIGHT) * MAP_Y >= -halfHeight
    )
  }
  const terrain = worldRenderTerrain(view).filter(
    (sector) => sector.cells.length === GRID_WIDTH * GRID_HEIGHT,
  )
  if (!current.charted) {
    const domain = mapSceneDomain(current)
    if (!current.warpedTheme || !(domain.startsWith('void:') || domain === 'uncharted:legacy'))
      return true
    // Only check coverage of supplied ground within this realm. A private
    // sector at a matching public coordinate can never complete the public map.
    const supplied = new Set(
      terrain
        .filter((sector) => mapSceneDomain(sector) === domain)
        .map((sector) => `${sector.sceneColumn}:${sector.sceneRow}`),
    )
    const extent = (halfWidth / MAP_X + halfHeight / MAP_Y) / 2
    for (const point of points) {
      const minColumn = Math.max(0, Math.floor((point.x - extent) / GRID_WIDTH))
      const maxColumn = Math.min(
        VOID_REALM_COLUMNS - 1,
        Math.floor((point.x + extent) / GRID_WIDTH),
      )
      const minRow = Math.max(0, Math.floor((point.y - extent) / GRID_HEIGHT))
      const maxRow = Math.min(VOID_REALM_ROWS - 1, Math.floor((point.y + extent) / GRID_HEIGHT))
      for (let row = minRow; row <= maxRow; row++)
        for (let column = minColumn; column <= maxColumn; column++)
          if (
            !supplied.has(`${column}:${row}`) &&
            intersects(column * GRID_WIDTH - point.x, row * GRID_HEIGHT - point.y)
          )
            return false
    }
    return true
  }
  if (!view.atlas?.length) return false
  const supplied = new Set(terrain.filter((sector) => sector.charted).map((sector) => sector.id))
  for (const point of points)
    for (const sector of view.atlas) {
      if (!sector.charted || supplied.has(sector.id)) continue
      const dx = wrappedMapX(sector.column * GRID_WIDTH, point.x) - point.x
      if (intersects(dx, sector.row * GRID_HEIGHT - point.y)) return false
    }
  return true
}
