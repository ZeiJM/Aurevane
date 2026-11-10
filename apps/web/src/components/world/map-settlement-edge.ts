import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { atlasNeighbor } from '@/world/topology'
import type { WorldCell, WorldSectorView } from '@/world/types'

type Side = 0 | 1 | 2 | 3
interface SettlementEdge {
  x: number
  y: number
  side: Side
  road: boolean
}

const steps = [
  [0, -1, 0],
  [1, 0, 1],
  [0, 1, 2],
  [-1, 0, 3],
] as const

const address = (x: number, y: number) => `${x}:${y}`
const isGround = (cell: WorldCell | undefined): cell is WorldCell =>
  Boolean(cell?.walkable && cell.terrain !== '~' && cell.terrain !== 'l')

/** Use the projected protection boundary where both sides of a crossing are visible. */
export function buildSettlementEdges(sectors: readonly WorldSectorView[]) {
  const byAtlas = new Map<string, WorldSectorView>()
  const terrain = new Map(
    sectors.map((sector) => [
      sector,
      new Map(sector.cells.map((cell) => [address(cell.x, cell.y), cell])),
    ]),
  )
  for (const sector of sectors) {
    if (sector.charted && sector.atlasColumn !== undefined && sector.atlasRow !== undefined)
      byAtlas.set(address(sector.atlasColumn, sector.atlasRow), sector)
  }

  const field = new Map<string, SettlementEdge[]>()
  for (const sector of sectors) {
    if (sector.id.startsWith('ferry:')) continue
    const edges: SettlementEdge[] = []
    for (const cell of sector.cells) {
      if (!cell.safe || !isGround(cell) || (!sector.townId && cell.terrain !== 's')) continue
      for (const [dx, dy, side] of steps) {
        let x = cell.x + dx,
          y = cell.y + dy,
          neighbor: WorldSectorView | undefined = sector
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
          if (!sector.charted || sector.atlasColumn === undefined || sector.atlasRow === undefined)
            continue
          const next = atlasNeighbor(sector.atlasColumn, sector.atlasRow, dx, dy)
          neighbor = next ? byAtlas.get(address(next.column, next.row)) : undefined
          x = (x + GRID_WIDTH) % GRID_WIDTH
          y = (y + GRID_HEIGHT) % GRID_HEIGHT
        }
        const outside = neighbor && terrain.get(neighbor)?.get(address(x, y))
        if (isGround(outside) && !outside.safe)
          edges.push({
            x: cell.x,
            y: cell.y,
            side,
            road: outside.terrain === '=' && (cell.terrain === '=' || cell.terrain === 's'),
          })
      }
    }
    if (edges.length) field.set(sector.id, edges)
  }
  return field
}

/** Bake a stone lip into the settlement side of the ground, under scenery and actors. */
export function paintSettlementEdges(
  context: CanvasRenderingContext2D,
  edges: readonly SettlementEdge[],
  tile: number,
  stone: string,
) {
  for (const { x, y, side, road } of edges) {
    const width = tile * (road ? 0.28 : 0.15)
    const startX = (x + Number(side === 1 || side === 2)) * tile
    const startY = (y + Number(side === 2 || side === 3)) * tile
    context.save()
    context.translate(startX, startY)
    context.rotate((side * Math.PI) / 2)
    context.fillStyle = 'rgba(31,28,25,.52)'
    context.fillRect(0, 0, tile, width)
    context.fillStyle = stone
    context.fillRect(0, width * 0.2, tile, width * 0.8)
    context.fillStyle = 'rgba(238,224,193,.28)'
    context.fillRect(0, width * 0.2, tile, width * 0.15)
    context.fillStyle = 'rgba(40,35,30,.40)'
    for (const joint of [0.25, 0.59, 0.84])
      context.fillRect(tile * joint, width * 0.2, tile * 0.014, width * 0.8)
    context.restore()
  }
}
