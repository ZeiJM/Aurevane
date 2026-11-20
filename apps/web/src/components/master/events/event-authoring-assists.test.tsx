import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { validatePersistentEventDefinition } from '@aurevane/game-core/events/persistent-event'
import { resolveSector } from '@/server/world/world-content'
import { isWalkable } from '@/world/travel'
import { createEventStarter, EventPhasePath } from './event-authoring-assists'
import { EventBuilderClient } from './event-builder-client'

vi.mock('server-only', () => ({}))

describe('Event starter controls', () => {
  it('offers working starters on a fresh World Event and a fresh Story Campaign', () => {
    const props = { canPublish: false, canUseGlobalScope: false, canManageNpcs: false }
    const world = renderToStaticMarkup(<EventBuilderClient {...props} category="world-events" />)
    const story = renderToStaticMarkup(<EventBuilderClient {...props} category="story-campaigns" />)
    expect(world).toContain('Timed World Event')
    expect(world).toContain('World arrival')
    expect(world).toContain('Lanternward Watch')
    expect(world).not.toContain('Travel and report</option>')
    expect(story).toContain('Travel and report</option>')
    expect(story).not.toContain('Timed World Event')
    const hidden = renderToStaticMarkup(
      <EventBuilderClient {...props} category="hidden-discoveries" />,
    )
    expect(hidden).not.toContain('Starter template')
  })
})

describe('Event phase path', () => {
  it('uses the current phase order, arrival target, weather, and terminal clock', () => {
    const [arrival, closing] = createEventStarter('world-arrival', 'event.phase-path').phases
    const rendered = renderToStaticMarkup(
      <EventPhasePath
        phases={[
          {
            ...arrival!,
            objectives: [{ ...arrival!.objectives[0]!, target: 3, requiredWeather: 'rain' }],
          },
          { ...closing!, name: 'Pack away', transition: { type: 'elapsed', afterSeconds: 120 } },
        ]}
      />,
    )
    expect(rendered).toContain('After 3 confirmed arrivals in rain, open Pack away.')
    expect(rendered).toContain('After 120 seconds in this phase, move the run to resolution.')
  })

  it('calls out a removed threshold objective without implying that it can open the next phase', () => {
    const [arrival, closing] = createEventStarter('world-arrival', 'event.phase-path').phases
    const rendered = renderToStaticMarkup(
      <EventPhasePath phases={[{ ...arrival!, objectives: [] }, closing!]} />,
    )
    expect(rendered).toContain('Set a valid transition with a supported condition.')
    expect(rendered).not.toContain('open Wrap-up')
    expect(rendered).toContain('Staff resolve the run from this phase.')
  })

  it('shows a timed fallback using the same draft as validation', () => {
    const timed = createEventStarter('timed-patrol', 'event.timed-patrol')
    expect(() => validatePersistentEventDefinition(timed)).not.toThrow()
    const path = renderToStaticMarkup(<EventPhasePath phases={timed.phases} />)
    expect(path).toContain('After all 2 selected objectives are complete, open Crossing secure.')
    expect(path).toContain('If the requirement is unmet after 600 seconds, open Send relief.')
    for (const { worldNavigation } of timed.phases[0]!.objectives) {
      const sector = resolveSector(worldNavigation!.sectorId)
      expect(sector && isWalkable(sector, worldNavigation!)).toBe(true)
    }
    const [first, ...rest] = timed.phases
    if (first?.transition.type !== 'objective-quorum') throw new Error('Timed patrol has no quorum')
    for (const deadline of [
      { afterSeconds: 0, nextPhaseId: 'send-relief' },
      { afterSeconds: 600, nextPhaseId: 'check-crossing' },
      { afterSeconds: 600, nextPhaseId: 'crossing-secure' },
      { afterSeconds: 600, nextPhaseId: 'missing' },
    ]) {
      const invalid = {
        ...timed,
        phases: [{ ...first, transition: { ...first.transition, deadline } }, ...rest],
      }
      expect(() => validatePersistentEventDefinition(invalid)).toThrow(/deadline/)
      expect(renderToStaticMarkup(<EventPhasePath phases={invalid.phases} />)).toContain(
        'Set a valid arrival deadline',
      )
    }
  })
})

it('authors two Lanternward Watch routes with walkable checkpoints and a shared resolution', () => {
  const definition = createEventStarter('lanternward-watch', 'event.lanternward-watch')
  expect(() => validatePersistentEventDefinition(definition)).not.toThrow()
  expect(definition.phases[0]?.transition).toEqual({
    type: 'objective-branch',
    routes: [
      { objectiveId: 'farwater-signal', nextPhaseId: 'relight-tower' },
      { objectiveId: 'harbor-signal', nextPhaseId: 'reach-terminal' },
    ],
  })
  expect(definition.phases[1]?.nextPhaseId).toBe('close-watch')
  expect(definition.phases[3]?.id).toBe('close-watch')
  for (const objective of definition.phases.flatMap((phase) => phase.objectives)) {
    const target = objective.worldNavigation!
    const sector = resolveSector(target.sectorId)
    expect(sector, objective.id).not.toBeNull()
    expect(isWalkable(sector!, target), objective.id).toBe(true)
  }
})
