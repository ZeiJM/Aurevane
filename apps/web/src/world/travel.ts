import { GRID_HEIGHT, GRID_WIDTH, START_POSITION, STEP_MS } from './catalog'
import { isWildSectorId } from './wild-ids'
import type { TravelStep, WorldObjective, WorldPosition, WorldSector, WorldState } from './types'
import { terrainWalkable } from './terrain'
import { wrappedMapDistance } from './topology'

export const ACTIVE_WORLD_SYNC_MS = 600
export const IDLE_WORLD_SYNC_MS = 10000
export function worldSyncDelayMs(state: {
  routeLength: number
  movementBlocked: boolean
  nextStepAt: number | null
  serverNow: number
  /** Real milliseconds until the last step lands, when known. */
  remainingMs?: number
}) {
  if (state.routeLength > 0 && !state.movementBlocked) {
    if (state.nextStepAt !== null) {
      // The client previews due steps itself, so the server only needs a confirmation every
      // so often (and exactly on arrival), which keeps requests from queueing behind each other.
      const untilNext = Math.max(0, state.nextStepAt - state.serverNow)
      const untilArrival = state.remainingMs ?? ACTIVE_WORLD_SYNC_MS
      return Math.max(untilNext, Math.min(ACTIVE_WORLD_SYNC_MS, untilArrival))
    }
    return ACTIVE_WORLD_SYNC_MS
  }
  return IDLE_WORLD_SYNC_MS
}

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
  return validCell(p) && terrainWalkable(sector.rows[p.y]?.[p.x] ?? '#')
}
export function isSafe(sector: WorldSector, p: { x: number; y: number }) {
  return (
    validCell(p) &&
    (sector.rows[p.y]?.[p.x] === 's' ||
      Boolean(sector.townId && (sector.id !== sector.townId || p.x < 10) && isWalkable(sector, p)))
  )
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
    discoveredAnchors: [],
    completedObjectives: [],
    objectiveProgress: {},
  }
}

const MAX_ROUTE_SEARCH = 90000
const MAX_ROUTE_STEPS = 1500
/** Existing database constraint. Long journeys replenish this window while moving. */
export const MAX_PERSISTED_ROUTE_STEPS = 256
class MinHeap<T> {
  private items: T[] = []
  constructor(private readonly less: (a: T, b: T) => number) {}
  get size() {
    return this.items.length
  }
  push(item: T) {
    const a = this.items
    a.push(item)
    let i = a.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.less(a[i]!, a[parent]!) >= 0) break
      ;[a[i], a[parent]] = [a[parent]!, a[i]!]
      i = parent
    }
  }
  pop(): T | undefined {
    const a = this.items
    if (!a.length) return undefined
    const top = a[0]!
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1,
          r = l + 1
        let m = i
        if (l < a.length && this.less(a[l]!, a[m]!) < 0) m = l
        if (r < a.length && this.less(a[r]!, a[m]!) < 0) m = r
        if (m === i) break
        ;[a[i], a[m]] = [a[m]!, a[i]!]
        i = m
      }
    }
    return top
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
  // Atlas-only routes have adjacent geometry and uniform 200ms costs; the Manhattan lower
  // bound cuts distant journeys from a world-wide flood to a narrow corridor. Historical
  // portal/trail graphs fall back to Dijkstra rather than assuming geometry they don't have.
  const atlasOnly = sectors.every(
    (s) =>
      s.atlasColumn !== undefined &&
      s.atlasRow !== undefined &&
      (s.stepMs ?? STEP_MS) >= STEP_MS &&
      s.roads.every((road) => {
        const target = lookup.get(road.to.sectorId)
        return (
          !target ||
          (target.atlasColumn !== undefined &&
            target.atlasRow !== undefined &&
            wrappedMapDistance(
              s.atlasColumn! * GRID_WIDTH + road.from.x,
              s.atlasRow! * GRID_HEIGHT + road.from.y,
              target.atlasColumn * GRID_WIDTH + road.to.x,
              target.atlasRow * GRID_HEIGHT + road.to.y,
            ) === 1 &&
            road.durationMs >= STEP_MS)
        )
      }),
  )
  const targetX = (target.atlasColumn ?? 0) * GRID_WIDTH + to.x,
    targetY = (target.atlasRow ?? 0) * GRID_HEIGHT + to.y
  const estimate = (p: WorldPosition) => {
    if (!atlasOnly) return 0
    const sector = lookup.get(p.sectorId)!
    return (
      wrappedMapDistance(
        sector.atlasColumn! * GRID_WIDTH + p.x,
        sector.atlasRow! * GRID_HEIGHT + p.y,
        targetX,
        targetY,
      ) * STEP_MS
    )
  }
  const queue = new MinHeap<{ position: WorldPosition; cost: number; score: number }>(
    (a, b) => a.score - b.score || b.cost - a.cost,
  )
  queue.push({ position: from, cost: 0, score: estimate(from) })
  const costs = new Map([[positionKey(from), 0]])
  const prior = new Map<string, { from: WorldPosition; step: TravelStep }>()
  let found = false
  for (let count = 0; queue.size && count < MAX_ROUTE_SEARCH; count++) {
    const current = queue.pop()!
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
      durationMs: sector.stepMs ?? STEP_MS,
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
      queue.push({ position: step.position, cost, score: cost + estimate(step.position) })
    }
  }
  if (!found) return null
  const result: TravelStep[] = []
  let cursor = to
  while (!samePosition(cursor, from)) {
    const previous = prior.get(positionKey(cursor))
    if (!previous || result.length >= MAX_ROUTE_STEPS) return null
    result.unshift(previous.step)
    cursor = previous.from
  }
  return result
}
/**
 * A tick that arrives within this lag of its due time keeps the original schedule, so network
 * round trips never slow walking below the authored pace. A tick later than this (a suspended or
 * absent client) advances one step and reschedules from now: there is never offline catch-up.
 */
export const MOVEMENT_LAG_ALLOWANCE_MS = 8000
const MAX_STEPS_PER_TICK = 40
export function advanceWorldRoute(state: WorldState, now: number): WorldState {
  if (!state.route.length || state.nextStepAt === null || now < state.nextStepAt) return state
  const route = [...state.route]
  const first = route.shift()!
  let position = first.position
  if (now - state.nextStepAt > MOVEMENT_LAG_ALLOWANCE_MS)
    return {
      ...state,
      position,
      route,
      nextStepAt: route[0] ? now + route[0].durationMs : null,
    }
  let anchor = state.nextStepAt
  for (let taken = 1; route.length && taken < MAX_STEPS_PER_TICK; taken++) {
    const due = anchor + route[0]!.durationMs
    if (due > now) break
    anchor = due
    position = route.shift()!.position
  }
  return {
    ...state,
    position,
    route,
    nextStepAt: route[0] ? anchor + route[0].durationMs : null,
  }
}
/** Saved routes must still match the authored topology and movement costs after a content update. */
export function isCurrentWorldRoute(
  from: WorldPosition,
  route: readonly TravelStep[],
  sectors: readonly WorldSector[],
  known: (p: WorldPosition) => boolean,
) {
  const lookup = new Map(sectors.map((sector) => [sector.id, sector]))
  let previous = from
  for (const step of route) {
    const source = lookup.get(previous.sectorId),
      target = lookup.get(step.position.sectorId)
    if (!source || !target || !isWalkable(target, step.position) || !known(step.position))
      return false
    const adjacent =
      previous.sectorId === step.position.sectorId &&
      Math.abs(previous.x - step.position.x) + Math.abs(previous.y - step.position.y) === 1 &&
      step.durationMs === (source.stepMs ?? STEP_MS)
    const crossing = source.roads.some(
      (road) =>
        samePosition(road.from, previous) &&
        samePosition(road.to, step.position) &&
        road.durationMs === step.durationMs,
    )
    if (!adjacent && !crossing) return false
    previous = step.position
  }
  return true
}
export function remainingTravelMs(state: Pick<WorldState, 'route' | 'nextStepAt'>, now: number) {
  if (!state.route.length || state.nextStepAt === null) return 0
  return (
    Math.max(0, state.nextStepAt - now) +
    state.route.slice(1).reduce((ms, step) => ms + step.durationMs, 0)
  )
}
export function revealNearby(state: WorldState): WorldState {
  const p = state.position
  const cells = new Set(state.discoveries[p.sectorId] ?? [])
  // Generated wilds reveal whole as they are entered; authored ground is surveyed around you.
  if (isWildSectorId(p.sectorId)) for (let i = 0; i < GRID_WIDTH * GRID_HEIGHT; i++) cells.add(i)
  for (let y = p.y - 2; y <= p.y + 2; y++)
    for (let x = p.x - 2; x <= p.x + 2; x++) if (validCell({ x, y })) cells.add(y * GRID_WIDTH + x)
  return {
    ...state,
    discoveries: { ...state.discoveries, [p.sectorId]: [...cells].sort((a, b) => a - b) },
  }
}
