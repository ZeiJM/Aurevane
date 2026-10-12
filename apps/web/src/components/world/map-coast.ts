import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { hashString } from '@/world/terrain-gen'
import type { WorldView } from '@/world/types'
import { atlasNeighbor } from '@/world/topology'

export interface CoastEdge {
  side: 0 | 1 | 2 | 3
  from: number
  to: number
  seed: number
}
const offsets = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const

/** A missing loaded chunk is never an ocean: consult the complete public overview. */
export function buildPublicCoasts(view: Pick<WorldView, 'sectors' | 'atlas'>) {
  const occupied = new Set([
    ...(view.atlas ?? []).map((cell) => `${cell.column}:${cell.row}`),
    ...view.sectors
      .filter((s) => s.atlasColumn !== undefined && s.atlasRow !== undefined)
      .map((s) => `${s.atlasColumn}:${s.atlasRow}`),
  ])
  const field = new Map<string, CoastEdge[]>()
  for (const sector of view.sectors) {
    const edges: CoastEdge[] = []
    field.set(sector.id, edges)
    if (
      !view.atlas ||
      !sector.charted ||
      sector.atlasColumn === undefined ||
      sector.atlasRow === undefined
    )
      continue
    const known = new Map(sector.cells.map((cell) => [`${cell.x}:${cell.y}`, cell.terrain]))
    for (let side = 0; side < 4; side++) {
      const [dx, dy] = offsets[side]!
      const neighbor = atlasNeighbor(sector.atlasColumn, sector.atlasRow, dx, dy)
      if (neighbor && occupied.has(`${neighbor.column}:${neighbor.row}`)) continue
      const length = side % 2 ? GRID_HEIGHT : GRID_WIDTH
      let start: number | null = null
      for (let i = 0; i <= length; i++) {
        const x = side === 1 ? GRID_WIDTH - 1 : side === 3 ? 0 : i,
          y = side === 0 ? 0 : side === 2 ? GRID_HEIGHT - 1 : i,
          terrain = i < length ? known.get(`${x}:${y}`) : undefined,
          land = terrain !== undefined && terrain !== '~' && terrain !== 'l'
        if (land && start === null) start = i
        if (!land && start !== null) {
          edges.push({
            side: side as CoastEdge['side'],
            from: start,
            to: i,
            seed: hashString(`${sector.atlasColumn}:${sector.atlasRow}:${side}`),
          })
          start = null
        }
      }
    }
  }
  return field
}

/** All offsets point seawards, so surf never conceals legal walkable ground. */
export function coastPoint(
  edge: CoastEdge,
  t: number,
  distance: number,
): readonly [number, number] {
  const along = edge.from + (edge.to - edge.from) * t,
    outward = distance + Math.sin(along * 1.23 + edge.seed) * distance * 0.16
  return edge.side === 0
    ? [along, -outward]
    : edge.side === 1
      ? [GRID_WIDTH + outward, along]
      : edge.side === 2
        ? [along, GRID_HEIGHT + outward]
        : [-outward, along]
}
function trace(context: CanvasRenderingContext2D, edge: CoastEdge, tile: number, distance: number) {
  for (let i = 0; i <= 24; i++) {
    const point = coastPoint(edge, i / 24, distance)
    if (i === 0) context.moveTo(point[0] * tile, point[1] * tile)
    else context.lineTo(point[0] * tile, point[1] * tile)
  }
}

/** Bounded sea-side shading and surf, painted before the cached land layer. */
export function paintCoastSea(
  context: CanvasRenderingContext2D,
  edges: readonly CoastEdge[],
  tile: number,
  now: number,
  animate: boolean,
  budget = 16,
) {
  const visibleEdges = edges.slice(0, Math.max(0, Math.min(16, budget)))
  context.save()
  context.lineCap = 'round'
  for (const edge of visibleEdges) {
    const near = coastPoint(edge, 0.5, 0),
      far = coastPoint(edge, 0.5, 2.3),
      gradient = context.createLinearGradient(
        near[0] * tile,
        near[1] * tile,
        far[0] * tile,
        far[1] * tile,
      )
    gradient.addColorStop(0, '#678f82')
    gradient.addColorStop(0.2, '#487c79')
    gradient.addColorStop(0.65, '#315f6b')
    gradient.addColorStop(1, '#284b57')
    context.beginPath()
    trace(context, edge, tile, 0)
    for (let i = 24; i >= 0; i--) {
      const p = coastPoint(edge, i / 24, 2.3)
      context.lineTo(p[0] * tile, p[1] * tile)
    }
    context.closePath()
    context.fillStyle = gradient
    context.fill()
    for (let wave = 0; wave < 3; wave++) {
      const phase = animate
        ? (now / (9000 + (edge.seed % 2000)) + wave / 3 + (edge.seed % 97) / 97) % 1
        : (wave + 1) / 4
      context.globalAlpha = Math.sin(phase * Math.PI) * 0.24
      context.strokeStyle = '#d1e3cd'
      context.lineWidth = tile * 0.016
      context.beginPath()
      trace(context, edge, tile, 0.05 + phase * 1.4)
      context.stroke()
    }
  }
  context.restore()
  return visibleEdges.length
}
