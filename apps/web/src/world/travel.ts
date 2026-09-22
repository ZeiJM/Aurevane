import { GRID_HEIGHT, GRID_WIDTH, START_POSITION, STEP_MS } from './catalog'
import type { TravelStep, WorldObjective, WorldPosition, WorldSector, WorldState } from './types'

export const positionKey = (p: WorldPosition) => `${p.sectorId}:${p.x}:${p.y}`
export function samePosition(a: WorldPosition, b: WorldPosition) {
  return positionKey(a) === positionKey(b)
}
export function validCell(p: { x: number; y: number }) {
  return (
    Number.isInteger(p.x) &&
    Number.isInteger(p.y) &&
    p.x >= 0 &&
    p.x < GRID_WIDTH &&
    p.y >= 0 &&
    p.y < GRID_HEIGHT
  )
}
export function cellCenter(p: { x: number; y: number }) {
  return { x: (p.x + 0.5) / GRID_WIDTH, y: (p.y + 0.5) / GRID_HEIGHT }
}
export function isWalkable(sector: WorldSector, p: { x: number; y: number }) {
  return validCell(p) && ['.', '=', 's'].includes(sector.rows[p.y]?.[p.x] ?? '#')
}
export function isSafe(sector: WorldSector, p: { x: number; y: number }) {
  return validCell(p) && sector.rows[p.y]?.[p.x] === 's'
}
export function canAutoPath(objective: Pick<WorldObjective, 'kind' | 'autoPath' | 'guidance'>) {
  return objective.autoPath && objective.guidance === 'exact'
}
export function newWorldState(): WorldState {
  return {
    version: 1,
    position: { ...START_POSITION },
    route: [],
    nextStepAt: null,
    discoveries: {},
    completedObjectives: [],
  }
}

/** Bounded Dijkstra search: ordinary cells plus explicitly authored regional roads. */
export function findWorldRoute(
  from: WorldPosition,
  to: WorldPosition,
  sectors: readonly WorldSector[],
  known?: (p: WorldPosition) => boolean,
): TravelStep[] | null {
  const lookup = new Map(sectors.map((s) => [s.id, s]))
  const target = lookup.get(to.sectorId)
  if (!target || !isWalkable(target, to) || (known && !known(to))) return null
  const queue = [{ position: from, cost: 0 }]
  const costs = new Map([[positionKey(from), 0]])
  const prior = new Map<string, { from: WorldPosition; step: TravelStep }>()
  let found = false
  for (let count = 0; queue.length && count < 1500; count++) {
    queue.sort((a, b) => a.cost - b.cost)
    const current = queue.shift()!
    if (current.cost !== costs.get(positionKey(current.position))) continue
    if (samePosition(current.position, to)) {
      found = true
      break
    }
    const sector = lookup.get(current.position.sectorId)
    if (!sector) continue
    const adjacent: TravelStep[] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].map(([dx, dy]) => ({
      position: { ...current.position, x: current.position.x + dx!, y: current.position.y + dy! },
      durationMs: STEP_MS,
    }))
    for (const road of sector.roads)
      if (samePosition(road.from, current.position))
        adjacent.push({ position: road.to, durationMs: road.durationMs, road: road.name })
    for (const step of adjacent) {
      const nextSector = lookup.get(step.position.sectorId)
      if (!nextSector || !isWalkable(nextSector, step.position) || (known && !known(step.position)))
        continue
      const key = positionKey(step.position),
        cost = current.cost + step.durationMs
      if (cost >= (costs.get(key) ?? Infinity)) continue
      costs.set(key, cost)
      prior.set(key, { from: current.position, step })
      queue.push({ position: step.position, cost })
    }
  }
  if (!found) return null
  const result: TravelStep[] = []
  let cursor = to
  while (!samePosition(cursor, from)) {
    const previous = prior.get(positionKey(cursor))
    if (!previous || result.length >= 256) return null
    result.unshift(previous.step)
    cursor = previous.from
  }
  return result
}
export function advanceWorldRoute(state: WorldState, now: number): WorldState {
  if (!state.route.length || state.nextStepAt === null || now < state.nextStepAt) return state
  const [step, ...route] = state.route
  return {
    ...state,
    position: step!.position,
    route,
    nextStepAt: route[0] ? now + route[0].durationMs : null,
  }
}
export function revealNearby(state: WorldState): WorldState {
  const p = state.position
  const cells = new Set(state.discoveries[p.sectorId] ?? [])
  for (let y = p.y - 2; y <= p.y + 2; y++)
    for (let x = p.x - 2; x <= p.x + 2; x++) if (validCell({ x, y })) cells.add(y * GRID_WIDTH + x)
  return {
    ...state,
    discoveries: { ...state.discoveries, [p.sectorId]: [...cells].sort((a, b) => a - b) },
  }
}
