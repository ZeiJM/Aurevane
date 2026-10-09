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
  expect(markup).toContain('<dt>Range</dt><dd>1</dd>')
  expect(markup).toContain(
    '<dt>Target Method</dt><dd title="Circle [1] covers 8 surrounding tiles from you, excluding your tile. Inner rings are included. Separately authored self effects still apply.">Circle [1]</dd>',
  )
  expect(markup).not.toContain('<p>Circle radius:')
  expect(markup).not.toContain('Affects:')
  expect(markup).toContain(`<dt>PvP Cost</dt><dd>${base.apCost + 1} AP`)
  expect(markup).not.toContain('<dt>AP cost</dt>')
  expect(markup).toContain('Authored explanation of the real effect.')
})

it('provides the caster-origin explanation within the Target Method row', () => {
  const current = resolveMatureSkillVersion('farstrider.volley')!
  const markup = renderToStaticMarkup(<SkillDetails skill={current} expanded />)
  expect(markup).toContain(
    'title="Circle [1] covers 8 surrounding tiles from you, excluding your tile.',
  )
})

it('keeps Ground delivery rules outside the authored effect list', () => {
  const skill = resolveMatureSkillVersion('frostweaver.chilling-mist')!
  const markup = renderToStaticMarkup(<SkillDetails skill={skill} expanded />)
  const effects = markup.match(/<ol>([\s\S]*?)<\/ol>/)?.[1]
  expect(effects).toContain('<strong>Frozen Ground</strong>')
  expect(effects).not.toContain('Each cast has its own allowance')
  expect(markup).toContain('aria-label="Ground area rules"')
  expect(markup.match(/Each cast has its own allowance/g)).toHaveLength(1)
})
