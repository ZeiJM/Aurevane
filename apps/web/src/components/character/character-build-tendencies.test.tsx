import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CharacterBuildTendencies, coreStatTendencies } from './character-build-tendencies'

const attributes = { might: 8, finesse: 3, vitality: 5, agility: 3, intellect: 10, resolve: 8 }
describe('Core-stat build tendencies', () => {
  it('compares all six real attributes against the highest without changing stats', () => {
    expect(coreStatTendencies(attributes)).toEqual([0.8, 0.3, 0.5, 0.3, 1, 0.8])
    expect(attributes.intellect).toBe(10)
    expect(coreStatTendencies({ ...attributes, might: 20 })).toEqual([
      1, 0.15, 0.25, 0.15, 0.5, 0.4,
    ])
  })
  it('represents zero stats finitely and equal stats evenly', () => {
    expect(
      coreStatTendencies({
        might: 0,
        finesse: 0,
        vitality: 0,
        agility: 0,
        intellect: 0,
        resolve: 0,
      }),
    ).toEqual([0, 0, 0, 0, 0, 0])
    expect(
      coreStatTendencies({
        might: 5,
        finesse: 5,
        vitality: 5,
        agility: 5,
        intellect: 5,
        resolve: 5,
      }),
    ).toEqual([1, 1, 1, 1, 1, 1])
  })
  it('exposes actual values and scope to assistive technology', () => {
    const markup = renderToStaticMarkup(<CharacterBuildTendencies attributes={attributes} />)
    expect(markup).toContain('role="group"')
    expect(markup).toContain('Arcane: 10')
    expect(markup).toContain('not predicted damage or skill effectiveness')
  })
  it('makes each axis independently reachable without turning the whole chart into a button', () => {
    const markup = renderToStaticMarkup(<CharacterBuildTendencies attributes={attributes} />)
    const axisControls = [...markup.matchAll(/<g\b([^>]*)role="button"([^>]*)>/g)]
    expect(axisControls).toHaveLength(6)
    for (const label of ['Damage', 'Precision', 'Defense', 'Mobility', 'Arcane', 'Tenacity']) {
      expect(markup).toContain(`aria-label="About ${label} tendency"`)
    }
    for (const control of axisControls) expect(control[0]).toContain('tabindex="0"')
    expect(markup).not.toContain('About Build Tendencies')
  })
  it('server-renders complete SVG point titles for hydration and native tooltips', () => {
    const markup = renderToString(<CharacterBuildTendencies attributes={attributes} />)
    const pointTitles = [...markup.matchAll(/<circle\b[^>]*><title>(.*?)<\/title><\/circle>/g)]

    expect(pointTitles.map((match) => match[1])).toEqual([
      'Might · physical power: 8',
      'Finesse · accuracy and critical chance: 3',
      'Vitality · HP and armor: 5',
      'Agility · movement, initiative and evasion: 3',
      'Intellect · MP and mystic power: 10',
      'Resolve · ward and status resistance: 8',
    ])
    expect(markup).not.toContain('<title></title>')
  })
})
