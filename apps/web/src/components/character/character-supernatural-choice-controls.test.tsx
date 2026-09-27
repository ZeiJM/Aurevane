import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { CharacterSupernaturalChoiceControls } from './character-supernatural-choice-controls'

describe('Character supernatural choice controls', () => {
  it('presents both authored permanent path choices without committing on first render', () => {
    const markup = renderToStaticMarkup(
      createElement(CharacterSupernaturalChoiceControls, {
        stateVersion: 4,
        choices: [
          {
            transitionId: 'supernatural.main.choose-ascension',
            transitionContentVersion: 1,
            path: 'ascended',
            identity: {
              id: 'ascension.proof',
              contentVersion: 1,
              kind: 'ascension',
              title: 'Ascension Proof',
              summary: 'Ascension identity facts.',
            },
          },
          {
            transitionId: 'supernatural.main.choose-severence',
            transitionContentVersion: 1,
            path: 'severed',
            identity: {
              id: 'severence.proof',
              contentVersion: 1,
              kind: 'severence',
              title: 'Severence Proof',
              summary: 'Severence identity facts.',
            },
          },
        ],
      }),
    )

    expect(markup).toContain('This decision is permanent')
    expect(markup).toContain('Ascension Proof')
    expect(markup).toContain('Ascension identity facts.')
    expect(markup).toContain('Severence Proof')
    expect(markup).toContain('Severence identity facts.')
    expect(markup).toContain('Choose Ascension')
    expect(markup).toContain('Choose Severence')
    expect(markup).toContain('data-supernatural-choice="ascended"')
    expect(markup).toContain('data-supernatural-choice="severed"')
    expect(markup).not.toContain('Confirm Ascension')
    expect(markup).not.toContain('Confirm Severence')
  })
})
