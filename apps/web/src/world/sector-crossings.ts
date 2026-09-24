import type { WorldRoad, WorldSector } from './types'

const ATLAS_COLUMNS = 32
const ATLAS_ROWS = 16

export type SectorNeighborDirection = 'north' | 'south' | 'east' | 'west'
export type CrossingSector = Pick<WorldSector, 'id' | 'coordinate' | 'rows'>

export interface AuthoredSectorCrossing {
  from: CrossingSector
  to: CrossingSector
  fromOffset: number
  toOffset: number
  name: string
  durationMs: number
}

export function parseSectorCoordinate(coordinate: string) {
  const match = /^S(\d{2})-(\d{2})$/.exec(coordinate)
  if (!match) return null
  const east = Number(match[1])
  const north = Number(match[2])
  if (east < 1 || east > ATLAS_COLUMNS || north < 1 || north > ATLAS_ROWS) return null
  return { east, north }
}

export function sectorNeighborDirection(
  fromCoordinate: string,
  toCoordinate: string,
): SectorNeighborDirection | null {
  const from = parseSectorCoordinate(fromCoordinate)
  const to = parseSectorCoordinate(toCoordinate)
  if (!from || !to) return null

  if (from.north === to.north) {
    const nextEast = from.east === ATLAS_COLUMNS ? 1 : from.east + 1
    const previousEast = from.east === 1 ? ATLAS_COLUMNS : from.east - 1
    if (to.east === nextEast) return 'east'
    if (to.east === previousEast) return 'west'
  }

  if (from.east === to.east) {
    if (to.north === from.north - 1) return 'north'
    if (to.north === from.north + 1) return 'south'
  }

  return null
}

function opposite(direction: SectorNeighborDirection): SectorNeighborDirection {
  if (direction === 'north') return 'south'
  if (direction === 'south') return 'north'
  if (direction === 'east') return 'west'
  return 'east'
}

function sectorDimensions(sector: CrossingSector) {
  const height = sector.rows.length
  const width = sector.rows[0]?.length ?? 0
  if (!width || !height || sector.rows.some((row) => row.length !== width))
    throw new Error(`Sector ${sector.id} must have rectangular authored rows.`)
  return { width, height }
}

function edgePosition(
  sector: CrossingSector,
  direction: SectorNeighborDirection,
  offset: number,
) {
  if (!Number.isInteger(offset)) throw new Error('Crossing offsets must be integers.')
  const { width, height } = sectorDimensions(sector)

  if (direction === 'east' || direction === 'west') {
    if (offset < 0 || offset >= height)
      throw new Error(`Crossing offset is outside ${sector.id}'s vertical edge.`)
    return { sectorId: sector.id, x: direction === 'east' ? width - 1 : 0, y: offset }
  }

  if (offset < 0 || offset >= width)
    throw new Error(`Crossing offset is outside ${sector.id}'s horizontal edge.`)
  return { sectorId: sector.id, x: offset, y: direction === 'south' ? height - 1 : 0 }
}

function isAuthoredWalkable(sector: CrossingSector, position: { x: number; y: number }) {
  return ['.', '=', 's'].includes(sector.rows[position.y]?.[position.x] ?? '#')
}

export function buildAuthoredSectorCrossing({
  from,
  to,
  fromOffset,
  toOffset,
  name,
  durationMs,
}: AuthoredSectorCrossing): readonly [WorldRoad, WorldRoad] {
  const direction = sectorNeighborDirection(from.coordinate, to.coordinate)
  if (!direction)
    throw new Error(
      `Sector crossing ${from.id} → ${to.id} requires orthogonally adjacent atlas coordinates.`,
    )
  if (!name.trim()) throw new Error('Sector crossings require a player-facing route name.')
  if (!Number.isFinite(durationMs) || durationMs <= 0)
    throw new Error('Sector crossing duration must be positive.')

  const fromPosition = edgePosition(from, direction, fromOffset)
  const toPosition = edgePosition(to, opposite(direction), toOffset)
  if (!isAuthoredWalkable(from, fromPosition))
    throw new Error(`Sector crossing starts on blocked terrain in ${from.id}.`)
  if (!isAuthoredWalkable(to, toPosition))
    throw new Error(`Sector crossing ends on blocked terrain in ${to.id}.`)

  return [
    { from: fromPosition, to: toPosition, name, durationMs },
    { from: toPosition, to: fromPosition, name, durationMs },
  ]
}
