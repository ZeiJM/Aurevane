import 'server-only'
import {
  FERRY_MAINLAND_DOCK,
  FERRY_NORTH_DOCK,
  FERRY_ASTERWAKE_DOCK,
  nearFerryDock,
  ferryBoardingOpens,
  nextFerryDeparture,
  type WorldFerryView,
} from '@/world/ferry'
import { STEP_MS } from '@/world/catalog'
import type { WorldSector, WorldState } from '@/world/types'
import { parseVoidSectorId } from '@/world/void-realms'
import { voidRealmFerryDock } from './void-realms'
import { WARPED_CONTINENT_LANDING } from './warped-continent'

const shipRows = [
  '~~~~~~~~~~~~~',
  '~~~~~~s~~~~~~',
  '~~~sssssss~~~',
  '~~s##ssssss~~',
  '~sssssssssss~',
  '~~sssssssss~~',
  '~~~sssss#s~~~',
  '~~~~~~s~~~~~~',
  '~~~~~~~~~~~~~',
] as const

export function ferryDeckSector(id: string): WorldSector | null {
  if (!/^ferry:((?:asterwake-)?(?:outbound|return)):[1-9]\d{9,15}$/.test(id)) return null
  return {
    id,
    name: 'Ferry Deck',
    coordinate: 'At sea',
    regionId: 'hollow-coast',
    art: null,
    east: 0,
    north: 0,
    rows: shipRows,
    roads: [],
    stepMs: STEP_MS,
    charted: false,
    landmarks: [
      { id: 'ferry-stern', name: 'Stern cabin', kind: 'waystone', x: 3, y: 3 },
      { id: 'ferry-mast', name: 'Foremast', kind: 'waystone', x: 8, y: 6 },
    ],
  }
}

export function worldFerryDock(sectorId: string) {
  if (sectorId === FERRY_MAINLAND_DOCK.sectorId)
    return { ...FERRY_MAINLAND_DOCK, shoreSide: 'south' } as const
  if (sectorId === FERRY_NORTH_DOCK.sectorId)
    return { ...FERRY_NORTH_DOCK, shoreSide: 'north' } as const
  if (sectorId === FERRY_ASTERWAKE_DOCK.sectorId)
    return { ...FERRY_ASTERWAKE_DOCK, shoreSide: 'south' } as const
  if (sectorId === WARPED_CONTINENT_LANDING.sectorId)
    return { ...WARPED_CONTINENT_LANDING, shoreSide: 'south' } as const
  const realm = parseVoidSectorId(sectorId)
  if (!realm) return null
  const dock = voidRealmFerryDock(realm.realmId)
  return dock.sectorId === sectorId ? dock : null
}

export function projectWorldFerry(state: WorldState, now: number): WorldFerryView | undefined {
  if (state.ferry) {
    const { direction, departureAt, arrivalAt } = state.ferry
    return {
      port: null,
      nextDepartureAt: null,
      fareCrowns: 0,
      passage: { direction, departureAt, arrivalAt },
    }
  }
  const dock = state.route.length ? null : worldFerryDock(state.position.sectorId)
  const port =
    !dock || !nearFerryDock(state.position, dock)
      ? null
      : dock.sectorId === FERRY_MAINLAND_DOCK.sectorId
        ? 'mainland'
        : dock.sectorId === FERRY_NORTH_DOCK.sectorId
          ? 'north-shore'
          : dock.sectorId === FERRY_ASTERWAKE_DOCK.sectorId
            ? 'asterwake'
            : 'uncharted'
  const nextDepartureAt = port ? nextFerryDeparture(port, now) : null
  const ticket = state.ferryTicket
  if (ticket && now < ticket.departureAt) {
    return {
      port,
      nextDepartureAt,
      fareCrowns: 0,
      ticket: {
        direction: ticket.direction,
        departureAt: ticket.departureAt,
        canBoard:
          dock?.sectorId === ticket.sectorId &&
          nextDepartureAt === ticket.departureAt &&
          now >= ferryBoardingOpens(ticket.departureAt),
      },
    }
  }
  if (port) return { port, nextDepartureAt, fareCrowns: 0 }
}
