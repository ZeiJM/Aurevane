import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { FRONTIER_APPROACH } from '@/world/catalog'
import { newWorldState } from '@/world/travel'
import { projectWorld, resolveWorldIntent } from './world-service'

describe('frontier Anchor discovery', () => {
  it('keeps authored Anchor metadata hidden before legitimate discovery', () => {
    const state = newWorldState()
    const view = projectWorld(state, [], 1000)

    expect(state.discoveredAnchors).toEqual([])
    expect(view.anchors).toEqual([])
    expect(JSON.stringify(view)).not.toContain('Weathered Observatory')
  })

  it('records the authored Anchor only when the character reaches its exact cell', () => {
    const near = resolveWorldIntent(
      {
        ...newWorldState(),
        position: { sectorId: 'survey-01', x: 10, y: 1 },
        discoveries: { 'survey-01': [] },
      },
      { kind: 'tick' },
      1000,
    )
    expect(near.discoveredAnchors).toEqual([])

    const discovered = resolveWorldIntent(
      {
        ...near,
        position: { sectorId: 'survey-01', x: 11, y: 1 },
      },
      { kind: 'tick' },
      2000,
    )

    expect(discovered.discoveredAnchors).toEqual(['first-observation'])
    expect(discovered.completedObjectives).toContain('first-observation')
    expect(projectWorld(discovered, [], 2000).anchors).toEqual([
      {
        id: 'first-observation',
        name: 'Weathered Observatory',
        sectorId: 'survey-01',
      },
    ])
  })

  it('keeps discovered Anchor history after leaving the frontier scene', () => {
    const discovered = resolveWorldIntent(
      {
        ...newWorldState(),
        position: { sectorId: 'survey-01', x: 11, y: 1 },
        discoveries: { 'survey-01': [] },
      },
      { kind: 'tick' },
      1000,
    )
    const returned = {
      ...discovered,
      position: FRONTIER_APPROACH,
      route: [],
      nextStepAt: null,
    }

    expect(projectWorld(returned, [], 2000).anchors).toEqual([
      {
        id: 'first-observation',
        name: 'Weathered Observatory',
        sectorId: 'survey-01',
      },
    ])
  })

  it('never projects forged or unknown Anchor identifiers from persisted state', () => {
    const state = {
      ...newWorldState(),
      discoveredAnchors: ['forged.anchor', 'first-observation'],
    }

    expect(projectWorld(state, [], 1000).anchors).toEqual([
      {
        id: 'first-observation',
        name: 'Weathered Observatory',
        sectorId: 'survey-01',
      },
    ])
  })
})
