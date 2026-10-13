import { GRID_HEIGHT, GRID_WIDTH, STEP_MS } from '@/world/catalog'
import { findWorldRoute, positionKey } from '@/world/travel'
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
  const ids = new Set(sectors.map((s) => s.id)),
    result: TravelStep[] = []
  let elapsed = 0
  for (const step of route) {
    elapsed += step.durationMs
    if (!ids.has(step.position.sectorId) || elapsed > budget) break
    result.push(step)
  }
  return result
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
  constructor(view: WorldView) {
    this.origin = mapPoint(view.position, view.sectors)
    this.standing = view.position
  }
  sample(now: number): { point: MapPoint; position: WorldPosition; moving: boolean } {
    let elapsed = Math.max(0, now - this.startedAt),
      point = this.origin,
      position = this.standing
    for (const step of this.route) {
      if (elapsed < step.duration) {
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
      elapsed -= step.duration
      point = step.point
      position = step.position
    }
    return { point, position, moving: false }
  }
  plan(route: readonly TravelStep[], sectors: readonly WorldSectorView[], now: number) {
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
    // Include one extra authored interval while selecting candidates. The first
    // interval is shortened below to its actual remainder before enforcing 600ms.
    this.route = routePoints(
      loadedRoute(route, sectors, 600 + (route[0]?.durationMs ?? 0)),
      sectors,
      sample.point,
    )
    const first = this.route[0]
    if (first) {
      const standing = mapPoint(sample.position, sectors, sample.point),
        distance = Math.hypot(first.point.x - sample.point.x, first.point.y - sample.point.y),
        wholeStep = Math.hypot(first.point.x - standing.x, first.point.y - standing.y)
      // Repeated clicks/held input must keep the same walking speed. A half-
      // finished step needs half its authored time, rather than a new full step.
      first.duration = (first.duration * distance) / (wholeStep || 1)
      let elapsed = 0
      this.route = this.route.filter((step) => (elapsed += step.duration) <= 600)
    }
  }
  reconcile(view: WorldView, now: number) {
    const visual = this.sample(now),
      authoritative = mapPoint(view.position, view.sectors, visual.point)
    const route = routePoints(loadedRoute(view.route, view.sectors), view.sectors, authoritative)
    // Find the visual point on the confirmed forward path. Late confirmations must not
    // rewind an already interpolated step, including at sector boundaries.
    const points = [{ point: authoritative, position: view.position, duration: 0 }, ...route]
    let nearest = 0,
      distance = Infinity
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!.point,
        b = points[i]!.point,
        dx = b.x - a.x,
        dy = b.y - a.y
      const length = dx * dx + dy * dy
      const t = length
        ? Math.max(
            0,
            Math.min(1, ((visual.point.x - a.x) * dx + (visual.point.y - a.y) * dy) / length),
          )
        : 1
      const d = Math.hypot(a.x + t * dx - visual.point.x, a.y + t * dy - visual.point.y)
      if (d <= distance) {
        nearest = i
        distance = d
      }
    }
    this.startedAt = now
    if (distance < 0.8) {
      this.origin = visual.point
      this.standing = visual.position
      const first = points[nearest]!
      const remaining = points.slice(nearest).map((step) => ({ ...step }))
      if (remaining.length)
        remaining[0]!.duration = Math.max(
          30,
          Math.hypot(first.point.x - visual.point.x, first.point.y - visual.point.y) *
            first.duration,
        )
      this.route = remaining
    } else {
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
  stop(now: number) {
    const sample = this.sample(now)
    this.origin = sample.point
    this.standing = sample.position
    this.route = []
    this.startedAt = now
  }
}
