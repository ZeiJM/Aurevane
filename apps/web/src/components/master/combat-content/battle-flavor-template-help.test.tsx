import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BattleFlavorTemplateHelp } from './battle-flavor-template-help'

describe('Master battle narration preview', () => {
  it('previews allowed names and neutral pronouns and exposes explicit sample gender controls', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleFlavorTemplateHelp, {
        value: '{actor} draws {actor.possessive} blade before {target}.',
        ability: 'Quiet Edge',
        onChange: () => {},
      }),
    )
    expect(markup).toContain('Asha draws their blade before Bryn.')
    expect(markup).toContain('Combatant draws their blade before Combatant.')
    expect(markup).toContain('aria-label="Actor narration sample pronouns"')
    expect(markup).toContain('aria-label="Target narration sample gender"')
    expect(markup).toContain('{actor.gender:he|she|they}')
    expect(markup).not.toContain('aria-label="Battle narration validation"')
  })

  it('shows invalid-token diagnostics and a generic preview without rendering forbidden content', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleFlavorTemplateHelp, {
        value: 'Strike {private_build}.',
        ability: 'Quiet Edge',
        onChange: () => {},
      }),
    )
    expect(markup).toContain('Unknown narration token: {private_build}.')
    expect(markup).toContain('aria-label="Battle narration sample">Asha calls on Quiet Edge.')
    expect(markup).toContain(
      'aria-label="Neutral historical narration preview">Combatant calls on Quiet Edge.',
    )
  })
})
