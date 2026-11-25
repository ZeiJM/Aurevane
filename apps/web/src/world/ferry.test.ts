import { describe, expect, it, vi } from 'vitest'
import { parseWorldCommand } from './command'
import {
  FERRY_BOARDING_MS,
  FERRY_CIRCUIT_MS,
  FERRY_DURATION_MS,
  FERRY_MAINLAND_DOCK,
  FERRY_RETURN_OFFSET_MS,
  FERRY_TERMINAL_LANDMARK,
  FERRY_TERMINAL_NAMES,
  ferryAtPort,
  nextFerryDeparture,
  projectWorldFerries,
} from './ferry'
import { findWorldRoute, isSafe, isWalkable, newWorldState, revealNearby } from './travel'
import { isKnownCell, resolveSector, visibleSectors } from '@/server/world/world-content'
import { projectWorld } from '@/server/world/world-service'
import { voidRealmFerryDock, voidRealmLanding } from '@/server/world/void-realms'
import { projectWorldFerry } from '@/server/world/world-ferry'
import { VOID_REALMS } from './void-realms'

vi.mock('server-only', () => ({}))

const departureAt = 1_800_002_460_000
const arrivalAt = departureAt + FERRY_DURATION_MS
const returnAt = departureAt + FERRY_RETURN_OFFSET_MS
const mainlandSailings = (now: number) =>
  projectWorldFerries(now).filter(({ direction }) => !direction.startsWith('asterwake-'))

describe('public ferry timetable', () => {
  it('sails for 25 minutes and docks for 10 minutes even without passengers', () => {
    expect(nextFerryDeparture('mainland', departureAt - 1)).toBe(departureAt)
    expect(nextFerryDeparture('mainland', departureAt)).toBe(departureAt + FERRY_CIRCUIT_MS)
    expect(nextFerryDeparture('uncharted', departureAt)).toBe(returnAt)
    expect(mainlandSailings(departureAt - 1)).toEqual([])
    expect(mainlandSailings(departureAt)).toEqual([
      { direction: 'outbound', departureAt, arrivalAt },
    ])
    expect(mainlandSailings(arrivalAt)).toEqual([])
    expect(mainlandSailings(returnAt + 1)).toMatchObject([{ direction: 'return' }])
    expect(ferryAtPort('mainland', departureAt - 1)).toBe(true)
    expect(ferryAtPort('mainland', departureAt)).toBe(false)
    expect(ferryAtPort('mainland', returnAt + FERRY_DURATION_MS - 1)).toBe(false)
    expect(ferryAtPort('mainland', returnAt + FERRY_DURATION_MS)).toBe(true)
    expect(ferryAtPort('uncharted', arrivalAt - 1)).toBe(false)
    expect(ferryAtPort('uncharted', arrivalAt)).toBe(true)
    expect(ferryAtPort('uncharted', returnAt)).toBe(false)
  })

  it('shares the passenger deck for the same passage without opening a mainland route', () => {
    const id = `ferry:outbound:${departureAt}`
    const deck = { sectorId: id, x: 6, y: 4 }
    const state = {
      ...newWorldState(),
      position: deck,
      ferry: { direction: 'outbound' as const, departureAt, arrivalAt, warpedPhase: 1 },
    }
    const dock = { ...newWorldState(), position: FERRY_MAINLAND_DOCK }
    const sector = resolveSector(id)!
    expect(sector.charted).toBe(false)
    expect(sector.roads).toEqual([])
    expect(isKnownCell(dock, deck)).toBe(false)
    expect(findWorldRoute(dock.position, deck, visibleSectors(dock))).toBeNull()
    expect(findWorldRoute(deck, { ...deck, x: 8 }, visibleSectors(state))).toHaveLength(2)
    const view = projectWorld(state, [], departureAt)
    expect(view.sectors.map(({ id }) => id)).toEqual([id])
    expect(view.atlas?.some((entry) => entry.id === id)).toBe(false)
    expect(view.ferry).toEqual({
      port: null,
      nextDepartureAt: null,
      fareCrowns: 0,
      passage: { direction: 'outbound', departureAt, arrivalAt },
    })
    const dockView = projectWorld(dock, [], departureAt - 1)
    expect(dockView.ferry).toEqual({
      port: 'mainland',
      nextDepartureAt: departureAt,
      fareCrowns: 0,
    })
    expect(
      dockView.sectors
        .find(({ id }) => id === FERRY_MAINLAND_DOCK.sectorId)
        ?.cells.find(({ x, y }) => x === FERRY_MAINLAND_DOCK.x && y === FERRY_MAINLAND_DOCK.y)
        ?.walkable,
    ).toBe(true)
    expect(projectWorld(newWorldState(), [], departureAt).ferry).toBeUndefined()
  })

  it('keeps a reserved sailing visible away from the terminal until its exact departure', () => {
    const ferryTicket = {
      direction: 'outbound' as const,
      departureAt,
      sectorId: FERRY_MAINLAND_DOCK.sectorId,
    }
    const dock = { ...newWorldState(), position: FERRY_MAINLAND_DOCK, ferryTicket }
    const away = { ...dock, position: { ...FERRY_MAINLAND_DOCK, y: FERRY_MAINLAND_DOCK.y - 2 } }
    expect(projectWorldFerry(dock, departureAt - FERRY_BOARDING_MS - 1)?.ticket?.canBoard).toBe(
      false,
    )
    expect(projectWorldFerry(dock, departureAt - FERRY_BOARDING_MS)?.ticket).toEqual({
      direction: 'outbound',
      departureAt,
      canBoard: true,
    })
    expect(projectWorldFerry(away, departureAt - 1)).toMatchObject({
      port: null,
      ticket: { direction: 'outbound', departureAt, canBoard: false },
    })
    expect(projectWorldFerry(away, departureAt)).toBeUndefined()
    expect(projectWorldFerry(dock, departureAt)?.ticket).toBeUndefined()
  })

  it('connects the named terminal on the south shore to the mainland road', () => {
    const terminal = resolveSector(FERRY_MAINLAND_DOCK.sectorId)!
    const previous = { sectorId: 'atlas:126:32', x: 6, y: 4 }
    expect(terminal.name).toBe(FERRY_TERMINAL_NAMES.mainland)
    expect(terminal.landmarks).toContainEqual(
      expect.objectContaining({ id: FERRY_TERMINAL_LANDMARK }),
    )
    expect(isWalkable(terminal, FERRY_MAINLAND_DOCK)).toBe(true)
    expect(resolveSector('atlas:126:34')).toBeNull()
    expect(
      findWorldRoute(
        previous,
        FERRY_MAINLAND_DOCK,
        visibleSectors({ ...newWorldState(), position: previous }),
      ),
    ).not.toBeNull()
  })

  it('shows peers on the same sailing without revealing riders on another trip or at the dock', () => {
    const sectorId = `ferry:outbound:${departureAt}`
    const state = {
      ...newWorldState(),
      position: { sectorId, x: 6, y: 4 },
      ferry: { direction: 'outbound' as const, departureAt, arrivalAt, warpedPhase: 1 },
    }
    const passengers = [
      { name: 'Deckmate', position: { sectorId, x: 7, y: 4 } },
      {
        name: 'Later passenger',
        position: { sectorId: `ferry:outbound:${departureAt + FERRY_CIRCUIT_MS}`, x: 7, y: 4 },
      },
      { name: 'Dock observer', position: FERRY_MAINLAND_DOCK },
    ].map((player, index) => ({
      ...player,
      characterId: String(index),
      level: 1,
      portraitRef: '',
      imageUrl: null,
      online: true,
      attackable: true,
    }))
    expect(projectWorld(state, passengers, departureAt).players).toMatchObject([
      { name: 'Deckmate', online: true, attackable: false },
    ])
    expect(
      projectWorld(
        { ...newWorldState(), position: FERRY_MAINLAND_DOCK },
        passengers,
        departureAt,
      ).players.map(({ name }) => name),
    ).toEqual(['Dock observer'])
  })

  it('accepts only passenger intent and ignores supplied fare and destination', () => {
    const uuid = '36eaa2a7-28ed-420f-8acd-a516f84f0837'
    const body = {
      characterId: uuid,
      commandId: uuid,
      expectedVersion: 1,
      intent: { kind: 'board-ferry', departureAt, fare: 1000, destination: 'somewhere else' },
    }
    expect(parseWorldCommand(body)?.intent).toEqual({ kind: 'board-ferry', departureAt })
    expect(parseWorldCommand({ ...body, intent: { kind: 'board-ferry' } })).toBeNull()
    expect(
      parseWorldCommand({ ...body, intent: { kind: 'buy-ferry-boarding', departureAt: -1 } }),
    ).toBeNull()
  })

  it.each(VOID_REALMS)('offers the private return ferry on the $name coast', ({ id }) => {
    const { shoreSide, ...position } = voidRealmFerryDock(id)
    const state = revealNearby({ ...newWorldState(), position })
    expect(isSafe(resolveSector(position.sectorId)!, position)).toBe(true)
    const view = projectWorld(state, [], arrivalAt)
    expect(view.ferry).toEqual({
      port: 'uncharted',
      fareCrowns: 0,
      nextDepartureAt: returnAt,
    })
    expect(view.atlas?.some((cell) => cell.id === position.sectorId)).toBe(false)
    const terminal = view.sectors.find(({ id }) => id === position.sectorId)
    expect(terminal?.ferryDock).toEqual({ x: position.x, y: position.y, shoreSide })
    expect(terminal?.landmarks).toContainEqual(
      expect.objectContaining({ name: FERRY_TERMINAL_NAMES.uncharted }),
    )
    expect(
      projectWorldFerry({ ...state, position: voidRealmLanding(id) }, arrivalAt),
    ).toBeUndefined()
    expect(
      projectWorldFerry({ ...state, position: { ...position, y: position.y + 2 } }, arrivalAt),
    ).toBeUndefined()
  })
})
