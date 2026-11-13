import { GRID_HEIGHT, GRID_WIDTH } from '../src/world/catalog'
import { wrappedMapX } from '../src/world/topology'
import type { WorldSectorView } from '../src/world/types'

export type GroundCoverageFrame = {
  at: number
  x: number
  y: number
  width: number
  height: number
  tile: number
  painted: string[]
}

/** Serialized by Playwright; inspect the completed paint, rather than polling receipts. */
export function installWorldGroundCoverage(element: HTMLElement | SVGElement) {
  const canvas = element as HTMLCanvasElement & {
    __testGroundCoverageFrame?: number
  }
  if (canvas.__testGroundCoverageFrame !== undefined)
    cancelAnimationFrame(canvas.__testGroundCoverageFrame)
  const records: GroundCoverageFrame[] = []
  canvas.dataset.renderDiagnostics = 'coverage'
  canvas.dataset.testGroundCoverage = '[]'
  delete canvas.dataset.testGroundCoverageStopped
  const collect = () => {
    if (canvas.dataset.testGroundCoverageStopped) {
      delete canvas.__testGroundCoverageFrame
      return
    }
    const at = Number(canvas.dataset.frameNow)
    if (records.at(-1)?.at !== at && canvas.dataset.paintedGroundIds) {
      records.push({
        at,
        x: Number(canvas.dataset.cameraX),
        y: Number(canvas.dataset.cameraY),
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        tile: Number(canvas.dataset.tileSize),
        painted: JSON.parse(canvas.dataset.paintedGroundIds),
      })
      if (records.length > 1200) records.shift()
      canvas.dataset.testGroundCoverage = JSON.stringify(records)
    }
    canvas.__testGroundCoverageFrame = requestAnimationFrame(collect)
  }
  canvas.__testGroundCoverageFrame = requestAnimationFrame(collect)
}

/** Only already supplied complete public ground can be expected at this camera. */
export function missingPublicGround(
  sectors: readonly WorldSectorView[],
  frame: GroundCoverageFrame,
) {
  const painted = new Set(frame.painted)
  return sectors
    .filter((sector) => {
      if (
        !sector.charted ||
        sector.cells.length !== GRID_WIDTH * GRID_HEIGHT ||
        painted.has(sector.id)
      )
        return false
      const column = sector.atlasColumn
      const row = sector.atlasRow
      if (column === undefined || row === undefined) return false
      const origin = wrappedMapX(column * GRID_WIDTH, frame.x)
      // Cell centres prove that the sector body is on screen. Bounding boxes alone
      // overlap empty triangles at the corners of the isometric footprint.
      return sector.cells.some((cell) => {
        const dx = origin + cell.x + 0.5 - frame.x
        const dy = row * GRID_HEIGHT + cell.y + 0.5 - frame.y
        const x = frame.width / 2 + (dx - dy) * frame.tile * 0.85
        const y = frame.height / 2 + (dx + dy) * frame.tile * 0.44
        return x > 8 && x < frame.width - 8 && y > 8 && y < frame.height - 8
      })
    })
    .map((sector) => sector.id)
}
