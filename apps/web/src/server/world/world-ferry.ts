import 'server-only'
import {
  FERRY_MAINLAND_DOCK,
  nearFerryDock,
  nextFerryDeparture,
  type WorldFerryView,
} from '@/world/ferry'
import { STEP_MS } from '@/world/catalog'
import type { WorldSector, WorldState } from '@/world/types'

const arrival = { sectorId: 'uncharted-landing', x: 6, y: 4 } as const
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
  if (!/^ferry:(outbound|return):[1-9]\d{9,15}$/.test(id)) return null
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
  if (state.route.length) return
  const port = nearFerryDock(state.position, FERRY_MAINLAND_DOCK)
    ? 'mainland'
    : nearFerryDock(state.position, arrival)
      ? 'uncharted'
      : null
  if (!port) return
  return { port, nextDepartureAt: nextFerryDeparture(port, now), fareCrowns: 0 }
}
