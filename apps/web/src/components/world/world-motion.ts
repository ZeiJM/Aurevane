import { GRID_HEIGHT, GRID_WIDTH, STEP_MS } from '@/world/catalog'
import {
  findWorldRoute,
  MAX_STEPS_PER_TICK,
  MOVEMENT_LAG_ALLOWANCE_MS,
  positionKey,
} from '@/world/travel'
import type { TravelStep, WorldPosition, WorldSectorView, WorldView } from '@/world/types'
import { sectorMapOrigin } from '@/world/topology'

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
  const sectors = view.sectors.map((sector) => ({
    ...sector,
    rows: Array.from({ length: GRID_HEIGHT }, (_, y) =>
      Array.from(
        { length: GRID_WIDTH },
        (_, x) => sector.cells.find((cell) => cell.x === x && cell.y === y)?.terrain ?? '#',
      ).join(''),
    ),
    roads: sector.exits,
  }))
  const known = new Set(
    view.sectors.flatMap((sector) =>
      sector.cells.map((cell) => positionKey({ sectorId: sector.id, ...cell })),
    ),
  )
  const navigate: LocalNavigator = (from, to) =>
    findWorldRoute(from, to, sectors, (position) => known.has(positionKey(position)))
  navigationCache.set(view.sectors, navigate)
  return navigate
}
export function localRoute(view: WorldView, from: WorldPosition, to: WorldPosition) {
  return prepareLocalRoute(view)(from, to)
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

/** A receipt clock can advance labels only through supplied legal, walkable edges. */
function approvedLoadedRoute(
  view: Pick<WorldView, 'position' | 'sectors'> & { route: readonly TravelStep[] },
) {
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

/** Visual interpolation has no authority over collision, encounter range or rewards. */
export class WorldMotion {
  private origin: MapPoint
  private route: { point: MapPoint; position: WorldPosition; duration: number }[] = []
  private startedAt = 0
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
  constructor(view: WorldView, now = 0) {
    this.origin = mapPoint(view.position, view.sectors)
    this.standing = view.position
    this.approvedOrigin = view.position
    this.startedAt = now
    this.lastSampledAt = now
    this.approve(view, now)
    if (this.approvedFirstAt !== null && this.approvedRoute.length) {
      // A freshly mounted scene has no earlier visual to preserve. Start at the
      // captured approved phase, including prefixes already due at the snapshot.
      this.route = routePoints(this.approvedRoute, view.sectors, this.origin)
      this.startedAt = this.approvedFirstAt - this.approvedRoute[0]!.durationMs
      this.extendApprovedVisual = true
    }
  }
  private approve(view: WorldView, now: number) {
    this.approvedOrigin = view.position
    this.approvedAt = now
    this.approvedRawRoute = view.route
    const frozen = Boolean(view.movementBlocked || view.battleSessionId)
    this.movementFrozen = frozen
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
        ? approvedLoadedRoute({
            position: this.approvedOrigin,
            route: this.approvedRawRoute,
            sectors,
          }).slice(0, MAX_STEPS_PER_TICK)
        : []
  }
  private trimVisualToScene(sectors: WorldView['sectors'], now: number) {
    const visual = this.sample(now)
    let elapsed = Math.max(0, now - this.startedAt),
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
          this.extendApprovedVisual = false
        } else this.route = this.route.slice(0, next)
        return
      }
      from = step.position
    }
  }
  /** Widen loaded approval and an agreeing visual prefix without restarting either clock. */
  updateScene(sectors: WorldView['sectors'], now = this.lastSampledAt): void {
    now = this.suspendedAt ?? now
    this.loadApprovedScene(sectors)
    this.trimVisualToScene(sectors, now)
    if (
      !this.extendApprovedVisual ||
      this.movementFrozen ||
      this.approvedFirstAt === null ||
      now > this.startedAt + this.route.reduce((sum, step) => sum + step.duration, 0)
    )
      return
    const positions = [this.approvedOrigin, ...this.approvedRawRoute.map((s) => s.position)]
    const from = positions.findIndex(
      (position) => positionKey(position) === positionKey(this.standing),
    )
    if (from < 0) return
    const loaded = approvedLoadedRoute({
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
    if (tail.length)
      this.route.push(...routePoints(tail, sectors, this.route.at(-1)?.point ?? this.origin))
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
  sample(now: number): { point: MapPoint; position: WorldPosition; moving: boolean } {
    now = this.suspendedAt ?? now
    this.lastSampledAt = now
    let elapsed = Math.max(0, now - this.startedAt),
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
          moving: true,
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
    let elapsed = Math.max(0, now - this.startedAt)
    for (const step of this.route) {
      if (elapsed + 1e-7 < step.duration) return step.position
      elapsed = Math.max(0, elapsed - step.duration)
    }
    return this.sample(now).position
  }
  plan(route: readonly TravelStep[], sectors: readonly WorldSectorView[], now: number) {
    if (this.movementFrozen) return
    now = this.suspendedAt ?? now
    const sample = this.sample(now)
    // Routing may finish after an in-flight step lands. Discard that completed
    // prefix before applying the preview budget; retaining it rewinds the visual
    // or spends the whole slow-terrain preview on a tile already reached.
    const reached = route.findIndex(
      (step) => positionKey(step.position) === positionKey(sample.position),
    )
    if (reached >= 0) route = route.slice(reached + 1)
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
      let unconfirmed = 0
      const end = this.route.findIndex(
        (step, index) => index >= common && (unconfirmed += step.duration) > 600,
      )
      if (end >= 0) this.route = this.route.slice(0, end)
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
    this.origin = current.point
    this.standing = current.position
    this.route = []
    this.startedAt = now
    this.extendApprovedVisual = false
  }
  stop(now: number) {
    now = this.suspendedAt ?? now
    const sample = this.sample(now)
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
    this.startedAt += Math.max(0, now - this.suspendedAt)
    this.suspendedAt = null
    this.lastSampledAt = now
  }
}
