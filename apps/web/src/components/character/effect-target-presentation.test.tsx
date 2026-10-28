import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { SkillParameters } from './skill-parameters'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { AbilityParameters } from './ability-parameters'
import { effectTargetLabel } from './effect-target-presentation'

it('shows independent targets in native effect brackets without an overall Target row', () => {
  const base = resolveMatureSkillVersion('farstrider.volley')!
  const skill = {
    ...base,
    ability: undefined,
    effects: [
      {
        type: 'damage' as const,
        recipient: 'affected-units' as const,
        target: 'enemy' as const,
        amount: 10,
      },
      { type: 'healing' as const, recipient: 'actor' as const, target: 'self' as const, amount: 5 },
    ],
  }
  const before = JSON.stringify(skill)
  const html = renderToStaticMarkup(<SkillParameters skill={skill} />)
  expect(html).toMatch(/data-compact-effect-target="true">\[Enemy\]/)
  expect(html).toMatch(/data-compact-effect-target="true">\[Self\]/)
  expect(html).not.toContain('<dt>Target</dt>')
  expect(JSON.stringify(skill)).toBe(before)
})

it('uses payload targets in canonical reports, including global All and Self', () => {
  const base = defaultBasicSkills()[0]!.ability.behaviors[0]!
  const report = abilityBehaviorInformation({
    ...base,
    effects: [
      {
        id: 'global',
        payload: { type: 'damage', recipient: 'affected-units', target: 'all', amount: 10 },
      },
      { id: 'self', payload: { type: 'healing', recipient: 'actor', target: 'self', amount: 5 } },
    ],
  })
  expect(report.effects.map(({ parts }) => parts.target)).toEqual(['All', 'Self'])
  const html = renderToStaticMarkup(<AbilityParameters report={report} />)
  expect(html).toContain('[All]')
  expect(html).not.toContain('<dt>Target</dt>')
  expect(html.match(/data-compact-effect-target/g)).toHaveLength(2)
})

it('preserves inherited recipients without assigning a new target or consulting current content', () => {
  const aim = resolveMatureSkillVersion('farstrider.volley')!.target
  const effect = { type: 'damage', recipient: 'affected-units' }
  expect(effectTargetLabel(effect, aim)).toBe('Enemy')
  expect(
    effectTargetLabel(effect, {
      ...aim,
      geometryVersion: undefined,
      friendlyFire: 'all-except-actor',
    }),
  ).toBe('Anyone except Self')
  expect(effectTargetLabel({ type: 'healing', recipient: 'actor' }, aim)).toBe('Self')
  expect(effectTargetLabel({ type: 'summon', recipient: 'selected-tile' }, aim)).toBe('Empty Tile')
  expect(effectTargetLabel({ type: 'create-terrain', recipient: 'affected-tiles' }, aim)).toBe(
    'Ground',
  )
  expect(effectTargetLabel(effect)).toBe('Trigger Skill affected units')
  expect(effect).not.toHaveProperty('target')
})

it('keeps geometry-three categories and geometry-two team filters distinct from legacy masks', () => {
  const aim = resolveMatureSkillVersion('farstrider.volley')!.target
  const effect = { type: 'damage', recipient: 'affected-units' }
  expect(effectTargetLabel(effect, { ...aim, geometryVersion: 2, friendlyFire: 'all-units' })).toBe(
    'Enemy',
  )
  expect(
    effectTargetLabel(effect, {
      ...aim,
      geometryVersion: 3,
      categories: ['self', 'enemy'],
      friendlyFire: 'enemies-only',
    }),
  ).toBe('Self / Enemy')
  expect(
    effectTargetLabel(effect, {
      ...aim,
      geometryVersion: 3,
      categories: ['ground'],
      friendlyFire: 'all-units',
    }),
  ).toBe('Anyone except Self')
})
