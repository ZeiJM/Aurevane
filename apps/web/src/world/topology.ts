import type { WorldPosition, WorldRoad, WorldSector } from './types'
import { parseSectorCoordinate } from './sector-crossings'

export interface WorldTopologyIssue {
  code:
    | 'DUPLICATE_SECTOR_ID'
    | 'DUPLICATE_SECTOR_COORDINATE'
    | 'INVALID_SECTOR_COORDINATE'
    | 'INVALID_SECTOR_ROWS'
    | 'INVALID_LANDMARK'
    | 'INVALID_ROAD_SOURCE'
    | 'UNKNOWN_ROAD_TARGET'
    | 'BLOCKED_ROAD_ENDPOINT'
    | 'INVALID_ROAD_DURATION'
    | 'INVALID_ROAD_NAME'
    | 'MISSING_RECIPROCAL_ROAD'
  sectorId: string
  detail: string
}

function positionKey(position: WorldPosition) {
  return `${position.sectorId}:${position.x}:${position.y}`
}

function isInside(sector: Pick<WorldSector, 'rows'>, position: Pick<WorldPosition, 'x' | 'y'>) {
  const height = sector.rows.length
  const width = sector.rows[0]?.length ?? 0
  return (
    Number.isInteger(position.x) &&
    Number.isInteger(position.y) &&
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < width &&
    position.y < height
  )
}

function isWalkable(sector: Pick<WorldSector, 'rows'>, position: Pick<WorldPosition, 'x' | 'y'>) {
  return isInside(sector, position) && ['.', '=', 's'].includes(sector.rows[position.y]?.[position.x] ?? '#')
}

function hasReciprocalRoad(target: WorldSector, road: WorldRoad) {
  return target.roads.some(
    (candidate) =>
      positionKey(candidate.from) === positionKey(road.to) &&
      positionKey(candidate.to) === positionKey(road.from) &&
      candidate.name === road.name &&
      candidate.durationMs === road.durationMs,
  )
}

export function validateWorldTopology(sectors: readonly WorldSector[]): WorldTopologyIssue[] {
  const issues: WorldTopologyIssue[] = []
  const byId = new Map<string, WorldSector>()
  const coordinateOwner = new Map<string, string>()

  for (const sector of sectors) {
    if (byId.has(sector.id)) {
      issues.push({
        code: 'DUPLICATE_SECTOR_ID',
        sectorId: sector.id,
        detail: `Sector id ${sector.id} is authored more than once.`,
      })
    } else byId.set(sector.id, sector)

    const owner = coordinateOwner.get(sector.coordinate)
    if (owner) {
      issues.push({
        code: 'DUPLICATE_SECTOR_COORDINATE',
        sectorId: sector.id,
        detail: `${sector.coordinate} is already owned by ${owner}.`,
      })
    } else coordinateOwner.set(sector.coordinate, sector.id)

    if (!parseSectorCoordinate(sector.coordinate)) {
      issues.push({
        code: 'INVALID_SECTOR_COORDINATE',
        sectorId: sector.id,
        detail: `${sector.coordinate} is not a valid 32×16 Atlas coordinate.`,
      })
    }

    const width = sector.rows[0]?.length ?? 0
    if (!width || !sector.rows.length || sector.rows.some((row) => row.length !== width)) {
      issues.push({
        code: 'INVALID_SECTOR_ROWS',
        sectorId: sector.id,
        detail: 'Sector rows must form a non-empty rectangular local map.',
      })
      continue
    }

    for (const landmark of sector.landmarks)
      if (!isWalkable(sector, landmark))
        issues.push({
          code: 'INVALID_LANDMARK',
          sectorId: sector.id,
          detail: `Landmark ${landmark.id} is outside the local map or sits on blocked terrain.`,
        })
  }

  for (const sector of sectors) {
    for (const road of sector.roads) {
      if (road.from.sectorId !== sector.id || !isInside(sector, road.from)) {
        issues.push({
          code: 'INVALID_ROAD_SOURCE',
          sectorId: sector.id,
          detail: `Road ${road.name || '(unnamed)'} has a source outside ${sector.id}.`,
        })
        continue
      }

      const target = byId.get(road.to.sectorId)
      if (!target) {
        issues.push({
          code: 'UNKNOWN_ROAD_TARGET',
          sectorId: sector.id,
          detail: `Road ${road.name || '(unnamed)'} targets unknown sector ${road.to.sectorId}.`,
        })
        continue
      }

      if (!isWalkable(sector, road.from) || !isWalkable(target, road.to))
        issues.push({
          code: 'BLOCKED_ROAD_ENDPOINT',
          sectorId: sector.id,
          detail: `Road ${road.name || '(unnamed)'} must connect walkable authored cells.`,
        })

      if (!Number.isFinite(road.durationMs) || road.durationMs <= 0)
        issues.push({
          code: 'INVALID_ROAD_DURATION',
          sectorId: sector.id,
          detail: `Road ${road.name || '(unnamed)'} must have a positive duration.`,
        })

      if (!road.name.trim())
        issues.push({
          code: 'INVALID_ROAD_NAME',
          sectorId: sector.id,
          detail: 'World roads require a player-facing name.',
        })

      if (!hasReciprocalRoad(target, road))
        issues.push({
          code: 'MISSING_RECIPROCAL_ROAD',
          sectorId: sector.id,
          detail: `Road ${road.name || '(unnamed)'} lacks an exact reciprocal crossing in ${target.id}.`,
        })
    }
  }

  return issues
}

export function assertWorldTopology(sectors: readonly WorldSector[]) {
  const issues = validateWorldTopology(sectors)
  if (issues.length)
    throw new Error(
      ['Invalid authored world topology:', ...issues.map((issue) => `[${issue.code}] ${issue.detail}`)].join(
        '\n',
      ),
    )
}
