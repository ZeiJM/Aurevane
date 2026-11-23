import { GRID_WIDTH } from '@/world/catalog'
import { ATLAS_COLUMNS, sectorMapOrigin } from '@/world/topology'
import type { WorldSectorView } from '@/world/types'
import { mapSceneDomain } from './map-scene-domain'
import type { MapPoint } from './world-motion'

export interface ShallowWaterRipple {
  worldx: number
  worldy: number
  /** Radius in world tiles; the renderer chooses the screen-space ellipse. */
  radius: number
  alpha: number
}
export interface ShallowWaterSample {
  point: MapPoint
  moving: boolean
  now: number
  /** Ambient motion enabled and reduced motion disabled. */
  enabled: boolean
  sectors: readonly WorldSectorView[]
  currentSectorId: string
}
interface Footstep {
  point: MapPoint
  at: number
}
const WORLD_WIDTH = ATLAS_COLUMNS * GRID_WIDTH
const LIFETIME_MS = 900
const MIN_INTERVAL_MS = 140
const MIN_DISTANCE = 0.35
const MAX_EVENTS = 16
const EMPTY: readonly ShallowWaterRipple[] = []

/** Bounded visual feedback over supplied geometry; never predicts movement or authority. */
export class ShallowWaterRipples {
  private sectors: readonly WorldSectorView[] | null = null
  private byId = new Map<string, WorldSectorView>()
  private wet = new Set<string>()
  private domain: string | null = null
  private previous: Footstep | null = null
  private emitted: Footstep | null = null
  private events: Footstep[] = []

  /** Retained render snapshots do not rebuild their terrain lookup each frame. */
  update(sectors: readonly WorldSectorView[]): void {
    if (sectors === this.sectors) return
    if (
      this.sectors?.length === sectors.length &&
      sectors.every((sector, index) => sector === this.sectors![index])
    ) {
      this.sectors = sectors
      return
    }
    this.sectors = sectors
    this.byId = new Map(sectors.map((sector) => [sector.id, sector]))
    this.wet = new Set()
    for (const sector of sectors) {
      const domain = mapSceneDomain(sector)
      const origin = sectorMapOrigin(sector)
      for (const cell of sector.cells) {
        if (cell.walkable && (cell.terrain === 'w' || cell.terrain === '~'))
          this.wet.add(this.cellKey(domain, origin.x + cell.x, origin.y + cell.y))
      }
    }
  }

  private cellKey(domain: string, x: number, y: number): string {
    const column = Math.floor(x)
    const canonicalX =
      domain === 'atlas' ? ((column % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH : column
    return `${domain}:${canonicalX}:${Math.floor(y)}`
  }

  private clear(): readonly ShallowWaterRipple[] {
    this.domain = null
    this.previous = null
    this.emitted = null
    this.events = []
    return EMPTY
  }

  sample(input: ShallowWaterSample): readonly ShallowWaterRipple[] {
    const { point, moving, now, enabled, currentSectorId } = input
    if (!enabled || !Number.isFinite(now) || !Number.isFinite(point.x) || !Number.isFinite(point.y))
      return this.clear()
    this.update(input.sectors)
    const current = this.byId.get(currentSectorId)
    if (!current) return this.clear()
    const domain = mapSceneDomain(current)
    const step = { point: { ...point }, at: now }
    const distance = this.previous
      ? Math.hypot(point.x - this.previous.point.x, point.y - this.previous.point.y)
      : 0
    const elapsed = this.previous ? now - this.previous.at : 0
    if (
      domain !== this.domain ||
      !this.previous ||
      elapsed < 0 ||
      elapsed > 600 ||
      distance > Math.min(1.25, Math.max(0.5, elapsed * 0.008))
    ) {
      // New mounts, realms, teleports and suspended clocks establish a baseline;
      // none interpolates footsteps across an unseen interval.
      this.clear()
      this.domain = domain
      this.previous = step
      this.emitted = step
      return EMPTY
    }
    this.previous = step
    this.events = this.events.filter(
      (event) =>
        now - event.at < LIFETIME_MS &&
        this.wet.has(this.cellKey(domain, event.point.x, event.point.y)),
    )
    if (
      moving &&
      distance > 1e-7 &&
      this.emitted &&
      now - this.emitted.at >= MIN_INTERVAL_MS &&
      Math.hypot(point.x - this.emitted.point.x, point.y - this.emitted.point.y) >=
        MIN_DISTANCE - 1e-7 &&
      this.wet.has(this.cellKey(domain, point.x, point.y))
    ) {
      this.events.push(step)
      this.events = this.events.slice(-MAX_EVENTS)
      this.emitted = step
    }
    return this.events.map((event) => {
      const age = (now - event.at) / LIFETIME_MS
      return {
        worldx: event.point.x,
        worldy: event.point.y,
        radius: 0.08 + age * 0.5,
        alpha: 0.32 * (1 - age) ** 2,
      }
    })
  }
}
