import type { WorldPosition } from './types'

export const FERRY_HOUR_MS = 60 * 60 * 1000
export const FERRY_DURATION_MS = 5 * 60 * 1000
export const FERRY_BOARDING_MS = FERRY_DURATION_MS
export const FERRY_RETURN_OFFSET_MS = 30 * 60 * 1000
export const FERRY_MAINLAND_DOCK = { sectorId: 'atlas:126:33', x: 6, y: 8 } as const
export const FERRY_TERMINAL_NAME = 'Ferry Terminal'
export const FERRY_TERMINAL_LANDMARK = 'mainland-ferry-terminal'
export const FERRYMAN_PORTRAIT = '/media/art/world/runtime/ferryman-portrait-v01.webp'
export const FERRYMAN_SPRITE = '/media/art/world/runtime/ferryman-sprite-v01.webp'

export type FerryPort = 'mainland' | 'uncharted'
export type FerryDirection = 'outbound' | 'return'

export interface FerryPassage {
  direction: FerryDirection
  departureAt: number
  arrivalAt: number
}

export interface WorldFerryView {
  port: FerryPort | null
  nextDepartureAt: number | null
  fareCrowns: 0
  passage?: FerryPassage
}

export function nextFerryDeparture(port: FerryPort, now: number): number {
  const offset = port === 'mainland' ? 0 : FERRY_RETURN_OFFSET_MS
  const next = Math.floor((now - offset) / FERRY_HOUR_MS) * FERRY_HOUR_MS + offset
  return next + FERRY_HOUR_MS
}

/** Public schedule for the single hull. Globe routes use a masked cartographic endpoint. */
export function projectWorldFerries(now: number): readonly FerryPassage[] {
  const next = [
    { direction: 'outbound', departureAt: nextFerryDeparture('mainland', now) },
    { direction: 'return', departureAt: nextFerryDeparture('uncharted', now) },
  ] as const
  return next.flatMap(({ direction, departureAt: upcoming }) => {
    const departureAt = upcoming - FERRY_HOUR_MS
    const arrivalAt = departureAt + FERRY_DURATION_MS
    return now < arrivalAt ? [{ direction, departureAt, arrivalAt }] : []
  })
}

export function ferryAtMainland(now: number) {
  return (
    now >=
    nextFerryDeparture('mainland', now) - FERRY_HOUR_MS + FERRY_RETURN_OFFSET_MS + FERRY_DURATION_MS
  )
}

export function nearFerryDock(position: WorldPosition, dock: WorldPosition): boolean {
  return (
    position.sectorId === dock.sectorId &&
    Math.abs(position.x - dock.x) + Math.abs(position.y - dock.y) <= 1
  )
}
