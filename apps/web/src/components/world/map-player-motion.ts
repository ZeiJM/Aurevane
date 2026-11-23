import { MOVEMENT_LAG_ALLOWANCE_MS, positionKey, samePosition } from '@/world/travel'
import { STEP_MS } from '@/world/catalog'
import { wrappedMapX } from '@/world/topology'
import type { TravelStep, WorldPosition, WorldSectorView, WorldView } from '@/world/types'
import { mapPoint, prepareLocalRoute, type MapPoint } from './world-motion'

const MAX_STEPS = 12
const MAX_CATCHUP_MS = 1200
const REAPPEAR_MS = 750
const MAX_RECENT_POSES = 100
type Receipt = Pick<WorldView, 'players' | 'sectors'>
type Segment = {
  point: MapPoint
  position: WorldPosition
  duration: number
  authoredDuration?: number
}
type Track = {
  confirmed: WorldPosition
  origin: MapPoint
  standing: WorldPosition
  route: Segment[]
  startedAt: number
  endsAt: number
  charted: boolean
  lastSampleAt?: number
  approved?: { version: number; expiresAt: number; lastPoint: MapPoint }
}

/** Presentation of confirmed snapshots only; never changes range or attackability. */
export class WorldPlayerMotion {
  private tracks = new Map<string, Track>()
  private versions = new Map<string, number>()
  // Authorization loss still removes all rendering immediately. This bounded
  // pose history can only join a fresh authorized, currently supplied receipt.
  private recent = new Map<string, { track: Track; frozenAt: number; until: number }>()
  private sectors: readonly WorldSectorView[] | null = null
  private navigate: ReturnType<typeof prepareLocalRoute> | null = null
  private known = new Set<string>()
  private walkable = new Set<string>()

  constructor(view: Receipt, now: number, reference?: MapPoint) {
    this.update(view, now, reference)
  }
  private at(track: Track, now: number) {
    if (track.approved && now > track.approved.expiresAt)
      return {
        point: track.approved.lastPoint,
        position: track.standing,
        index: track.route.length,
        elapsed: 0,
      }
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
    track.lastSampleAt = now
    if (track.approved) track.approved.lastPoint = point
    return track.charted && reference ? { x: wrappedMapX(point.x, reference.x), y: point.y } : point
  }
  moving(now: number) {
    for (const track of this.tracks.values())
      if (now < track.endsAt && (!track.approved || now <= track.approved.expiresAt)) return true
    return false
  }
  update(view: Receipt, now: number, reference?: MapPoint) {
    for (const [id, saved] of this.recent) if (now > saved.until) this.recent.delete(id)
    const terrainChanged = this.sectors !== view.sectors
    if (terrainChanged) {
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
      // Visibility/topology wins even when the accompanying player receipt is older.
      for (const [id, track] of this.tracks) {
        if (!track.approved) continue
        if (!this.known.has(positionKey(track.confirmed))) {
          this.tracks.delete(id)
          continue
        }
        let from = track.standing
        for (const step of track.route) {
          if (
            !this.legalApprovedStep(from, {
              position: step.position,
              durationMs: step.authoredDuration ?? step.duration,
            })
          ) {
            track.origin = mapPoint(track.confirmed, view.sectors, track.approved.lastPoint)
            track.standing = track.confirmed
            track.route = []
            track.startedAt = track.endsAt = now
            track.approved.lastPoint = track.origin
            track.lastSampleAt = undefined
            break
          }
          from = step.position
        }
      }
    }
    const present = new Set(view.players.map((player) => player.characterId))
    for (const [id, track] of this.tracks)
      if (!present.has(id)) {
        if (track.approved && track.lastSampleAt !== undefined && this.suppliedTrack(track)) {
          this.recent.delete(id)
          this.recent.set(id, {
            track,
            frozenAt: Math.max(track.startedAt, track.lastSampleAt),
            until: now + REAPPEAR_MS,
          })
          while (this.recent.size > MAX_RECENT_POSES)
            this.recent.delete(this.recent.keys().next().value!)
        }
        this.tracks.delete(id)
      }
    for (const id of this.versions.keys()) if (!present.has(id)) this.versions.delete(id)
    for (const player of view.players) {
      const saved = this.recent.get(player.characterId)
      const resume = saved && this.suppliedTrack(saved.track)
      const previous =
        this.tracks.get(player.characterId) ??
        (resume
          ? {
              ...saved.track,
              startedAt: saved.track.startedAt + now - saved.frozenAt,
              endsAt: saved.track.endsAt + now - saved.frozenAt,
            }
          : undefined)
      const movement = player.movement
      // An older receipt cannot reopen an approved route or replace its position.
      if (
        movement &&
        Number.isSafeInteger(movement.version) &&
        movement.version <
          (this.versions.get(player.characterId) ?? previous?.approved?.version ?? -1)
      )
        continue
      const destination = player.position
      if (!this.known.has(positionKey(destination))) {
        this.tracks.delete(player.characterId)
        this.recent.delete(player.characterId)
        continue
      }
      this.recent.delete(player.characterId)
      const visual = previous && this.at(previous, now)
      const point = mapPoint(destination, view.sectors, visual?.point ?? reference)
      const charted = Boolean(
        view.sectors.find((sector) => sector.id === destination.sectorId)?.charted,
      )
      const settle = (approved?: Track['approved']) =>
        this.tracks.set(player.characterId, {
          confirmed: { ...destination },
          origin: point,
          standing: { ...destination },
          route: [],
          startedAt: now,
          endsAt: now,
          charted,
          ...(approved ? { approved: { ...approved, lastPoint: point } } : {}),
        })
      if (movement !== undefined) {
        const valid =
          movement &&
          Number.isSafeInteger(movement.version) &&
          movement.version >= 0 &&
          Number.isSafeInteger(movement.serverNow) &&
          movement.serverNow >= 0 &&
          Array.isArray(movement.route) &&
          (movement.nextStepAt === null ||
            (Number.isSafeInteger(movement.nextStepAt) && movement.nextStepAt >= 0)) &&
          !(movement.route.length && movement.nextStepAt === null)
        if (!valid) {
          settle()
          continue
        }
        const previousVersion = this.versions.get(player.characterId) ?? previous?.approved?.version
        this.versions.set(player.characterId, movement.version)
        if (player.online === false) {
          settle({ version: movement.version, expiresAt: now, lastPoint: point })
          continue
        }
        if (movement.version === previousVersion) {
          if (!previous?.approved) settle()
          else if (resume) this.tracks.set(player.characterId, previous)
          continue
        }
        const approved = {
          version: movement.version,
          expiresAt:
            now +
            (movement.nextStepAt ?? movement.serverNow) -
            movement.serverNow +
            MOVEMENT_LAG_ALLOWANCE_MS,
          lastPoint: point,
        }
        const route: Segment[] = []
        let from = destination,
          origin = point
        for (const step of movement.route.slice(0, MAX_STEPS)) {
          if (!this.legalApprovedStep(from, step)) break
          const next = mapPoint(step.position, view.sectors, origin)
          route.push({
            point: next,
            position: { ...step.position },
            duration: step.durationMs,
            authoredDuration: step.durationMs,
          })
          from = step.position
          origin = next
        }
        if (
          (movement.route.length && !route.length) ||
          (route.length &&
            (movement.nextStepAt === null ||
              movement.nextStepAt > movement.serverNow + route[0]!.duration)) ||
          now > approved.expiresAt
        ) {
          settle(approved)
          continue
        }
        const prefix =
          previous && visual
            ? this.remainingPrefix(previous, now, visual, destination, route)
            : undefined
        if (prefix) {
          const joined = [...prefix, ...route].slice(0, MAX_STEPS)
          this.tracks.set(player.characterId, {
            confirmed: { ...destination },
            origin: visual!.point,
            standing: { ...visual!.position },
            route: joined,
            startedAt: now,
            endsAt: now + joined.reduce((sum, step) => sum + step.duration, 0),
            charted,
            lastSampleAt: previous!.lastSampleAt,
            approved: { ...approved, lastPoint: visual!.point },
          })
          continue
        }
        if (!route.length || movement.nextStepAt === null) {
          settle(approved)
          continue
        }
        const clockStart = now + movement.nextStepAt - movement.serverNow - route[0]!.duration
        const joined =
          previous && visual
            ? this.joinedElapsed(previous, now, visual.point, point, route)
            : undefined
        const standingJoin =
          previous?.approved &&
          visual &&
          visual.index === previous.route.length &&
          Math.hypot(visual.point.x - point.x, visual.point.y - point.y) < 1e-8
        const startedAt = standingJoin ? now : joined !== undefined ? now - joined : clockStart
        this.tracks.set(player.characterId, {
          confirmed: { ...destination },
          origin: point,
          standing: { ...destination },
          route,
          startedAt,
          endsAt: startedAt + route.reduce((sum, step) => sum + step.duration, 0),
          charted,
          lastSampleAt: previous?.lastSampleAt,
          approved,
        })
        continue
      }
      // A capability fallback must not retain an earlier approved route.
      if (previous?.approved) {
        settle()
        continue
      }
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
  private legalApprovedStep(from: WorldPosition, step: TravelStep) {
    if (
      !step ||
      !step.position ||
      typeof step.position.sectorId !== 'string' ||
      !Number.isSafeInteger(step.position.x) ||
      !Number.isSafeInteger(step.position.y) ||
      !Number.isSafeInteger(step.durationMs) ||
      step.durationMs < STEP_MS ||
      !this.walkable.has(positionKey(from)) ||
      !this.walkable.has(positionKey(step.position))
    )
      return false
    const source = this.sectors?.find((sector) => sector.id === from.sectorId)
    if (!source) return false
    return (
      (from.sectorId === step.position.sectorId &&
        Math.abs(from.x - step.position.x) + Math.abs(from.y - step.position.y) === 1 &&
        step.durationMs === (source.stepMs ?? STEP_MS)) ||
      source.exits.some(
        (exit) =>
          samePosition(exit.from, from) &&
          samePosition(exit.to, step.position) &&
          exit.durationMs === step.durationMs,
      )
    )
  }
  private suppliedTrack(track: Track) {
    if (!this.known.has(positionKey(track.confirmed))) return false
    let from = track.standing
    for (const step of track.route) {
      if (
        !this.legalApprovedStep(from, {
          position: step.position,
          durationMs: step.authoredDuration ?? step.duration,
        })
      )
        return false
      from = step.position
    }
    return this.walkable.has(positionKey(track.standing))
  }
  private remainingPrefix(
    previous: Track,
    now: number,
    visual: ReturnType<WorldPlayerMotion['at']>,
    destination: WorldPosition,
    route: Segment[],
  ) {
    if (!previous.approved || now > previous.approved.expiresAt || !this.suppliedTrack(previous))
      return undefined
    const index = previous.route.findIndex(
      (step, i) => i >= visual.index && samePosition(step.position, destination),
    )
    if (index < 0) return undefined
    const endpoint = previous.route[index]!.point
    if (!route.length) {
      // A completed approved journey can finish its remaining displayed legs;
      // an explicit stop before its endpoint still closes the old route.
      if (index !== previous.route.length - 1) return undefined
    } else {
      const next = previous.route[index + 1]
      if (next) {
        if (!samePosition(next.position, route[0]!.position)) return undefined
      } else {
        const before = index ? previous.route[index - 1]!.point : previous.origin
        const x = endpoint.x - before.x,
          y = endpoint.y - before.y,
          dx = route[0]!.point.x - endpoint.x,
          dy = route[0]!.point.y - endpoint.y
        if (x * dx + y * dy <= 0 || Math.abs(x * dy - y * dx) > 1e-8) return undefined
      }
    }
    const pending = previous.route.slice(visual.index, index + 1).map((step) => ({ ...step }))
    pending[0]!.duration -= visual.elapsed
    return pending[0]!.duration > 0 ? pending : undefined
  }
  private joinedElapsed(
    previous: Track,
    now: number,
    visual: MapPoint,
    origin: MapPoint,
    route: Segment[],
  ) {
    if (!previous.approved || now > previous.approved.expiresAt || !previous.route.length)
      return undefined
    const index = Math.min(this.at(previous, now).index, previous.route.length - 1)
    const before = index ? previous.route[index - 1]!.point : previous.origin
    const after = previous.route[index]!.point
    const oldX = after.x - before.x,
      oldY = after.y - before.y
    let from = origin,
      elapsed = 0
    for (const step of route) {
      const dx = step.point.x - from.x,
        dy = step.point.y - from.y
      const length = dx * dx + dy * dy
      const amount = length ? ((visual.x - from.x) * dx + (visual.y - from.y) * dy) / length : -1
      // Only an agreeing, supplied approved edge can preserve an earlier visual phase.
      if (
        dx * oldX + dy * oldY > 0 &&
        Math.abs(dx * oldY - dy * oldX) < 1e-8 &&
        amount >= 0 &&
        amount <= 1 &&
        Math.hypot(from.x + dx * amount - visual.x, from.y + dy * amount - visual.y) < 1e-8
      )
        return elapsed + amount * step.duration
      elapsed += step.duration
      from = step.point
    }
    return undefined
  }
  dispose() {
    this.tracks.clear()
    this.versions.clear()
    this.recent.clear()
    this.sectors = null
    this.navigate = null
    this.known.clear()
    this.walkable.clear()
  }
}
