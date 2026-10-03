import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { SkillDetails } from './skill-details'
import { MINIMUM_SKILL_INFORMATION_FIELDS } from './skill-information-contract'

it('shows the minimum report in order once, preserving Range and PvP overrides', () => {
  const base = resolveMatureSkillVersion('farstrider.volley')!
  const skill = {
    ...base,
    effectDescriptions: ['Authored explanation of the real effect.'],
    overrides: { ...base.overrides, pvp: { apCost: base.apCost + 1 } },
  }
  const markup = renderToStaticMarkup(<SkillDetails skill={skill} expanded />)
  let previous = -1
  for (const label of MINIMUM_SKILL_INFORMATION_FIELDS) {
    const needle = `<dt>${label}</dt>`
    expect(markup.split(needle)).toHaveLength(2)
    const index = markup.indexOf(needle)
    expect(index).toBeGreaterThan(previous)
    previous = index
  }
  expect(markup).not.toContain('Legal range')
  expect(markup).toContain('<dt>Range</dt><dd>5</dd>')
  expect(markup).toContain('<dt>Target Method</dt><dd>Circle · Radius: 1 tile</dd>')
  expect(markup).not.toContain('<p>Circle radius:')
  expect(markup).not.toContain('Affects:')
  expect(markup).toContain(`<dt>PvP Cost</dt><dd>${base.apCost + 1} AP`)
  expect(markup).not.toContain('<dt>AP cost</dt>')
  expect(markup).toContain('Authored explanation of the real effect.')
})
