import { hashString } from '@/world/terrain-gen'
import { sectorMapOrigin } from '@/world/topology'
import type { WorldCell, WorldSectorView } from '@/world/types'

export const WARPED_FOG_COLOR = '#252c3d'
const edges = [
  { dx: 0, dy: -1, x: 0, y: 0 },
  { dx: 1, dy: 0, x: 1, y: 0 },
  { dx: 0, dy: 1, x: 0, y: 1 },
  { dx: -1, dy: 0, x: 0, y: 0 },
] as const
const cellKey = (x: number, y: number) => `${x}:${y}`

/** Identify only already supplied land cells; scene neighbors share their true local offsets. */
export function buildWarpedFogField(sectors: readonly WorldSectorView[]) {
  const privateSectors = sectors.filter((sector) => sector.warpedTheme !== undefined)
  const known = new Set<string>()
  for (const sector of privateSectors) {
    const origin = sectorMapOrigin(sector)
    for (const cell of sector.cells) known.add(cellKey(origin.x + cell.x, origin.y + cell.y))
  }
  return new Map(
    privateSectors.map((sector) => {
      const origin = sectorMapOrigin(sector)
      const cells = new Map<string, number>()
      for (const cell of sector.cells) {
        const x = origin.x + cell.x,
          y = origin.y + cell.y
        let mask = 0
        edges.forEach(({ dx, dy }, i) => {
          if (!known.has(cellKey(x + dx, y + dy))) mask |= 1 << i
        })
        if (mask) cells.set(cellKey(cell.x, cell.y), mask)
      }
      return [sector.id, { cells, key: JSON.stringify([...cells.entries()]) }] as const
    }),
  )
}

export function paintWarpedFogEdge(
  context: CanvasRenderingContext2D,
  cell: WorldCell,
  tile: number,
  mask: number,
) {
  edges.forEach(({ dx, dy, x, y }, i) => {
    if (!(mask & (1 << i))) return
    const vertical = dx !== 0
    const across = vertical ? cell.x + x : cell.y + y
    const along = vertical ? cell.y : cell.x
    const salt = ((hashString(`${i}:${across}:fog`) % 997) / 997) * Math.PI * 2
    // Cached narrow strips follow an uneven fringe instead of one square fade.
    // Even four exposed sides leave a walkable exit's center wholly readable.
    const strips = 12
    for (let strip = 0; strip < strips; strip++) {
      const t = (strip + 0.5) / strips
      const phase = (along + t) * Math.PI * 2 + salt
      const depth =
        (cell.walkable ? 0.32 : 0.53) + Math.sin(phase) * 0.075 + Math.sin(phase * 2.1) * 0.025
      const startX = (cell.x + x + (vertical ? 0 : t)) * tile
      const startY = (cell.y + y + (vertical ? t : 0)) * tile
      const fog = context.createLinearGradient(
        startX,
        startY,
        startX - dx * tile * depth,
        startY - dy * tile * depth,
      )
      fog.addColorStop(0, WARPED_FOG_COLOR)
      fog.addColorStop(0.44, 'rgba(37,44,61,.71)')
      fog.addColorStop(1, 'rgba(37,44,61,0)')
      context.fillStyle = fog
      context.fillRect(
        (cell.x + (vertical ? (dx > 0 ? 1 - depth : 0) : strip / strips)) * tile,
        (cell.y + (vertical ? strip / strips : dy > 0 ? 1 - depth : 0)) * tile,
        (vertical ? depth : 1 / strips) * tile,
        (vertical ? 1 / strips : depth) * tile,
      )
    }
  })
}

/** Small broken slate masses signal collision even when the full boulder sprite is omitted. */
export function paintWarpedScree(
  context: CanvasRenderingContext2D,
  cell: WorldCell,
  tile: number,
  seed: string,
) {
  for (let i = 0; i < 4; i++) {
    const random = hashString(`${seed}:${cell.x}:${cell.y}:scree:${i}`)
    const x = (cell.x + 0.16 + ((random % 93) / 93) * 0.68) * tile
    const y = (cell.y + 0.17 + (((random >>> 9) % 89) / 89) * 0.66) * tile
    const size = (0.05 + ((random >>> 18) % 31) / 270) * tile
    context.beginPath()
    context.moveTo(x - size, y)
    context.lineTo(x - size * 0.34, y - size * 0.55)
    context.lineTo(x + size * 0.61, y - size * 0.45)
    context.lineTo(x + size, y + size * 0.23)
    context.lineTo(x + size * 0.18, y + size * 0.68)
    context.closePath()
    context.fillStyle = 'rgba(44,39,57,.64)'
    context.fill()
    context.strokeStyle = 'rgba(183,164,180,.31)'
    context.lineWidth = Math.max(1, tile * 0.017)
    context.stroke()
  }
}
