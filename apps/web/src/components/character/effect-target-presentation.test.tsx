import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { SkillParameters } from './skill-parameters'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { AbilityParameters } from './ability-parameters'
import { abilityManualInlineParts, plainManualInlineParts } from '@/content/manual-mechanic-text'
import { SkillCharacteristicRows } from './skill-characteristic-rows'
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

it('shows Move destination as Ground without changing its actor recipient or captures', () => {
  const base = defaultBasicSkills().find((row) => row.id === 'basic.move')!.ability.behaviors[0]!
  const behavior = {
    ...base,
    effects: [
      {
        id: 'move',
        payload: { type: 'move' as const, recipient: 'actor' as const, maximumTiles: 15 },
      },
    ],
  }
  const before = JSON.stringify(behavior)
  const report = abilityBehaviorInformation(behavior)
  expect(report.effects[0]!.parts.target).toBe('Ground')
  expect(Object.fromEntries(report.rows)['Target Method']).toBe('Single')
  expect(JSON.stringify(behavior)).toBe(before)
  expect(effectTargetLabel({ type: 'move', recipient: 'actor', target: 'self' })).toBe('Ground')
})

it('keeps separate reach for mixed Move effects and selected-target Requirements', () => {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  const move = {
    id: 'move',
    payload: { type: 'move' as const, recipient: 'actor' as const, maximumTiles: 15 },
  }
  const mixed = abilityBehaviorInformation({ ...base, effects: [move, ...base.effects] })
  expect(Object.fromEntries(mixed.rows)['Target Method']).toBe('Single [1]')
  expect(mixed.targetMethodExplanation).toContain('Aim: Enemy')
  expect(mixed.targetMethodExplanation).toContain('Aim reach: 1–1 tiles')
  const selected = abilityBehaviorInformation({
    ...base,
    effects: [move],
    requirements: {
      kind: 'status-presence',
      subject: 'selected',
      statusId: 'guarded',
      present: true,
    },
  })
  expect(Object.fromEntries(selected.rows)['Target Method']).toBe('Single [1]')
})

it('keeps historical delivery notes in help without rewriting captured rows or inventing data', () => {
  const rows = [['Target Method', 'Single [4] · Aim: Enemy · Up to 2 distinct targets']] as const
  const before = JSON.stringify(rows)
  const html = renderToStaticMarkup(
    <dl>
      <SkillCharacteristicRows rows={rows} />
    </dl>,
  )
  expect(html).toContain('title="Single [4] · Aim: Enemy · Up to 2 distinct targets"')
  expect(html).toContain('Single [4]')
  expect(html).not.toContain('>Single [4] · Aim:')
  expect(JSON.stringify(rows)).toBe(before)
  const missing = renderToStaticMarkup(
    <dl>
      <SkillCharacteristicRows rows={[['Target Method', 'Unavailable']]} />
    </dl>,
  )
  expect(missing).not.toContain('Aim:')
})

it('retains typed delivery constraints in the text-only Manual explanation', () => {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  const report = abilityBehaviorInformation(base)
  const text = plainManualInlineParts(abilityManualInlineParts(report, 'Manual Action'))!
  expect(text).toContain('Target Method: Single [1]')
  expect(text).toContain('Delivery: ' + report.targetMethodExplanation)
})

it('preserves every historical behavior group while moving each delivery note to help', () => {
  const rows = [
    ['Target Method', ['first: Single [4] · Aim: Enemy', 'second: Circle [2] · Aim: Ground']],
  ] as const
  const html = renderToStaticMarkup(
    <dl>
      <SkillCharacteristicRows rows={rows} />
    </dl>,
  )
  expect(html).toContain('>first: Single [4]; second: Circle [2]</dd>')
  expect(html).toContain('Aim: Enemy')
  expect(html).toContain('Aim: Ground')
})

it('renders a compact Target Method without an information button', () => {
  const html = renderToStaticMarkup(
    <dl>
      <SkillCharacteristicRows
        rows={[['Target Method', 'Single']]}
        targetMethodExplanation="Aim: Ground"
      />
    </dl>,
  )
  expect(html).toContain('title="Aim: Ground">Single</dd>')
  expect(html).not.toContain('<button')
})
