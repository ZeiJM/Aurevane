import type { Page } from '@playwright/test'
import { GRID_HEIGHT, GRID_WIDTH } from '../src/world/catalog'
import { WORLD_MAP_WIDTH } from '../src/world/topology'
import { MAP_X, MAP_Y } from '../src/components/world/map-projection'
import type { WorldPosition, WorldSectorView } from '../src/world/types'

/** A native click burst using one immutable sector placement, without authority reads between clicks. */
export async function clickWorldGroundSequence(
  page: Pick<Page, 'locator' | 'mouse'>,
  sector: Pick<WorldSectorView, 'id' | 'atlasColumn' | 'atlasRow'>,
  destinations: WorldPosition[],
) {
  const canvas = page.locator('canvas[data-world-stage]')
  const projections = []
  for (const destination of destinations) {
    if (destination.sectorId !== sector.id)
      throw new Error('Ground click must stay in the supplied sector.')
    const point = await canvas.evaluate(
      (el, target) => {
        // Read bounds and this frame's camera together. Only the viewport offset
        // uses the fractional DOMRect; the renderer projects client dimensions.
        const bounds = el.getBoundingClientRect()
        const camera = { x: Number(el.dataset.cameraX), y: Number(el.dataset.cameraY) }
        const tile = Number(el.dataset.tileSize)
        const dx =
          target.x +
          Math.round((camera.x - target.x) / target.mapWidth) * target.mapWidth -
          camera.x
        const dy = target.y - camera.y
        const x = el.clientWidth / 2 + (dx - dy) * tile * target.mapX
        const y = el.clientHeight / 2 + (dx + dy) * tile * target.mapY
        if (
          !Number.isFinite(x + y) ||
          tile <= 0 ||
          x <= 0 ||
          x >= el.clientWidth ||
          y <= 0 ||
          y >= el.clientHeight
        )
          throw new Error('Ground click target must be visible on the native canvas.')
        return { x: bounds.left + x, y: bounds.top + y, camera, measuredAt: performance.now() }
      },
      {
        x: (sector.atlasColumn ?? 0) * GRID_WIDTH + destination.x + 0.5,
        y: (sector.atlasRow ?? 0) * GRID_HEIGHT + destination.y + 0.5,
        mapWidth: WORLD_MAP_WIDTH,
        mapX: MAP_X,
        mapY: MAP_Y,
      },
    )
    // No authority read, locator actionability wait, or other browser operation
    // may age the measured coordinates before this real native click.
    await page.mouse.click(point.x, point.y)
    projections.push({ destination, ...point })
  }
  return projections
}
