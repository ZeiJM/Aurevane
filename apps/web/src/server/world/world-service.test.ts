import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { newWorldState, revealNearby } from '@/world/travel'
import { FRONTIER_APPROACH } from '@/world/catalog'
import { projectWorld, resolveWorldIntent } from './world-service'

describe('world authority and spoiler projection', () => {
  it('does not send unknown frontier names, cells or exits', () => {
    const view = projectWorld(newWorldState(), [], 1000)
    expect(view.sectors).toHaveLength(8)
    expect(JSON.stringify(view)).not.toContain('survey-01')
    expect(JSON.stringify(view)).not.toContain('Weathered Observatory')
  })
  it('requires a deliberate crossing from the frontier approach', () => {
    expect(() => resolveWorldIntent(newWorldState(), { kind: 'cross' }, 1000)).toThrow()
    const state = resolveWorldIntent(
      { ...newWorldState(), position: FRONTIER_APPROACH },
      { kind: 'cross' },
      1000,
    )
    expect(state.position.sectorId).toBe('survey-01')
    const view = projectWorld(state, [], 1000)
    const survey = view.sectors.find((s) => s.id === 'survey-01')!
    expect(survey.cells.length).toBeLessThan(117)
    expect(survey.landmarks).not.toContainEqual(
      expect.objectContaining({ name: 'Weathered Observatory' }),
    )
  })
  it('refuses auto-path across unsurveyed territory', () => {
    const state = revealNearby({
      ...newWorldState(),
      position: { sectorId: 'survey-01', x: 6, y: 8 },
    })
    expect(() =>
      resolveWorldIntent(
        state,
        { kind: 'walk', destination: { sectorId: 'survey-01', x: 11, y: 1 } },
        1000,
      ),
    ).toThrow()
  })
  it('filters players in remote sectors and unrevealed cells', () => {
    const state = revealNearby({
      ...newWorldState(),
      position: { sectorId: 'survey-01', x: 6, y: 8 },
    })
    const players = [
      {
        characterId: 'a',
        name: 'Hidden',
        level: 1,
        portraitRef: '',
        imageUrl: null,
        position: { sectorId: 'survey-01', x: 11, y: 1 },
        attackable: true,
      },
      {
        characterId: 'b',
        name: 'Remote',
        level: 1,
        portraitRef: '',
        imageUrl: null,
        position: { sectorId: 'aureth-crown', x: 6, y: 4 },
        attackable: true,
      },
    ]
    expect(projectWorld(state, players, 1000).players).toEqual([])
  })
  it('persists discovery and completes a reached quest once', () => {
    const state = { ...newWorldState(), position: { sectorId: 'verdant-expanse', x: 12, y: 4 } }
    const next = resolveWorldIntent(state, { kind: 'tick' }, 1000)
    expect(next.completedObjectives).toEqual(['eastern-watch'])
    expect(resolveWorldIntent(next, { kind: 'tick' }, 2000).completedObjectives).toEqual([
      'eastern-watch',
    ])
  })
})

it('stops an event route when its live objective is withdrawn, leaving quest policy intact', () => {
  const state = {
    ...newWorldState(),
    routeObjectiveId: 'event-disabled',
    route: [{ position: { sectorId: 'verdant-expanse', x: 6, y: 4 }, durationMs: 1100 }],
    nextStepAt: 0,
  }
  const next = resolveWorldIntent(state, { kind: 'tick' }, 2000, [])
  expect(next.position).toEqual(state.position)
  expect(next.route).toEqual([])
})
