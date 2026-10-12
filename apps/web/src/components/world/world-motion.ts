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
export function localRoute(view: WorldView, from: WorldPosition, to: WorldPosition) {
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
  return findWorldRoute(from, to, sectors, (position) => known.has(positionKey(position)))
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
    this.origin = sample.point
    this.standing = sample.position
    this.startedAt = now
    this.route = routePoints(loadedRoute(route, sectors, 600), sectors, sample.point)
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
      const correction = view.sectors.every((sector) => sector.cells && sector.exits)
        ? localRoute(view, visual.position, view.position)
        : null
      if (
        correction &&
        (correction.length || positionKey(visual.position) === positionKey(view.position))
      ) {
        this.origin = visual.point
        this.standing = visual.position
        const correctionPoints = routePoints(correction, view.sectors, visual.point)
        if (
          !correctionPoints.length &&
          Math.hypot(authoritative.x - visual.point.x, authoritative.y - visual.point.y) > 0.001
        )
          correctionPoints.push({
            point: authoritative,
            position: view.position,
            duration: STEP_MS,
          })
        if (correctionPoints.length) {
          const first = correctionPoints[0]!
          first.duration *= Math.hypot(
            first.point.x - visual.point.x,
            first.point.y - visual.point.y,
          )
        }
        this.route = [...correctionPoints, ...route]
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
