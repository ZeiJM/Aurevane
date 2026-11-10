import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { atlasNeighbor } from '@/world/topology'
import type { WorldCell, WorldSectorView } from '@/world/types'
import type { CoastEdge } from './map-coast'

type Side = 0 | 1 | 2 | 3
interface SettlementEdge {
  x: number
  y: number
  side: Side
}

const steps = [
  [0, -1, 0],
  [1, 0, 1],
  [0, 1, 2],
  [-1, 0, 3],
] as const

const address = (x: number, y: number) => `${x}:${y}`
type CoastField = ReadonlyMap<string, readonly CoastEdge[]>

function bordersOpenSea(coasts: CoastField | undefined, sectorId: string, x: number, y: number) {
  return coasts?.get(sectorId)?.some(({ side, from, to }) => {
    const along = side % 2 ? y : x
    if (along < from || along >= to) return false
    if (side === 0) return y === 0
    if (side === 1) return x === GRID_WIDTH - 1
    if (side === 2) return y === GRID_HEIGHT - 1
    return x === 0
  })
}

function nearBuildings(sector: WorldSectorView, { x, y }: WorldCell) {
  return sector.buildings?.some((building) => {
    const dx = Math.max(building.x - x, 0, x - (building.x + building.width - 1))
    const dy = Math.max(building.y - y, 0, y - (building.y + building.height - 1))
    return dx + dy <= 3
  })
}

/** Stone is reserved for built-up road entrances with dry ground on both sides. */
export function buildSettlementEdges(sectors: readonly WorldSectorView[], coasts?: CoastField) {
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

  function groundAt(sector: WorldSectorView, x: number, y: number) {
    let neighbor = sector
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
      if (!sector.charted || sector.atlasColumn === undefined || sector.atlasRow === undefined)
        return
      const dx = x < 0 ? -1 : x >= GRID_WIDTH ? 1 : 0
      const dy = y < 0 ? -1 : y >= GRID_HEIGHT ? 1 : 0
      const next = atlasNeighbor(sector.atlasColumn, sector.atlasRow, dx, dy)
      const loaded = next && byAtlas.get(address(next.column, next.row))
      if (!loaded) return
      neighbor = loaded
      x = (x + GRID_WIDTH) % GRID_WIDTH
      y = (y + GRID_HEIGHT) % GRID_HEIGHT
    }
    return { cell: terrain.get(neighbor)?.get(address(x, y)), sector: neighbor, x, y }
  }

  function nearShore(sector: WorldSectorView, x: number, y: number) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const ground = groundAt(sector, x + dx, y + dy)
        if (
          ground &&
          (ground.cell?.terrain === '~' ||
            ground.cell?.terrain === 'l' ||
            bordersOpenSea(coasts, ground.sector.id, ground.x, ground.y))
        )
          return true
      }
    return false
  }

  const field = new Map<string, SettlementEdge[]>()
  for (const sector of sectors) {
    if (!sector.townId || !sector.buildings?.length) continue
    const edges: SettlementEdge[] = []
    for (const cell of sector.cells) {
      if (!cell.safe || !cell.walkable || (cell.terrain !== '=' && cell.terrain !== 's')) continue
      if (!nearBuildings(sector, cell)) continue
      for (const [dx, dy, side] of steps) {
        const outside = groundAt(sector, cell.x + dx, cell.y + dy)
        if (!outside?.cell?.walkable || outside.cell.safe || outside.cell.terrain !== '=') continue
        if (nearShore(sector, cell.x, cell.y) || nearShore(outside.sector, outside.x, outside.y))
          continue
        edges.push({ x: cell.x, y: cell.y, side })
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
  for (const { x, y, side } of edges) {
    const width = tile * 0.21
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
