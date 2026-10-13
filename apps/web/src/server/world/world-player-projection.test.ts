import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { newWorldState } from '@/world/travel'
import { FRONTIER_APPROACH, STEP_MS } from '@/world/catalog'
import type { TravelStep, WorldPlayer } from '@/world/types'
import { projectWorldPlayers } from './world-service'

const position = { sectorId: 'verdant-expanse', x: 5, y: 4 }
const person = (movement: unknown, at = position): WorldPlayer =>
  Object.assign(
    {
      characterId: 'peer',
      name: 'Peer',
      level: 1,
      portraitRef: '',
      imageUrl: null,
      position: at,
      attackable: true,
    },
    { movement },
  ) as WorldPlayer
const step = (x: number): TravelStep => ({ position: { ...position, x }, durationMs: STEP_MS })
const clock = (route: TravelStep[]) => ({ version: 3, serverNow: 1000, nextStepAt: 1200, route })

describe('public peer movement projection', () => {
  it('whitelists only twelve approved steps and clock fields, preserving base position and attackability', () => {
    const route = Array.from({ length: 15 }, (_, i) => ({
      ...step(i % 2 ? 5 : 6),
      road: 'private road metadata',
    }))
    const raw = {
      ...clock(route),
      routeDestination: { sectorId: 'private-tail', x: 2, y: 2 },
      discoveries: { secret: [1] },
    }
    const state = { ...newWorldState(), position: { ...position, x: 4 } }
    const projected = projectWorldPlayers(state, [person(raw)], [position.sectorId])[0]!
    expect(projected.movement).toEqual({
      ...clock(route.slice(0, 12).map(({ position, durationMs }) => ({ position, durationMs }))),
    })
    expect(projected.position).toEqual(position)
    expect(projected.attackable).toBe(false)
    expect(JSON.stringify(projected)).not.toContain('private')
    expect(raw.route).toHaveLength(15)
  })
  it('truncates at the first unknown private cell even when a later cell is known', () => {
    const at = { sectorId: 'survey-01', x: 5, y: 4 }
    const state = {
      ...newWorldState(),
      position: { ...at, x: 6 },
      discoveries: { 'survey-01': [2, 4, 5, 6].map((x) => 4 * 13 + x) },
    }
    const route = [4, 3, 2].map((x) => ({ position: { ...at, x }, durationMs: STEP_MS }))
    const projected = projectWorldPlayers(state, [person(clock(route), at)], ['survey-01'])[0]!
    expect(projected.movement?.route).toEqual(route.slice(0, 1))
    expect(projected.attackable).toBe(true)
    expect(projected.position).toEqual(at)
  })
  it('does not disclose an otherwise known crossing into an omitted scene sector', () => {
    const at = { sectorId: 'survey-01', x: 6, y: 8 }
    const state = { ...newWorldState(), position: at, discoveries: { 'survey-01': [8 * 13 + 6] } }
    const projected = projectWorldPlayers(
      state,
      [person(clock([{ position: FRONTIER_APPROACH, durationMs: 1100 }]), at)],
      ['survey-01'],
    )[0]!
    expect(projected.movement).toEqual({ version: 3, serverNow: 1000, nextStepAt: null, route: [] })
    expect(projected.attackable).toBe(true)
    expect(projected.position).toEqual(at)
  })
  it.each([
    { ...clock([step(6)]), version: -1 },
    { ...clock([step(6)]), version: 1.5 },
    { ...clock([step(6)]), serverNow: NaN },
    { ...clock([step(6)]), nextStepAt: '1200' },
    { ...clock([step(6)]), nextStepAt: null },
    { ...clock([step(6)]), nextStepAt: 9000 },
    { ...clock([step(6)]), route: {} },
  ])('drops malformed movement envelopes without changing eligibility: %j', (raw) => {
    const projected = projectWorldPlayers(newWorldState(), [person(raw)], [position.sectorId])[0]!
    expect(projected).not.toHaveProperty('movement')
    expect(projected.position).toEqual(position)
    expect(projected.attackable).toBe(false)
  })
  it.each([
    { position: { ...position, x: 8 }, durationMs: STEP_MS },
    { position: { ...position, x: 6 }, durationMs: STEP_MS - 1 },
    { position: { ...position, x: 6.5 }, durationMs: STEP_MS },
    { position: { ...position, x: 6 }, durationMs: Infinity },
    { position: { sectorId: 'missing', x: 6, y: 4 }, durationMs: STEP_MS },
    null,
  ])('withholds a broken first route step and its entire tail: %j', (first) => {
    const raw = clock([first as TravelStep, step(6)])
    const projected = projectWorldPlayers(newWorldState(), [person(raw)], [position.sectorId])[0]!
    expect(projected.movement).toEqual({ version: 3, serverNow: 1000, nextStepAt: null, route: [] })
  })
})
