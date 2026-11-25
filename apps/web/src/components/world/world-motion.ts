import type { MapDirection } from '@/world/wild-ids'
import { directionalWalk, KEY_LOOKAHEAD_STEPS, walkOffset } from '@/world/directional-walk'
import { GRID_HEIGHT, GRID_WIDTH, STEP_MS } from '@/world/catalog'
import {
  findWorldRoute,
  MAX_STEPS_PER_TICK,
  MOVEMENT_LAG_ALLOWANCE_MS,
  positionKey,
} from '@/world/travel'
import type { TravelStep, WorldPosition, WorldSectorView, WorldView } from '@/world/types'
import { sectorMapOrigin, wrappedMapX } from '@/world/topology'

export interface MapPoint {
  x: number
  y: number
}
export function mapPoint(
  position: WorldPosition,
  sectors: readonly WorldSectorView[],
  reference?: MapPoint,
): MapPoint {
  const sector = sectors.find((s) => s.id === position.sectorId)
  const origin = sector ? sectorMapOrigin(sector, reference?.x) : { x: 0, y: 0 }
  return {
    x: origin.x + position.x + 0.5,
    y: origin.y + position.y + 0.5,
  }
}
function routePoints(
  route: readonly TravelStep[],
  sectors: readonly WorldSectorView[],
  origin: MapPoint,
) {
  let previous = origin
  return route.map((step) => {
    const point = mapPoint(step.position, sectors, previous)
    previous = point
    return { point, position: step.position, duration: step.durationMs }
  })
}
type LocalNavigator = (from: WorldPosition, to: WorldPosition) => TravelStep[] | null
const navigationCache = new WeakMap<readonly WorldSectorView[], LocalNavigator>()
/** Reuse navigation while the supplied terrain snapshot retains its identity. */
export function prepareLocalRoute(view: Pick<WorldView, 'sectors'>) {
  const cached = navigationCache.get(view.sectors)
  if (cached) return cached
  const known = new Set<string>()
  const sectors = view.sectors.map((sector) => {
    const terrain = Array<string>(GRID_WIDTH * GRID_HEIGHT).fill('?')
    for (const cell of sector.cells) {
      known.add(positionKey({ sectorId: sector.id, x: cell.x, y: cell.y }))
      terrain[cell.y * GRID_WIDTH + cell.x] = cell.walkable ? cell.terrain : '?'
    }
    return {
      ...sector,
      rows: Array.from({ length: GRID_HEIGHT }, (_, y) =>
        terrain.slice(y * GRID_WIDTH, (y + 1) * GRID_WIDTH).join(''),
      ),
      roads: sector.exits,
    }
  })
  const navigate: LocalNavigator = (from, to) =>
    findWorldRoute(from, to, sectors, (position) => known.has(positionKey(position)))
  navigationCache.set(view.sectors, navigate)
  return navigate
}
export function localRoute(view: WorldView, from: WorldPosition, to: WorldPosition) {
  return prepareLocalRoute(view)(from, to)
}
export function worldInteractionRange(from: WorldPosition, target: WorldPosition, radius = 1) {
  return (
    from.sectorId === target.sectorId &&
    Math.abs(from.x - target.x) + Math.abs(from.y - target.y) <= radius
  )
}

export function worldApproachRoute(
  view: WorldView,
  from: WorldPosition,
  target: WorldPosition,
  radius = 1,
) {
  const sector = view.sectors.find(({ id }) => id === target.sectorId)
  if (!sector) return null
  const navigate = prepareLocalRoute(view)
  let best: { destination: WorldPosition; route: TravelStep[]; time: number } | null = null
  for (const cell of sector.cells) {
    const destination = { sectorId: target.sectorId, x: cell.x, y: cell.y }
    if (!cell.walkable || !worldInteractionRange(destination, target, radius)) continue
    const route = navigate(from, destination)
    if (!route) continue
    const time = route.reduce((total, step) => total + step.durationMs, 0)
    if (
      best === null ||
      time < best.time ||
      (time === best.time && positionKey(best.destination) === positionKey(target))
    ) {
      best = { destination, route, time }
    }
  }
  return best
}

/** Keep the first visible step responsive when a public destination extends past the scene receipt. */
export function clickWalkPreview(view: WorldView, from: WorldPosition, to: WorldPosition) {
  const exact = localRoute(view, from, to)
  if (exact || view.sectors.some(({ id }) => id === to.sectorId)) return exact
  const source = view.sectors.find(({ id }) => id === from.sectorId)
  const target = view.atlas?.find(({ id, charted }) => id === to.sectorId && charted)
  if (!source?.charted || !target) return null
  const origin = mapPoint(from, view.sectors)
  const goal = {
    x: wrappedMapX(target.column * GRID_WIDTH + to.x + 0.5, origin.x),
    y: target.row * GRID_HEIGHT + to.y + 0.5,
  }
  const sectors = new Map(view.sectors.map((sector) => [sector.id, sector]))
  let best: TravelStep | null = null
  let closest = Math.abs(goal.x - origin.x) + Math.abs(goal.y - origin.y)
  for (const direction of ['east', 'west', 'south', 'north'] as const) {
    const offset = walkOffset[direction]
    const neighbor = { ...from, x: from.x + offset.x, y: from.y + offset.y }
    const crossing = source.exits.find(({ from: departure, to: arrival }) => {
      if (positionKey(departure) !== positionKey(from)) return false
      const point = mapPoint(arrival, view.sectors, origin)
      return point.x === origin.x + offset.x && point.y === origin.y + offset.y
    })
    const step = directionalWalk(from, crossing?.to ?? neighbor, direction, (id) =>
      sectors.get(id),
    )[0]
    if (!step) continue
    const point = mapPoint(step.position, view.sectors, origin)
    const distance = Math.abs(goal.x - point.x) + Math.abs(goal.y - point.y)
    if (distance >= closest) continue
    closest = distance
    best = step
  }
  return best ? [best] : null
}

function loadedRoute(
  route: readonly TravelStep[],
  sectors: readonly WorldSectorView[],
  budget = Infinity,
) {
  const loaded = new Map(sectors.map((s) => [s.id, s])),
    result: TravelStep[] = []
  let elapsed = 0
  for (const step of route) {
    elapsed += step.durationMs
    const sector = loaded.get(step.position.sectorId)
    if (
      !sector ||
      (sector.cells &&
        !sector.cells.some(
          (cell) => cell.x === step.position.x && cell.y === step.position.y && cell.walkable,
        )) ||
      elapsed > budget
    )
      break
    result.push(step)
  }
  return result
}

/** The contiguous prefix with supplied walkable endpoints, legal edges and authored costs. */
function knownWalkableRoute(view: {
  position: WorldPosition
  sectors: readonly WorldSectorView[]
  route: readonly TravelStep[]
}) {
  const sectors = new Map(view.sectors.map((sector) => [sector.id, sector]))
  const knownWalkable = (position: WorldPosition) =>
    sectors
      .get(position.sectorId)
      ?.cells?.some((cell) => cell.x === position.x && cell.y === position.y && cell.walkable)
  const route: TravelStep[] = []
  let from = view.position
  for (const step of view.route) {
    const source = sectors.get(from.sectorId)
    if (
      !source ||
      !knownWalkable(from) ||
      !knownWalkable(step.position) ||
      !Number.isSafeInteger(step.durationMs) ||
      step.durationMs < STEP_MS ||
      !(
        (from.sectorId === step.position.sectorId &&
          Math.abs(from.x - step.position.x) + Math.abs(from.y - step.position.y) === 1 &&
          step.durationMs === (source.stepMs ?? STEP_MS)) ||
        source.exits?.some(
          (exit) =>
            positionKey(exit.from) === positionKey(from) &&
            positionKey(exit.to) === positionKey(step.position) &&
            exit.durationMs === step.durationMs,
        )
      )
    )
      break
    route.push(step)
    from = step.position
  }
  return route
}

function knownPositionAtPoint(
  point: MapPoint,
  sectors: readonly WorldSectorView[],
  previous: WorldPosition,
) {
  // Prefer the original private/legacy sector when addresses overlap.
  const preferred = sectors.find((sector) => sector.id === previous.sectorId)
  if (!preferred) return null
  for (const sector of [preferred, ...sectors.filter((sector) => sector !== preferred)]) {
    const origin = sectorMapOrigin(sector, point.x),
      x = Math.floor(point.x - origin.x),
      y = Math.floor(point.y - origin.y)
    if (sector.cells?.some((cell) => cell.x === x && cell.y === y && cell.walkable))
      return { sectorId: sector.id, x, y }
    if (sector === preferred && x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) return null
  }
  return null
}

type DirectionalTurn = { direction: MapDirection; corner: WorldPosition | null }

/** Visual interpolation has no authority over collision, encounter range or rewards. */
export class WorldMotion {
  private origin: MapPoint
  private route: { point: MapPoint; position: WorldPosition; duration: number }[] = []
  private startedAt = 0
  private previewEndsAt: number | null = null
  private standing: WorldPosition
  private approvedOrigin: WorldPosition
  private approvedRoute: readonly TravelStep[] = []
  private approvedVisualRoute: readonly TravelStep[] = []
  private approvedRawRoute: readonly TravelStep[] = []
  private approvedAt = 0
  private approvedFirstAt: number | null = null
  private movementFrozen = false
  private extendApprovedVisual = false
  private lastSampledAt = 0
  private suspendedAt: number | null = null
  private pendingTurn: DirectionalTurn | null = null
  constructor(view: WorldView, now = 0) {
    this.origin = mapPoint(view.position, view.sectors)
    this.standing = view.position
    this.approvedOrigin = view.position
    this.startedAt = now
    this.lastSampledAt = now
    this.approve(view, now)
    this.extendApprovedVisual =
      this.approvedFirstAt !== null &&
      view.sectors.some((sector) => sector.id === view.position.sectorId)
    if (this.approvedFirstAt !== null && this.approvedRoute.length) {
      // A freshly mounted scene has no earlier visual to preserve. Start at the
      // captured approved phase, including prefixes already due at the snapshot.
      this.route = routePoints(this.approvedRoute, view.sectors, this.origin)
      this.startedAt = this.approvedFirstAt - this.approvedRoute[0]!.durationMs
    }
  }
  private approve(view: WorldView, now: number) {
    this.approvedOrigin = view.position
    this.approvedAt = now
    this.approvedRawRoute = view.route
    const frozen = Boolean(view.movementBlocked || view.battleSessionId)
    this.movementFrozen = frozen
    if (frozen) this.clearPendingTurn()
    const validClock =
      Number.isSafeInteger(view.serverNow) &&
      view.serverNow >= 0 &&
      Number.isSafeInteger(view.nextStepAt) &&
      view.nextStepAt !== null &&
      view.nextStepAt >= 0 &&
      view.route.length > 0 &&
      view.nextStepAt <= view.serverNow + view.route[0]!.durationMs
    this.approvedFirstAt =
      !frozen && validClock
        ? view.serverNow - view.nextStepAt! > MOVEMENT_LAG_ALLOWANCE_MS
          ? now
          : now + view.nextStepAt! - view.serverNow
        : null
    this.loadApprovedScene(view.sectors)
  }
  /** Accept owned authority without replacing a newer local visual plan. */
  approveReceipt(view: WorldView, now: number): void {
    if (view.movementBlocked || view.battleSessionId) {
      this.reconcile(view, now)
      return
    }
    this.approve(view, now)
  }
  private loadApprovedScene(sectors: WorldView['sectors']) {
    this.approvedVisualRoute = this.movementFrozen
      ? []
      : loadedRoute(this.approvedRawRoute, sectors)
    this.approvedRoute =
      this.approvedFirstAt !== null
        ? knownWalkableRoute({
            position: this.approvedOrigin,
            route: this.approvedRawRoute,
            sectors,
          }).slice(0, MAX_STEPS_PER_TICK)
        : []
  }
  private trimVisualToScene(sectors: WorldView['sectors'], now: number) {
    const visual = this.sample(now)
    let elapsed = this.visualElapsed(now),
      index = 0
    while (index < this.route.length && elapsed + 1e-7 >= this.route[index]!.duration) {
      elapsed = Math.max(0, elapsed - this.route[index]!.duration)
      index++
    }
    const loaded = new Map(sectors.map((sector) => [sector.id, sector]))
    const known = (position: WorldPosition) =>
      loaded
        .get(position.sectorId)
        ?.cells?.some((cell) => cell.x === position.x && cell.y === position.y && cell.walkable)
    let from = visual.position
    for (let next = index; next < this.route.length; next++) {
      const step = this.route[next]!,
        source = loaded.get(from.sectorId)
      const adjacent =
        from.sectorId === step.position.sectorId &&
        Math.abs(from.x - step.position.x) + Math.abs(from.y - step.position.y) === 1
      const centering =
        next === index &&
        positionKey(from) === positionKey(step.position) &&
        knownPositionAtPoint(visual.point, sectors, visual.position) !== null
      const cost =
        adjacent || centering
          ? (source?.stepMs ?? STEP_MS)
          : source?.exits?.find(
              (exit) =>
                positionKey(exit.from) === positionKey(from) &&
                positionKey(exit.to) === positionKey(step.position),
            )?.durationMs
      const centre = mapPoint(from, sectors, visual.point)
      const target = mapPoint(step.position, sectors, visual.point)
      const edgeLength = Math.hypot(target.x - centre.x, target.y - centre.y) || 1
      const expectedRemaining =
        cost === undefined
          ? Number.NaN
          : (cost * Math.hypot(step.point.x - visual.point.x, step.point.y - visual.point.y)) /
            edgeLength
      const firstInterval =
        next === index &&
        knownPositionAtPoint(visual.point, sectors, visual.position) !== null &&
        Math.abs(step.duration - elapsed - expectedRemaining) < 1e-6
      const valid =
        known(from) &&
        known(step.position) &&
        cost !== undefined &&
        (next === index ? firstInterval : Math.abs(step.duration - cost) < 1e-7)
      if (!valid) {
        if (next === index) {
          // Newly withheld geometry cannot undo a point already presented, nor
          // permit another visual interval across that unavailable edge.
          this.origin = visual.point
          this.standing = visual.position
          this.route = []
          this.startedAt = now
          this.previewEndsAt = null
          this.extendApprovedVisual = false
        } else this.route = this.route.slice(0, next)
        return
      }
      from = step.position
    }
  }
  /** Continue an agreeing visual prefix as soon as its approved geometry is supplied. */
  updateScene(sectors: WorldView['sectors'], now = this.lastSampledAt): void {
    now = this.suspendedAt ?? now
    this.loadApprovedScene(sectors)
    this.trimVisualToScene(sectors, now)
    if (!this.extendApprovedVisual || this.movementFrozen || this.approvedFirstAt === null) return
    const positions = [this.approvedOrigin, ...this.approvedRawRoute.map((s) => s.position)]
    const from = positions.findIndex(
      (position) => positionKey(position) === positionKey(this.standing),
    )
    if (from < 0) return
    const loaded = knownWalkableRoute({
      position: this.standing,
      route: this.approvedRawRoute.slice(from),
      sectors,
    })
    const offset =
      this.route[0] &&
      positionKey(this.route[0].position) === positionKey(this.standing) &&
      this.route[0].duration < 1e-7
        ? 1
        : 0
    const existing = this.route.slice(offset)
    if (
      existing.some((step, index) => {
        const supplied = loaded[index]
        return (
          !supplied ||
          positionKey(step.position) !== positionKey(supplied.position) ||
          (index === 0
            ? step.duration > supplied.durationMs + 1e-7
            : Math.abs(step.duration - supplied.durationMs) > 1e-7)
        )
      })
    )
      return
    const tail = loaded.slice(existing.length)
    if (tail.length) {
      // Waiting at the edge of the loaded scene must not count as walking the next tile.
      const prefixMs = this.route.reduce((sum, step) => sum + step.duration, 0)
      this.startedAt = Math.max(this.startedAt, now - prefixMs)
      this.route.push(...routePoints(tail, sectors, this.route.at(-1)?.point ?? this.origin))
    }
  }
  /** Approved landed tile for display only; preview plans never change this clock. */
  approvedPosition(now: number): WorldPosition {
    let position = this.approvedOrigin
    if (this.approvedFirstAt === null) return position
    let deadline = this.approvedFirstAt
    for (let index = 0; index < this.approvedRoute.length; index++) {
      if (now + 1e-7 < deadline) break
      position = this.approvedRoute[index]!.position
      deadline += this.approvedRoute[index + 1]?.durationMs ?? 0
    }
    return position
  }
  approvedPositionAtReceipt(): WorldPosition {
    return this.approvedPosition(this.approvedAt)
  }
  /** Milliseconds to the next supplied approved landing; null after its loaded horizon. */
  nextApprovedTransitionDelay(now: number): number | null {
    if (this.approvedFirstAt === null) return null
    let deadline = this.approvedFirstAt
    for (let index = 0; index < this.approvedRoute.length; index++) {
      if (now + 1e-7 < deadline) return deadline - now
      deadline += this.approvedRoute[index + 1]?.durationMs ?? 0
    }
    return null
  }
  /** Remaining approved time on loaded known terrain, independent of optimistic input. */
  loadedHorizonMs(now: number): number {
    if (this.approvedFirstAt === null || !this.approvedRoute.length) return 0
    return Math.max(
      0,
      this.approvedFirstAt +
        this.approvedRoute.slice(1).reduce((sum, step) => sum + step.durationMs, 0) -
        now,
    )
  }
  private visualElapsed(now: number) {
    return Math.max(0, Math.min(now, this.previewEndsAt ?? now) - this.startedAt)
  }
  sample(now: number): { point: MapPoint; position: WorldPosition; moving: boolean } {
    now = this.suspendedAt ?? now
    this.lastSampledAt = now
    let elapsed = this.visualElapsed(now),
      point = this.origin,
      position = this.standing
    for (const step of this.route) {
      // Only absorb floating-point clock noise, never an authored walking interval.
      if (elapsed + 1e-7 < step.duration) {
        const amount = Math.min(1, elapsed / step.duration)
        return {
          point: {
            x: point.x + (step.point.x - point.x) * amount,
            y: point.y + (step.point.y - point.y) * amount,
          },
          position,
          moving: this.previewEndsAt === null || now + 1e-7 < this.previewEndsAt,
        }
      }
      elapsed = Math.max(0, elapsed - step.duration)
      point = step.point
      position = step.position
    }
    return { point, position, moving: false }
  }
  /** Finish the current supplied visual step when continuous input is released. */
  nextLanding(now: number): WorldPosition {
    now = this.suspendedAt ?? now
    let elapsed = this.visualElapsed(now)
    for (const step of this.route) {
      if (elapsed + 1e-7 < step.duration) return step.position
      elapsed = Math.max(0, elapsed - step.duration)
    }
    return this.sample(now).position
  }
  /** A turn made between centers finishes the current edge before taking its new heading. */
  directionalOrigin(
    direction: MapDirection,
    sectors: readonly WorldSectorView[],
    now: number,
    sample = this.sample(now),
  ) {
    const center = mapPoint(sample.position, sectors, sample.point)
    const perpendicular = walkOffset[direction].x ? 'y' : 'x'
    return Math.abs(sample.point[perpendicular] - center[perpendicular]) > 1e-7
      ? this.nextLanding(now)
      : sample.position
  }
  clearPendingTurn() {
    this.pendingTurn = null
  }
  /** An older movement write can advance the previous heading while the turn waits in the queue. */
  confirmDirectional(view: WorldView, turn: DirectionalTurn, now: number) {
    if (turn !== this.pendingTurn || this.movementFrozen) return
    const { direction } = turn
    const visual = this.sample(now)
    const axis = walkOffset[direction].x ? 'y' : 'x'
    this.pendingTurn = null
    if (
      turn.corner &&
      Math.abs(mapPoint(turn.corner, view.sectors, visual.point)[axis] - visual.point[axis]) < 1e-7
    )
      return
    const start = mapPoint(view.position, view.sectors, visual.point)
    const first = view.route[0]?.position
    const corner =
      turn.corner ??
      (first && mapPoint(first, view.sectors, start)[axis] !== start[axis] ? first : view.position)
    const prefix = localRoute(view, visual.position, corner)
    const index = view.route.findIndex((step) => positionKey(step.position) === positionKey(corner))
    const join =
      index < 0 && positionKey(view.position) !== positionKey(corner)
        ? localRoute(view, corner, view.position)
        : []
    if (!prefix || !join) {
      this.confirmApproved(view, now)
      return
    }
    this.plan(
      [...prefix, ...join, ...view.route.slice(index + 1)],
      view.sectors,
      now,
      'destination',
    )
    if (Math.abs(visual.point[axis] - mapPoint(corner, view.sectors, visual.point)[axis]) > 1e-7) {
      turn.corner = corner
      this.pendingTurn = turn
    }
  }
  planDirectional(
    destination: WorldPosition,
    direction: MapDirection,
    sectors: readonly WorldSectorView[],
    now: number,
    previousWritePending = false,
  ) {
    const sample = this.sample(now)
    const axis = walkOffset[direction].x ? 'y' : 'x'
    const turn = this.pendingTurn
    if (
      turn?.direction === direction &&
      (!turn.corner ||
        Math.abs(mapPoint(turn.corner, sectors, sample.point)[axis] - sample.point[axis]) > 1e-7)
    )
      return turn
    this.pendingTurn = null
    const landing = this.nextLanding(now)
    const pivot = this.directionalOrigin(direction, sectors, now, sample)
    const sectorAt = (id: string) => sectors.find((sector) => sector.id === id)
    let edge: TravelStep | null = null
    if (positionKey(sample.position) !== positionKey(pivot)) {
      const source = sectorAt(sample.position.sectorId)
      const crossing = source?.exits.find(
        (exit) =>
          positionKey(exit.from) === positionKey(sample.position) &&
          positionKey(exit.to) === positionKey(pivot),
      )
      edge = { position: pivot, durationMs: crossing?.durationMs ?? source?.stepMs ?? STEP_MS }
    }
    const landingPoint = mapPoint(landing, sectors, sample.point)
    if (sample.moving && Math.abs(landingPoint[axis] - sample.point[axis]) > 1e-7) {
      const nextIndex =
        this.approvedVisualRoute.findIndex(
          (step) => positionKey(step.position) === positionKey(landing),
        ) + 1
      const after = nextIndex && this.approvedVisualRoute[nextIndex]?.position
      const changingLane =
        after && mapPoint(after, sectors, landingPoint)[axis] !== landingPoint[axis]
      if (previousWritePending || changingLane) {
        // Finish the in-progress edge. The next write confirms the corner before turning.
        if (edge) this.plan([edge], sectors, now)
        else this.hold(now)
        this.pendingTurn = { direction, corner: null }
        return this.pendingTurn
      }
    }
    const route = directionalWalk(pivot, destination, direction, sectorAt)
    // OS-independent repeats replace one another while a write is in flight. They must
    // not grant fresh speculative distance every time the same key timer fires.
    const approved = mapPoint(this.approvedPosition(now), sectors, sample.point)
    const beyondApproval = route.findIndex((step) => {
      const target = mapPoint(step.position, sectors, approved)
      return Math.abs(target.x - approved.x) + Math.abs(target.y - approved.y) > KEY_LOOKAHEAD_STEPS
    })
    if (beyondApproval >= 0) route.length = beyondApproval
    if (edge) route.unshift(edge)
    if (route.length) this.plan(route, sectors, now)
    else this.hold(now)
  }
  plan(
    route: readonly TravelStep[],
    sectors: readonly WorldSectorView[],
    now: number,
    preview: 'bounded' | 'destination' = 'bounded',
  ) {
    if (this.movementFrozen) return
    now = this.suspendedAt ?? now
    const sample = this.sample(now)
    this.previewEndsAt = null
    // Routing may finish after an in-flight step lands. Discard that completed
    // prefix before applying the preview budget; retaining it rewinds the visual
    // or spends the whole slow-terrain preview on a tile already reached.
    const reached = route.findIndex(
      (step) => positionKey(step.position) === positionKey(sample.position),
    )
    if (reached >= 0) route = route.slice(reached + 1)
    // A fixed destination only needs visual prediction across edges that this
    // scene already proves. A slow acknowledgement must not interrupt that walk.
    if (preview === 'destination')
      route = knownWalkableRoute({ position: sample.position, sectors, route })
    if (!route.length) {
      const sector = sectors.find((sector) => sector.id === sample.position.sectorId)
      const centre = mapPoint(sample.position, sectors, sample.point)
      if (sector && Math.hypot(centre.x - sample.point.x, centre.y - sample.point.y) > 0.001)
        route = [{ position: sample.position, durationMs: sector.stepMs ?? STEP_MS }]
    }
    this.origin = sample.point
    this.standing = sample.position
    this.startedAt = now
    const approvedPositions = [
      this.approvedOrigin,
      ...this.approvedVisualRoute.map((s) => s.position),
    ]
    const approvedIndex = approvedPositions.findIndex(
      (position) => positionKey(position) === positionKey(sample.position),
    )
    let common = 0
    if (approvedIndex >= 0)
      for (const step of route) {
        const approved = this.approvedVisualRoute[approvedIndex + common]
        if (
          !approved ||
          positionKey(step.position) !== positionKey(approved.position) ||
          step.durationMs !== approved.durationMs
        )
          break
        common++
      }
    // A repeated destination must retain its still-approved prefix. Only the
    // newly predicted suffix spends the preview budget; never retain an old tail
    // beyond a shorter target or after the new route diverges.
    this.route = routePoints(loadedRoute(route, sectors), sectors, sample.point)
    const first = this.route[0]
    if (first) {
      const standing = mapPoint(sample.position, sectors, sample.point),
        distance = Math.hypot(first.point.x - sample.point.x, first.point.y - sample.point.y),
        wholeStep = Math.hypot(first.point.x - standing.x, first.point.y - standing.y)
      // Repeated clicks/held input must keep the same walking speed. A half-
      // finished step needs half its authored time, rather than a new full step.
      first.duration = (first.duration * distance) / (wholeStep || 1)
    }
    if (preview === 'bounded' && this.route.length) {
      let unconfirmed = 0
      const end = this.route.findIndex(
        (step, index) => index >= common && (unconfirmed += step.duration) > 600,
      )
      if (end >= 0) {
        // A partial turn seldom divides into whole 200ms intervals. Keep the
        // intersecting segment and freeze its clock at the exact preview bound;
        // dropping it would insert a pause before a timely approval arrives.
        this.previewEndsAt =
          now + this.route.slice(0, common).reduce((sum, step) => sum + step.duration, 0) + 600
        this.route = this.route.slice(0, end + 1)
      }
    }
    this.extendApprovedVisual =
      common === route.length &&
      Boolean(route.length) &&
      positionKey(route.at(-1)!.position) ===
        positionKey(this.approvedRawRoute.at(-1)?.position ?? this.approvedOrigin)
  }
  reconcile(view: WorldView, now: number) {
    const visual = this.sample(now)
    this.approve(view, now)
    this.reconcileVisual(view, now, visual)
  }
  /** Confirm the latest plan against authority already received through hydration. */
  confirmApproved(view: WorldView, now: number) {
    this.reconcileVisual(view, now, this.sample(now))
  }
  private reconcileVisual(view: WorldView, now: number, visual: ReturnType<WorldMotion['sample']>) {
    this.previewEndsAt = null
    now = this.suspendedAt ?? now
    this.extendApprovedVisual = this.approvedFirstAt !== null
    if (
      view.movementBlocked ||
      view.battleSessionId ||
      !view.sectors.some((sector) => sector.id === view.position.sectorId)
    ) {
      this.origin = visual.point
      this.standing = visual.position
      this.route = []
      this.startedAt = now
      this.extendApprovedVisual = false
      return
    }
    const authoritative = mapPoint(view.position, view.sectors, visual.point)
    const route = routePoints(loadedRoute(view.route, view.sectors), view.sectors, authoritative)
    if (
      this.extendApprovedVisual &&
      !route.length &&
      positionKey(visual.position) === positionKey(view.position) &&
      visual.point.x === authoritative.x &&
      visual.point.y === authoritative.y
    ) {
      // The first approved step may be just outside the current scene.
      this.origin = authoritative
      this.standing = view.position
      this.route = []
      this.startedAt = now
      return
    }
    // Find the visual point on the confirmed forward path. Late confirmations must not
    // rewind an already interpolated step, including at sector boundaries.
    const points = [{ point: authoritative, position: view.position, duration: 0 }, ...route]
    let nearest = 0,
      distance = Infinity,
      beforeOrigin = false
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!.point,
        b = points[i]!.point,
        dx = b.x - a.x,
        dy = b.y - a.y
      const length = dx * dx + dy * dy
      const projection = length
        ? ((visual.point.x - a.x) * dx + (visual.point.y - a.y) * dy) / length
        : 1
      const t = Math.max(0, Math.min(1, projection))
      const d = Math.hypot(a.x + t * dx - visual.point.x, a.y + t * dy - visual.point.y)
      if (d <= distance) {
        nearest = i
        distance = d
        beforeOrigin = i === 1 && projection < 0
      }
    }
    this.startedAt = now
    // A hidden receipt can advance the confirmed origin ahead of the paused
    // visual point. Joining its first segment would skip a tile and be trimmed
    // on scene hydration; use the legal correction path in that case.
    if (distance < 0.8 && !beforeOrigin) {
      this.origin = visual.point
      this.standing = visual.position
      const first = points[nearest]!
      const remaining = points.slice(nearest).map((step) => ({ ...step }))
      if (remaining.length)
        // Preserve the true remainder. A minimum interval stretches nearly
        // completed steps on every receipt and inserts idle motion at arrival.
        remaining[0]!.duration =
          Math.hypot(first.point.x - visual.point.x, first.point.y - visual.point.y) *
          first.duration
      this.route = remaining
    } else {
      this.extendApprovedVisual = false
      // Receipts can land after the bounded preview drains, or before the
      // final visual step finishes. Correct through supplied legal terrain;
      // do not teleport an ordinary arrival or invent a path across water.
      const target = route.at(-1) ?? { point: authoritative, position: view.position },
        source = knownPositionAtPoint(visual.point, view.sectors, visual.position)
      // Equally legal client/server paths may differ. Join toward the confirmed
      // destination, rather than replaying the obsolete origin behind the preview.
      const correction =
        source && view.sectors.every((sector) => sector.cells && sector.exits)
          ? localRoute(view, source, target.position)
          : null
      if (
        source &&
        correction &&
        (correction.length || positionKey(source) === positionKey(target.position))
      ) {
        this.origin = visual.point
        this.standing = source
        const correctionPoints = routePoints(correction, view.sectors, visual.point)
        if (
          !correctionPoints.length &&
          Math.hypot(target.point.x - visual.point.x, target.point.y - visual.point.y) > 0.001
        )
          correctionPoints.push({
            point: target.point,
            position: target.position,
            duration:
              view.sectors.find((sector) => sector.id === source.sectorId)?.stepMs ?? STEP_MS,
          })
        if (correctionPoints.length) {
          const first = correctionPoints[0]!
          first.duration *= Math.hypot(
            first.point.x - visual.point.x,
            first.point.y - visual.point.y,
          )
        }
        this.route = correctionPoints
      } else {
        // Unknown/disconnected relocations cannot be safely interpolated.
        this.origin = authoritative
        this.standing = view.position
        this.route = route
      }
    }
  }
  /** Hold presentation during encounter preparation without altering approved movement. */
  hold(now: number) {
    now = this.suspendedAt ?? now
    const current = this.sample(now)
    this.previewEndsAt = null
    this.origin = current.point
    this.standing = current.position
    this.route = []
    this.startedAt = now
    this.extendApprovedVisual = false
  }
  stop(now: number) {
    now = this.suspendedAt ?? now
    const sample = this.sample(now)
    this.previewEndsAt = null
    this.origin = sample.point
    this.standing = sample.position
    this.route = []
    this.startedAt = now
    this.extendApprovedVisual = false
  }
  /** Hidden time must not fast-forward presentation ahead of persisted movement. */
  suspend(now: number) {
    if (this.suspendedAt === null) this.suspendedAt = now
  }
  resume(now: number) {
    if (this.suspendedAt === null) return
    const hidden = Math.max(0, now - this.suspendedAt)
    this.startedAt += hidden
    if (this.previewEndsAt !== null) this.previewEndsAt += hidden
    this.suspendedAt = null
    this.lastSampledAt = now
  }
}
