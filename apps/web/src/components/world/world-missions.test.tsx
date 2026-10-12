import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { VERDANT_SETTLEMENT } from '@/server/world/world-objectives'
import type { WorldView } from '@/world/types'
import { WorldMissions } from './world-missions'

const render = (view: WorldView) =>
  renderToStaticMarkup(
    createElement(WorldMissions, {
      view,
      disabled: false,
      send: vi.fn(),
      stopMoving: vi.fn(),
    }),
  )
describe('mission status and authoritative turn-in', () => {
  it('offers Active and Completed filters and omits already recorded quests from Active', () => {
    const state = { ...newWorldState(), completedObjectives: ['eastern-watch'] }
    const markup = render(projectWorld(state, [], 1000))
    expect(markup).toContain('Mission status')
    expect(markup).toContain('Active')
    expect(markup).toContain('Completed')
    expect(markup).not.toContain('The Eastern Watch')
    expect(markup).not.toContain('Tracked Quests')
    expect(markup).toContain('Hinterland Patrol')
  })
  it('offers Complete quest only for a ready objective at its authoritative issuer', () => {
    const state = {
      ...newWorldState(),
      position: VERDANT_SETTLEMENT,
      objectiveProgress: { 'eastern-watch': 'ready' as const },
    }
    const ready = projectWorld(state, [], 1000)
    expect(render(ready)).toContain('Complete quest')
    expect(render({ ...ready, interactions: [] })).not.toContain('Complete quest')
    expect(render(projectWorld(newWorldState(), [], 1000))).not.toContain('Complete quest')
    expect(
      render(projectWorld({ ...state, completedObjectives: ['eastern-watch'] }, [], 1000)),
    ).not.toContain('Complete quest')
  })
})
