import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BattleFlavorTemplateHelp } from './battle-flavor-template-help'

describe('compact writing tag help', () => {
  it('places the usable identity tags and neutral behavior in an i dialog without expandable samples', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleFlavorTemplateHelp, {
        value: '(name) draws (possessive) blade before (target).',
        ability: 'Quiet Edge',
        onChange: () => {},
      }),
    )
    expect(markup).toContain('aria-label="About Writing tags"')
    expect(markup).toContain('<dialog')
    for (const tag of [
      '(name)',
      '(target)',
      '(skill)',
      '(subject)',
      '(object)',
      '(possessive)',
      '(reflexive)',
      '(gender:he|she|they)',
      '(target.gender:he|she|they)',
    ])
      expect(markup).toContain(tag)
    expect(markup).toContain('Asha draws their blade before Bryn.')
    expect(markup).toContain('missing identity uses neutral wording')
    expect(markup).not.toContain('<details')
    expect(markup).not.toContain('References and writing preview')
    expect(markup).not.toContain('narration sample pronouns')
    expect(markup).not.toContain('narration sample gender')
  })

  it('offers context-aware insertion with simple tags and preserves numerical boundaries', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleFlavorTemplateHelp, {
        value: '(value.0.power) power',
        ability: 'Arc',
        onChange: () => {},
        context: { field: 'activation', values: { '0.power': 12 }, affectedTargets: true },
      }),
    )
    expect(markup).toContain('value="(name)"')
    expect(markup).toContain('value="(targets)"')
    expect(markup).toContain('value="(value.0.power)"')
    expect(markup).toContain('12 power')
    expect(markup).not.toContain('Actual damage')
    expect(markup).toContain('ordinary parentheses stay as text')
  })

  it('keeps invalid-token diagnostics visible and does not preview forbidden references', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleFlavorTemplateHelp, {
        value: 'Strike (actor.private).',
        ability: 'Quiet Edge',
        onChange: () => {},
      }),
    )
    expect(markup).toContain('Unknown narration token: {actor.private}.')
    expect(markup).toContain('aria-label="Battle narration validation"')
    expect(markup).toContain('aria-label="Battle narration sample">Asha calls on Quiet Edge.')
  })
})
