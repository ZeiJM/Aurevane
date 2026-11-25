import type { WorldPosition } from './types'

export const FERRY_CIRCUIT_MS = 70 * 60_000
export const FERRY_BOARDING_MS = 10 * 60_000
export const FERRY_DURATION_MS = 25 * 60_000
export const FERRY_CONVERSATION_ID = 'world-ferryman'
export const FERRYMAN_DECK_POSITION = { x: 4, y: 4 } as const
export const FERRY_RETURN_OFFSET_MS = FERRY_DURATION_MS + FERRY_BOARDING_MS
export const FERRY_MAINLAND_DOCK = { sectorId: 'atlas:126:33', x: 6, y: 8 } as const
export const FERRY_NORTH_DOCK = { sectorId: 'atlas:126:30', x: 6, y: 0 } as const
export const FERRY_ASTERWAKE_DOCK = { sectorId: 'atlas:4:15', x: 6, y: 8 } as const
export const FERRY_TERMINAL_NAMES = {
  mainland: 'Lantern Quay Ferry Terminal',
  'north-shore': 'Greywake Ferry Terminal',
  asterwake: 'Gildtide Ferry Terminal',
  uncharted: 'Veilwatch Ferry Terminal',
} as const
export const FERRY_TERMINAL_NAME = FERRY_TERMINAL_NAMES.mainland
export const PUBLIC_FERRY_TERMINALS = [
  { dock: FERRY_MAINLAND_DOCK, name: FERRY_TERMINAL_NAMES.mainland },
  { dock: FERRY_NORTH_DOCK, name: FERRY_TERMINAL_NAMES['north-shore'] },
  { dock: FERRY_ASTERWAKE_DOCK, name: FERRY_TERMINAL_NAMES.asterwake },
] as const
export const FERRY_TERMINAL_LANDMARK = 'mainland-ferry-terminal'
export const FERRYMAN_PORTRAIT = '/media/art/world/runtime/ferryman-portrait-v02.webp'
export const FERRYMAN_SPRITE = '/media/art/world/runtime/ferryman-sprite-v01.webp'

export type FerryPort = 'mainland' | 'uncharted' | 'north-shore' | 'asterwake'
export type FerryShoreSide = 'south' | 'west' | 'north'
export type FerryDirection = 'outbound' | 'return' | 'asterwake-outbound' | 'asterwake-return'

export const FERRY_DIRECTIONS: Readonly<Record<FerryPort, FerryDirection>> = {
  mainland: 'outbound',
  uncharted: 'return',
  'north-shore': 'asterwake-outbound',
  asterwake: 'asterwake-return',
}

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
  // The one-minute offset keeps new sailings distinct from legacy trip IDs.
  const offset =
    60_000 +
    {
      mainland: 0,
      uncharted: FERRY_RETURN_OFFSET_MS,
      'north-shore': 15 * 60_000,
      asterwake: 15 * 60_000 + FERRY_RETURN_OFFSET_MS,
    }[port]
  const next = Math.floor((now - offset) / FERRY_CIRCUIT_MS) * FERRY_CIRCUIT_MS + offset
  return next + FERRY_CIRCUIT_MS
}

export function ferryBoardingOpens(departureAt: number) {
  return departureAt - FERRY_BOARDING_MS
}

/** Public timetable for both ferry services. Globe routes use a masked cartographic endpoint. */
export function projectWorldFerries(now: number): readonly FerryPassage[] {
  return (Object.keys(FERRY_DIRECTIONS) as FerryPort[]).flatMap((port) => {
    const departureAt = nextFerryDeparture(port, now) - FERRY_CIRCUIT_MS
    const direction = FERRY_DIRECTIONS[port]
    const arrivalAt = departureAt + FERRY_DURATION_MS
    return now < arrivalAt ? [{ direction, departureAt, arrivalAt }] : []
  })
}

export function ferryAtPort(port: FerryPort, now: number) {
  const northern = port === 'north-shore' || port === 'asterwake'
  const departurePort = northern ? 'north-shore' : 'mainland'
  const cycleStart = nextFerryDeparture(departurePort, now) - FERRY_CIRCUIT_MS
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
