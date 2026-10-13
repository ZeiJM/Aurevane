import { describe, expect, it } from 'vitest'
import type { WorldView } from './types'
import { mergeWorldRefresh, worldRefreshResponse, worldRefreshUrl } from './presence'
import { worldSyncDelayMs } from './travel'

const view = {
  characterId: 'owner',
  version: 7,
  serverNow: 1000,
  position: { sectorId: 'a', x: 2, y: 4 },
  route: [],
  players: [],
  sectors: [{ id: 'a', cells: [] }],
  atlas: [{ id: 'a' }],
  movementBlocked: null,
  battleSessionId: null,
  environment: { weather: 'clear' },
} as unknown as WorldView

describe('scoped World presence refresh', () => {
  it('refreshes live event objectives even when owned movement version is unchanged', () => {
    const previous = { ...view, objectives: [] }
    const next = {
      ...previous,
      objectives: [{ id: 'live-event', name: 'Explore the event' }],
    } as WorldView
    expect(
      mergeWorldRefresh(previous, worldRefreshResponse(next, worldRefreshUrl(previous))).objectives,
    ).toEqual(next.objectives)
  })
  it('observes the local scene promptly while preserving authored own-step deadlines', () => {
    const idle = {
      routeLength: 0,
      movementBlocked: false,
      nextStepAt: null,
      serverNow: 0,
      observePlayers: true,
      onlinePlayers: 1,
    }
    expect(worldSyncDelayMs(idle)).toBe(1000)
    expect(worldSyncDelayMs({ ...idle, onlinePlayers: 0 })).toBe(2000)
    expect(worldSyncDelayMs({ ...idle, observePlayers: false })).toBe(10000)
    expect(worldSyncDelayMs({ ...idle, routeLength: 2, nextStepAt: 4000 })).toBe(4000)
  })
  it('uses compact confirmed presence without reserializing unchanged terrain', () => {
    const next = { ...view, serverNow: 2000, players: [{ characterId: 'peer' }] } as WorldView
    const reply = worldRefreshResponse(next, worldRefreshUrl(view))
    expect(reply).toMatchObject({ kind: 'presence', version: 7, characterId: 'owner' })
    expect(reply).not.toHaveProperty('sectors')
    expect(reply).not.toHaveProperty('atlas')
    const merged = mergeWorldRefresh(view, reply)
    expect(merged.players).toBe(next.players)
    expect(merged.sectors).toBe(view.sectors)
    expect(merged.position).toBe(view.position)
    expect(merged.serverNow).toBe(2000)
  })
  it('falls back to a complete authority receipt when version or selected character changes', () => {
    const newer = { ...view, version: 8 }
    expect(worldRefreshResponse(newer, worldRefreshUrl(view))).toBe(newer)
    const other = { ...view, characterId: 'other' }
    expect(worldRefreshResponse(other, worldRefreshUrl(view))).toBe(other)
    expect(worldRefreshResponse(view, '/api/world')).toBe(view)
    expect(
      worldRefreshUrl({ ...view, route: [{ position: view.position, durationMs: 200 }] }),
    ).toBe('/api/world')
  })
  it('retains battle, training and environment changes without granting newer position authority', () => {
    const next = {
      ...view,
      movementBlocked: 'Return to your active battle.',
      battleSessionId: 'battle',
      environment: { ...view.environment, weather: 'rain' as const },
    }
    const reply = worldRefreshResponse(next, worldRefreshUrl(view))
    expect(mergeWorldRefresh(view, reply)).toMatchObject({
      battleSessionId: 'battle',
      movementBlocked: next.movementBlocked,
      environment: next.environment,
    })
    expect(() => mergeWorldRefresh({ ...view, version: 8 }, reply)).toThrow()
    expect(() => mergeWorldRefresh({ ...view, characterId: 'other' }, reply)).toThrow()
  })
})
