import { positionKey } from '@/world/travel'
import { wrappedMapX } from '@/world/topology'
import type { WorldPosition, WorldSectorView, WorldView } from '@/world/types'
import { mapPoint, prepareLocalRoute, type MapPoint } from './world-motion'

const MAX_STEPS = 12
const MAX_CATCHUP_MS = 1200
type Receipt = Pick<WorldView, 'players' | 'sectors'>
type Segment = { point: MapPoint; position: WorldPosition; duration: number }
type Track = {
  confirmed: WorldPosition
  origin: MapPoint
  standing: WorldPosition
  route: Segment[]
  startedAt: number
  endsAt: number
  charted: boolean
}

/** Presentation of confirmed snapshots only; never changes range or attackability. */
export class WorldPlayerMotion {
  private tracks = new Map<string, Track>()
  private sectors: readonly WorldSectorView[] | null = null
  private navigate: ReturnType<typeof prepareLocalRoute> | null = null
  private known = new Set<string>()
  private walkable = new Set<string>()

  constructor(view: Receipt, now: number, reference?: MapPoint) {
    this.update(view, now, reference)
  }
  private at(track: Track, now: number) {
    let elapsed = Math.max(0, now - track.startedAt),
      point = track.origin,
      position = track.standing
    for (let index = 0; index < track.route.length; index++) {
      const step = track.route[index]!
      if (elapsed < step.duration) {
        const amount = elapsed / step.duration
        return {
          point: {
            x: point.x + (step.point.x - point.x) * amount,
            y: point.y + (step.point.y - point.y) * amount,
          },
          position,
          index,
          elapsed,
        }
      }
      elapsed -= step.duration
      point = step.point
      position = step.position
    }
    return { point, position, index: track.route.length, elapsed: 0 }
  }
  sample(id: string, now: number, reference?: MapPoint): MapPoint | undefined {
    const track = this.tracks.get(id)
    if (!track) return undefined
    const point = this.at(track, now).point
    return track.charted && reference ? { x: wrappedMapX(point.x, reference.x), y: point.y } : point
  }
  moving(now: number) {
    for (const track of this.tracks.values()) if (now < track.endsAt) return true
    return false
  }
  update(view: Receipt, now: number, reference?: MapPoint) {
    if (this.sectors !== view.sectors) {
      this.sectors = view.sectors
      this.navigate = prepareLocalRoute(view)
      this.known = new Set(
        view.sectors.flatMap((sector) =>
          sector.cells.map((cell) => positionKey({ sectorId: sector.id, ...cell })),
        ),
      )
      this.walkable = new Set(
        view.sectors.flatMap((sector) =>
          sector.cells
            .filter((cell) => cell.walkable)
            .map((cell) => positionKey({ sectorId: sector.id, ...cell })),
        ),
      )
    }
    const present = new Set(view.players.map((player) => player.characterId))
    for (const id of this.tracks.keys()) if (!present.has(id)) this.tracks.delete(id)
    for (const player of view.players) {
      const destination = player.position
      if (!this.known.has(positionKey(destination))) {
        this.tracks.delete(player.characterId)
        continue
      }
      const previous = this.tracks.get(player.characterId)
      const visual = previous && this.at(previous, now)
      const point = mapPoint(destination, view.sectors, visual?.point ?? reference)
      const charted = Boolean(
        view.sectors.find((sector) => sector.id === destination.sectorId)?.charted,
      )
      const settle = () =>
        this.tracks.set(player.characterId, {
          confirmed: { ...destination },
          origin: point,
          standing: { ...destination },
          route: [],
          startedAt: now,
          endsAt: now,
          charted,
        })
      if (!previous || !visual) {
        settle()
        continue
      }
      const pending = previous.route.slice(visual.index).map((step) => ({ ...step }))
      if (pending.length) pending[0]!.duration -= visual.elapsed
      if (
        !this.walkable.has(positionKey(visual.position)) ||
        pending.some((step) => !this.walkable.has(positionKey(step.position)))
      ) {
        settle()
        continue
      }
      if (positionKey(previous.confirmed) === positionKey(destination)) continue
      const endpoint = previous.route.at(-1)?.point ?? previous.origin
      const target = mapPoint(destination, view.sectors, endpoint)
      if (Math.hypot(target.x - endpoint.x, target.y - endpoint.y) > MAX_STEPS) {
        settle()
        continue
      }
      const route = this.navigate!(previous.confirmed, destination)
      if (
        !route ||
        route.length + pending.length > MAX_STEPS ||
        route.some((step) => !this.walkable.has(positionKey(step.position)))
      ) {
        settle()
        continue
      }
      let from = endpoint
      for (const step of route) {
        const next = mapPoint(step.position, view.sectors, from)
        pending.push({ point: next, position: step.position, duration: step.durationMs })
        from = next
      }
      const duration = pending.reduce((total, step) => total + step.duration, 0)
      if (duration > MAX_CATCHUP_MS)
        for (const step of pending) step.duration *= MAX_CATCHUP_MS / duration
      this.tracks.set(player.characterId, {
        confirmed: { ...destination },
        origin: visual.point,
        standing: visual.position,
        route: pending,
        startedAt: now,
        endsAt: now + Math.min(duration, MAX_CATCHUP_MS),
        charted,
      })
    }
  }
  dispose() {
    this.tracks.clear()
    this.sectors = null
    this.navigate = null
    this.known.clear()
    this.walkable.clear()
  }
}
