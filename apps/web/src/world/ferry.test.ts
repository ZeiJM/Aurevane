import { describe, expect, it, vi } from 'vitest'
import { parseWorldCommand } from './command'
import { FERRY_MAINLAND_DOCK, nextFerryDeparture, projectWorldFerries } from './ferry'
import { findWorldRoute, newWorldState } from './travel'
import { isKnownCell, resolveSector, visibleSectors } from '@/server/world/world-content'
import { projectWorld } from '@/server/world/world-service'

vi.mock('server-only', () => ({}))

const departureAt = 1_800_000_000_000
const arrivalAt = departureAt + 300_000

describe('public ferry timetable', () => {
  it('sails hourly each way, including when there are no passengers', () => {
    expect(nextFerryDeparture('mainland', departureAt - 1)).toBe(departureAt)
    expect(nextFerryDeparture('mainland', departureAt)).toBe(departureAt + 3_600_000)
    expect(nextFerryDeparture('uncharted', departureAt)).toBe(departureAt + 1_800_000)
    expect(projectWorldFerries(departureAt - 1)).toEqual([])
    expect(projectWorldFerries(departureAt)).toEqual([
      { direction: 'outbound', departureAt, arrivalAt },
    ])
    expect(projectWorldFerries(arrivalAt)).toEqual([])
    expect(projectWorldFerries(departureAt + 1_800_001)).toMatchObject([{ direction: 'return' }])
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
        ?.cells.find(({ x, y }) => x === 6 && y === 4)?.walkable,
    ).toBe(true)
    expect(projectWorld(newWorldState(), [], departureAt).ferry).toBeUndefined()
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
        position: { sectorId: `ferry:outbound:${departureAt + 3_600_000}`, x: 7, y: 4 },
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
      intent: { kind: 'board-ferry', fare: 1000, destination: 'somewhere else' },
    }
    expect(parseWorldCommand(body)?.intent).toEqual({ kind: 'board-ferry' })
  })
})
