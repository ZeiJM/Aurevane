import type { WorldPosition } from './types'

export const FERRY_HOUR_MS = 60 * 60 * 1000
export const FERRY_DURATION_MS = 5 * 60 * 1000
export const FERRY_CONVERSATION_ID = 'world-ferryman'
export const FERRYMAN_DECK_POSITION = { x: 4, y: 4 } as const
export const FERRY_RETURN_OFFSET_MS = 30 * 60 * 1000
export const FERRY_MAINLAND_DOCK = { sectorId: 'atlas:126:33', x: 6, y: 8 } as const
export const FERRY_NORTH_DOCK = { sectorId: 'atlas:126:30', x: 6, y: 0 } as const
export const FERRY_ASTERWAKE_DOCK = { sectorId: 'atlas:4:15', x: 6, y: 8 } as const
export const PUBLIC_FERRY_TERMINALS = [
  { dock: FERRY_MAINLAND_DOCK, name: 'Mainland Ferry Terminal' },
  { dock: FERRY_NORTH_DOCK, name: 'North Shore Ferry Terminal' },
  { dock: FERRY_ASTERWAKE_DOCK, name: 'Asterwake Ferry Terminal' },
] as const
export const FERRY_TERMINAL_NAME = 'Ferry Terminal'
export const FERRY_TERMINAL_LANDMARK = 'mainland-ferry-terminal'
export const FERRYMAN_PORTRAIT = '/media/art/world/runtime/ferryman-portrait-v02.webp'
export const FERRYMAN_SPRITE = '/media/art/world/runtime/ferryman-sprite-v01.webp'

export type FerryPort = 'mainland' | 'uncharted' | 'north-shore' | 'asterwake'
export type FerryShoreSide = 'south' | 'west' | 'north'
export type FerryDirection = 'outbound' | 'return' | 'asterwake-outbound' | 'asterwake-return'

export interface FerryPassage {
  direction: FerryDirection
  departureAt: number
  arrivalAt: number
}

export interface FerryTicket {
  direction: FerryDirection
  departureAt: number
  sectorId: string
}

export type FerryIntent =
  | { kind: 'buy-ferry-boarding'; departureAt: number }
  | { kind: 'board-ferry'; departureAt: number }
  | { kind: 'leave-ferry' }

export interface WorldFerryView {
  port: FerryPort | null
  nextDepartureAt: number | null
  fareCrowns: 0
  passage?: FerryPassage
  ticket?: Omit<FerryTicket, 'sectorId'> & { canBoard: boolean }
}

export function nextFerryDeparture(port: FerryPort, now: number): number {
  const offset = {
    mainland: 0,
    uncharted: FERRY_RETURN_OFFSET_MS,
    'north-shore': 15 * 60_000,
    asterwake: 45 * 60_000,
  }[port]
  const next = Math.floor((now - offset) / FERRY_HOUR_MS) * FERRY_HOUR_MS + offset
  return next + FERRY_HOUR_MS
}

/** Public schedule for the single hull. Globe routes use a masked cartographic endpoint. */
export function projectWorldFerries(now: number): readonly FerryPassage[] {
  const next = [
    { direction: 'outbound', departureAt: nextFerryDeparture('mainland', now) },
    { direction: 'return', departureAt: nextFerryDeparture('uncharted', now) },
    { direction: 'asterwake-outbound', departureAt: nextFerryDeparture('north-shore', now) },
    { direction: 'asterwake-return', departureAt: nextFerryDeparture('asterwake', now) },
  ] as const
  return next.flatMap(({ direction, departureAt: upcoming }) => {
    const departureAt = upcoming - FERRY_HOUR_MS
    const arrivalAt = departureAt + FERRY_DURATION_MS
    return now < arrivalAt ? [{ direction, departureAt, arrivalAt }] : []
  })
}

export function ferryAtPort(port: FerryPort, now: number) {
  const northern = port === 'north-shore' || port === 'asterwake'
  const departurePort = northern ? 'north-shore' : 'mainland'
  const cycleStart = nextFerryDeparture(departurePort, now) - FERRY_HOUR_MS
  const elapsed = now - cycleStart
  return port === departurePort
    ? elapsed >= FERRY_RETURN_OFFSET_MS + FERRY_DURATION_MS
    : elapsed >= FERRY_DURATION_MS && elapsed < FERRY_RETURN_OFFSET_MS
}

export function isFerryTerminalLandmark(id: string) {
  return id === FERRY_TERMINAL_LANDMARK || id.endsWith(':ferry-terminal')
}

export function nearFerryDock(position: WorldPosition, dock: WorldPosition): boolean {
  return (
    position.sectorId === dock.sectorId &&
    Math.abs(position.x - dock.x) + Math.abs(position.y - dock.y) <= 1
  )
}
