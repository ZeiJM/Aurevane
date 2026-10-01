import { renderToStaticMarkup } from 'react-dom/server'
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
    expect(markup).toContain('role="img"')
    expect(markup).toContain('Arcane: 10')
    expect(markup).toContain('not predicted damage or skill effectiveness')
  })
})
