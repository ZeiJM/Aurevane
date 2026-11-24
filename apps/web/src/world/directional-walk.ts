import type { MapDirection } from './wild-ids'
import { STEP_MS } from './catalog'
import { sectorMapOrigin } from './topology'
import { isWalkable, samePosition, validCell } from './travel'
import type { TravelStep, WorldPosition, WorldSector, WorldSectorView } from './types'

export const KEY_LOOKAHEAD_STEPS = 3
export const walkOffset = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
} as const

type Sector = WorldSector | WorldSectorView

/** Follow only forward cardinal edges. A delayed target bounds distance, never changes the lane. */
export function directionalWalk(
  from: WorldPosition,
  destination: WorldPosition,
  direction: MapDirection,
  sectorAt: (id: string) => Sector | null | undefined,
  known?: (position: WorldPosition) => boolean,
  underway?: TravelStep,
): TravelStep[] {
  let sector = sectorAt(from.sectorId)
  const target = sectorAt(destination.sectorId)
  if (!sector || !target) return []
  const offset = walkOffset[direction]
  let origin = sectorMapOrigin(sector)
  const targetOrigin = sectorMapOrigin(target, origin.x + from.x)
  // A turn can finish one previously approved edge when the player requested its lane.
  // Delayed input must never replay the remainder of an earlier click or held key.
  const route: TravelStep[] = []
  if (underway) {
    const corner = sectorAt(underway.position.sectorId)
    if (corner) {
      const cornerOrigin = sectorMapOrigin(corner, origin.x + from.x)
      const axis = offset.x ? 'x' : 'y'
      const perpendicular = offset.x ? 'y' : 'x'
      const lane = cornerOrigin[perpendicular] + underway.position[perpendicular]
      if (
        cornerOrigin[axis] + underway.position[axis] === origin[axis] + from[axis] &&
        Math.abs(lane - origin[perpendicular] - from[perpendicular]) === 1 &&
        lane === targetOrigin[perpendicular] + destination[perpendicular]
      ) {
        route.push(underway)
        from = underway.position
        sector = corner
        origin = cornerOrigin
      }
    }
  }
  const forward =
    offset.x * (targetOrigin.x + destination.x - origin.x - from.x) +
    offset.y * (targetOrigin.y + destination.y - origin.y - from.y)
  for (let step = 0; step < Math.min(forward, KEY_LOOKAHEAD_STEPS); step++) {
    let position = { ...from, x: from.x + offset.x, y: from.y + offset.y }
    let durationMs = sector.stepMs ?? STEP_MS
    let road: string | undefined
    if (!validCell(position)) {
      const roads = 'roads' in sector ? sector.roads : sector.exits
      const exit = roads.find((r) => {
        if (!samePosition(from, r.from)) return false
        const neighbor = sectorAt(r.to.sectorId)
        if (!neighbor) return false
        const next = sectorMapOrigin(neighbor, origin.x + position.x)
        return (
          next.x + r.to.x === origin.x + position.x && next.y + r.to.y === origin.y + position.y
        )
      })
      if (!exit) break
      position = exit.to
      durationMs = exit.durationMs
      road = exit.name
      sector = sectorAt(position.sectorId)!
      origin = sectorMapOrigin(sector, origin.x + from.x + offset.x)
    }
    const walkable =
      'rows' in sector
        ? isWalkable(sector, position)
        : sector.cells.some(
            (cell) => cell.x === position.x && cell.y === position.y && cell.walkable,
          )
    if (!walkable || (known && !known(position))) break
    route.push({ position, durationMs, ...(road ? { road } : {}) })
    from = position
  }
  return route
}
