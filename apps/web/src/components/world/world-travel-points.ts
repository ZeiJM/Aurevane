import type { WorldPosition, WorldView } from '@/world/types'
import { ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { FERRY_MAINLAND_DOCK, FERRY_TERMINAL_NAME } from '@/world/ferry'
import { globeSectorCenter } from '@/world/globe-math'

export interface WorldTravelPoint {
  id: string
  name: string
  coordinate: string
}

export function worldTravelDestination(sectorId: string): WorldPosition {
  return sectorId === FERRY_MAINLAND_DOCK.sectorId ? FERRY_MAINLAND_DOCK : { sectorId, x: 6, y: 4 }
}

/** Map selection targets only; this list grants no ferry route or fast-travel permission. */
export function worldTravelPoints(view: Pick<WorldView, 'atlas' | 'anchors'>): WorldTravelPoint[] {
  const known = new Map(
    (view.atlas ?? []).filter((sector) => sector.charted).map((sector) => [sector.id, sector]),
  )
  const seen = new Set<string>()
  const candidates = [
    { id: FERRY_MAINLAND_DOCK.sectorId, name: FERRY_TERMINAL_NAME },
    ...view.anchors.map((anchor) => ({ id: anchor.sectorId, name: anchor.name })),
    ...(view.atlas ?? [])
      .filter((sector) => sector.charted && sector.townId === sector.id)
      .map((sector) => ({ id: sector.id, name: sector.name })),
  ]
  return candidates.flatMap((point) => {
    const sector = known.get(point.id)
    if (
      !sector ||
      seen.has(point.id) ||
      !globeSectorCenter(sector.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
    )
      return []
    seen.add(point.id)
    return [{ ...point, coordinate: sector.coordinate }]
  })
}

export function nextWorldTravelPoint(
  points: readonly WorldTravelPoint[],
  selected: string | null,
): WorldTravelPoint | null {
  if (!points.length) return null
  const current = points.findIndex((point) => point.id === selected)
  return points[(current + 1) % points.length]!
}
