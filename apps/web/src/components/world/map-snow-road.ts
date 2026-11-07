import { hashString } from '@/world/terrain-gen'
import type { WorldCell } from '@/world/types'

const edges = [
  { dx: 0, dy: -1, x: 0, y: 0, tx: 1, ty: 0 },
  { dx: 1, dy: 0, x: 1, y: 0, tx: 0, ty: 1 },
  { dx: 0, dy: 1, x: 0, y: 1, tx: 1, ty: 0 },
  { dx: -1, dy: 0, x: 0, y: 0, tx: 0, ty: 1 },
] as const

/** Drift over known dry verges only. Water, missing neighbors and bridge mouths retain their edges. */
export function paintSnowRoadShoulders(
  context: CanvasRenderingContext2D,
  cell: WorldCell,
  tile: number,
  terrain: ReadonlyMap<string, WorldCell>,
  seed: string,
  depth: number,
) {
  for (const { dx, dy, x, y, tx, ty } of edges) {
    const neighbor = terrain.get(`${cell.x + dx}:${cell.y + dy}`)
    if (!neighbor?.walkable || (neighbor.terrain !== '.' && neighbor.terrain !== 't')) continue
    const startX = (cell.x + x) * tile
    const startY = (cell.y + y) * tile
    const endX = startX + tx * tile
    const endY = startY + ty * tile
    const drift = context.createLinearGradient(
      startX,
      startY,
      startX - dx * depth * tile,
      startY - dy * depth * tile,
    )
    drift.addColorStop(0, 'rgba(211,220,224,.72)')
    drift.addColorStop(0.53, 'rgba(202,215,222,.37)')
    drift.addColorStop(1, 'rgba(187,205,213,0)')
    context.fillStyle = drift
    context.beginPath()
    context.moveTo(startX, startY)
    context.lineTo(endX, endY)
    const phase = (hashString(`${seed}:${cell.x}:${cell.y}:${dx}:${dy}`) % 100) / 10
    for (let index = 7; index >= 0; index--) {
      const fraction = index / 7
      const inset = depth * (1 + Math.sin(fraction * 9 + phase) * 0.22) * tile
      context.lineTo(
        startX + tx * fraction * tile - dx * inset,
        startY + ty * fraction * tile - dy * inset,
      )
    }
    context.closePath()
    context.fill()
  }
}
