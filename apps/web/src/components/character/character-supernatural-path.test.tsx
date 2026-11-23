import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createInitialSupernaturalStoryState } from '@aurevane/game-core/character/supernatural-state'
import { CharacterSupernaturalPath } from './character-supernatural-path'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const state = createInitialSupernaturalStoryState({
  storyId: 'supernatural.main',
  storyVersion: 1,
  initialNodeId: 'awakening.threshold',
  now: '2026-09-25T00:00:00Z',
})
describe('Current supernatural path presentation', () => {
  it('does not invent eligibility or disclose choices when path data is unavailable', () => {
    const markup = renderToStaticMarkup(
      createElement(CharacterSupernaturalPath, { state: null, choices: [] }),
    )
    expect(markup).toContain('Path information is unavailable')
    expect(markup).not.toContain('Choose Ascension')
    expect(markup).not.toContain('Unawakened')
  })
  it('names an unawakened state without inventing requirements or exposing unavailable choices', () => {
    const markup = renderToStaticMarkup(
      createElement(CharacterSupernaturalPath, { state, choices: [] }),
    )
    expect(markup).toContain('Unawakened')
    expect(markup).toContain('No path choice is currently available')
    expect(markup).not.toContain('Choose Ascension')
  })
  it.each(['ascended', 'severed'] as const)(
    'explains the bound %s state and permanent consequence without a respec action',
    (path) => {
      const markup = renderToStaticMarkup(
        createElement(CharacterSupernaturalPath, { state: { ...state, path }, choices: [] }),
      )
      expect(markup).toContain(path === 'ascended' ? 'Ascended' : 'Severed')
      expect(markup).toContain('Rekindling')
      expect(markup).not.toContain('<button')
      expect(markup).not.toContain('supernatural.main')
    },
  )
})
