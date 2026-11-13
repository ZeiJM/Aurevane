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

/** Serialized by Playwright; enable producer-owned completed-frame diagnostics. */
export function installWorldGroundCoverage(element: HTMLElement | SVGElement) {
  const canvas = element as HTMLCanvasElement
  const enable = (stage: HTMLCanvasElement) => {
    stage.dataset.testGroundCoverage = '[]'
    delete stage.dataset.testGroundCoverageStopped
  }
  enable(canvas)

  // Atlas travel temporarily replaces the map with the globe. The stage host
  // survives, but its canvas and renderer are replaced. Re-arm the new canvas
  // before its first paint; otherwise every completed-frame assertion sees [].
  const host = canvas.parentElement as
    (HTMLElement & { __worldGroundCoverageObserver?: MutationObserver }) | null
  if (!host || typeof MutationObserver === 'undefined') return
  host.__worldGroundCoverageObserver?.disconnect()
  let active = canvas
  const observer = new MutationObserver(() => {
    const next = host.querySelector<HTMLCanvasElement>('canvas[data-world-stage]')
    if (!next || next === active) return
    active = next
    enable(next)
  })
  host.__worldGroundCoverageObserver = observer
  observer.observe(host, { childList: true, subtree: true })
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
