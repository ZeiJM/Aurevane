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
      openConversation: vi.fn(),
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
  it('routes local quest actions through the conversation before any reply can be sent', () => {
    const state = {
      ...newWorldState(),
      position: VERDANT_SETTLEMENT,
      objectiveProgress: { 'eastern-watch': 'ready' as const },
    }
    const ready = projectWorld(state, [], 1000)
    expect(render(ready)).toContain('Talk to Watch officer')
    expect(render(ready)).not.toContain('Complete quest')
    expect(render({ ...ready, interactions: [] })).not.toContain('Talk to Watch officer')
    expect(render({ ...ready, interactions: [] })).not.toContain('Complete quest')
    expect(render(projectWorld(newWorldState(), [], 1000))).not.toContain('Complete quest')
    expect(
      render(projectWorld({ ...state, completedObjectives: ['eastern-watch'] }, [], 1000)),
    ).not.toContain('Complete quest')
  })
})

it('uses local restoration collection instead of auto-pathing to the current giver', () => {
  const view = projectWorld(newWorldState(), [], 1000)
  const id = 'quest-run-44444444-4444-4444-8444-444444444444'
  const quest = {
    id,
    name: 'Reserved sword',
    description: 'Collect your reserved sword.',
    kind: 'quest',
    autoPath: true,
    guidance: 'exact',
    destination: view.position,
    completed: false,
    progress: 'ready',
  } as const
  const markup = render({
    ...view,
    objectives: [quest],
    interactions: [
      {
        id,
        objectiveId: id,
        title: quest.name,
        speaker: 'Restoration Smith',
        body: 'The sword is ready.',
        progress: 'ready',
        actionId: 'claim-restoration',
        actionLabel: 'Collect Sanalex Sword',
      },
    ],
  })
  expect(markup).toContain('Talk to Restoration Smith')
  expect(markup).not.toContain('Start Auto-path')
  expect(render({ ...view, objectives: [quest], interactions: [] })).toContain('Start Auto-path')
})
