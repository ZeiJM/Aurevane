import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { atlasNeighbor, WORLD_MAP_WIDTH } from '@/world/topology'
import type { WorldCell, WorldSectorView } from '@/world/types'
import { hashString } from '@/world/terrain-gen'

type Ground = ReadonlyMap<string, WorldCell>
type Port = readonly [number, number]
const directions = [
  [0, -1, 0.5, 0],
  [1, 0, 1, 0.5],
  [0, 1, 0.5, 1],
  [-1, 0, 0, 0.5],
] as const
const road = (cell: WorldCell | undefined) =>
  cell?.walkable && (cell.terrain === '=' || cell.terrain === 's')

/** Most countryside road authority has no visible paving or continuous stripe. */
export function naturalTrailWear(sector: WorldSectorView, cell: WorldCell) {
  if (
    sector.townId ||
    sector.landmarks.some((l) => Math.abs(l.x - cell.x) + Math.abs(l.y - cell.y) <= 4)
  )
    return 1
  const worldX = (sector.atlasColumn ?? sector.sceneColumn ?? 0) * GRID_WIDTH + cell.x
  const x = sector.charted
    ? ((worldX % WORLD_MAP_WIDTH) + WORLD_MAP_WIDTH) % WORLD_MAP_WIDTH
    : worldX
  const y = (sector.atlasRow ?? sector.sceneRow ?? 0) * GRID_HEIGHT + cell.y
  const wear =
    hashString(
      `${sector.charted ? 'public' : sector.id}:${Math.floor(x / 3)}:${Math.floor(y / 3)}:footpath`,
    ) % 100
  return wear < 64 ? 0 : 0.22 + ((wear - 64) / 35) * 0.5
}

/** Read only supplied public neighbors; a missing chunk never supplies a road. */
export function buildTrailGround(
  sector: WorldSectorView,
  sectors: readonly WorldSectorView[],
): Ground {
  const ground = new Map(sector.cells.map((cell) => [`${cell.x}:${cell.y}`, cell]))
  if (!sector.charted || sector.atlasColumn === undefined || sector.atlasRow === undefined)
    return ground
  for (const [dx, dy] of directions) {
    const address = atlasNeighbor(sector.atlasColumn, sector.atlasRow, dx, dy)
    const neighbor =
      address &&
      sectors.find(
        (s) => s.charted && s.atlasColumn === address.column && s.atlasRow === address.row,
      )
    if (!neighbor) continue
    for (const cell of neighbor.cells) {
      const x = cell.x + dx * GRID_WIDTH,
        y = cell.y + dy * GRID_HEIGHT
      if (x >= -1 && x <= GRID_WIDTH && y >= -1 && y <= GRID_HEIGHT)
        ground.set(`${x}:${y}`, { ...cell, x, y })
    }
  }
  return ground
}

/** Shared midpoint ports keep the visual path joined without moving legal cells. */
export function trailPorts(cell: WorldCell, terrain: Ground): Port[] {
  if (!road(cell)) return []
  return directions
    .filter(([dx, dy]) => road(terrain.get(`${cell.x + dx}:${cell.y + dy}`)))
    .map(([, , x, y]) => [x, y])
}

/** Cached worn earth; the original underlying regional material remains visible. */
export function paintNaturalTrail(
  context: CanvasRenderingContext2D,
  cell: WorldCell,
  tile: number,
  terrain: Ground,
  colour: string,
  seed: string,
  winter: boolean,
  wear = 1,
) {
  const ports = trailPorts(cell, terrain)
  if (!ports.length || wear <= 0) return 0
  const salt = hashString(`${seed}:${cell.x}:${cell.y}:trail`)
  const cx = 0.5 + ((salt % 17) / 16 - 0.5) * 0.12,
    cy = 0.5 + (((salt >>> 8) % 17) / 16 - 0.5) * 0.12
  context.save()
  context.beginPath()
  context.rect(cell.x * tile, cell.y * tile, tile, tile)
  context.clip()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = colour
  for (const [width, alpha] of [
    [0.48, 0.035],
    [0.31, 0.08],
    [0.18, winter ? 0.12 : 0.17],
  ]) {
    context.globalAlpha = alpha! * wear
    context.lineWidth = tile * width!
    context.beginPath()
    for (const [x, y] of ports) {
      context.moveTo((cell.x + x) * tile, (cell.y + y) * tile)
      context.quadraticCurveTo(
        (cell.x + cx) * tile,
        (cell.y + cy) * tile,
        (cell.x + 0.5) * tile,
        (cell.y + 0.5) * tile,
      )
    }
    context.stroke()
  }
  context.restore()
  return ports.length
}
