import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createEventStarter, EventPhasePath } from './event-authoring-assists'
import { EventBuilderClient } from './event-builder-client'

describe('Event starter controls', () => {
  it('offers working starters on a fresh World Event and a fresh Story Campaign', () => {
    const props = { canPublish: false, canUseGlobalScope: false, canManageNpcs: false }
    const world = renderToStaticMarkup(<EventBuilderClient {...props} category="world-events" />)
    const story = renderToStaticMarkup(<EventBuilderClient {...props} category="story-campaigns" />)
    expect(world).toContain('Timed World Event')
    expect(world).toContain('World arrival')
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
})
