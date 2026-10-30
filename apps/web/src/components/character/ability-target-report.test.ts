import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import {
  skillCompactRangeDescription,
  skillLineOfSightDescription,
  skillTargetDescription,
  skillTargetMethodExplanation,
} from './skill-detail-presentation'

function behaviorFor(shape: 'single' | 'circle' | 'all' = 'single') {
  const ability = defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability
  const behavior = ability.behaviors[0]!
  return parseAbilityDefinition({
    ...ability,
    behaviors: [
      {
        ...behavior,
        effects: behavior.effects.map((effect) => ({
          ...effect,
          payload: {
            ...effect.payload,
            recipient: shape === 'single' ? 'primary-unit' : 'affected-units',
          },
        })),
        targeting: {
          ...behavior.targeting,
          geometryVersion: 3,
          kind: shape === 'single' ? 'self' : 'unit',
          categories: ['self', 'enemy'],
          teamPolicy: 'self',
          minimumRange: 0,
          maximumRange: shape === 'circle' ? 1 : 4,
          shape: shape === 'circle' ? { kind: shape, radius: 1 } : { kind: shape },
          requiresLineOfSight: true,
          maximumSelections: 1,
        },
      },
    ],
  }).behaviors[0]!
}

it('reports parsed mixed Self/Enemy targets without hiding range or visibility', () => {
  const behavior = behaviorFor()
  const target = behavior.targeting!
  expect(skillTargetDescription({ target })).toBe('Self / Enemy')
  expect(skillCompactRangeDescription({ target })).toBe('4')
  expect(skillLineOfSightDescription({ target })).toBe('Required')
  const rows = Object.fromEntries(abilityBehaviorInformation(behavior).rows)
  expect(rows).toMatchObject({ 'Target Method': 'Single [4]', 'Line of Sight': 'Required' })
  expect(rows.Effects).toContain('[Self / Enemy]')
  expect(Object.keys(rows)).toHaveLength(8)
  expect(rows).not.toHaveProperty('Target')
  const selfOnly = { ...target, categories: ['self' as const] }
  expect(skillCompactRangeDescription({ target: selfOnly })).toBe('4')
  expect(skillLineOfSightDescription({ target: selfOnly })).toBe('N/A')
})

it('retains authored visibility for current All while historical All ignores it', () => {
  const behavior = behaviorFor('all')
  const target = behavior.targeting!
  expect(skillCompactRangeDescription({ target })).toBe('N/A')
  expect(skillLineOfSightDescription({ target })).toBe('Required')
  expect(Object.fromEntries(abilityBehaviorInformation(behavior).rows)['Line of Sight']).toBe(
    'Required',
  )
  expect(skillLineOfSightDescription({ target: { ...target, geometryVersion: 2 } })).toBe('N/A')
  expect(skillTargetMethodExplanation({ target })).toContain('line of sight rules apply')
})

it('describes current Circle geometry rather than historical aimed geometry', () => {
  const target = behaviorFor('circle').targeting!
  expect(skillTargetMethodExplanation({ target })).toContain('8 surrounding tiles')
  expect(skillTargetMethodExplanation({ target })).not.toContain('Historical')
  expect(skillTargetMethodExplanation({ target })).toContain('includes yourself')
})

it('keeps persistent Ground delivery in Target Method help', () => {
  const group = behaviorFor()
  const report = abilityBehaviorInformation({
    ...group,
    targeting: { ...group.targeting!, kind: 'ground-tile', categories: ['ground'] },
    groundArea: {
      durationRounds: 3,
      visualPresetId: 'embers',
      entryEffectIds: [group.effects[0]!.id],
      timing: 'instant',
    },
  })
  const rows = Object.fromEntries(report.rows)
  expect(rows['Target Method']).toBe('Single [4]')
  expect(report.targetMethodExplanation).toContain('3 rounds')
  expect(report.targetMethodExplanation).toContain('starting immediately')
  expect(report.targetMethodExplanation).toContain('once per character’s turn')
  expect(Object.keys(rows)).toHaveLength(8)
  expect(rows).not.toHaveProperty('Target')
  expect(report.effects).toHaveLength(group.effects.length)
})

it('marks only the selected repeated Ground packet when other unit and caster effects are cast-only', () => {
  const group = behaviorFor()
  const behavior = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...group,
        targeting: {
          ...group.targeting!,
          kind: 'ground-tile',
          categories: ['ground'],
          teamPolicy: 'enemy',
          friendlyFire: 'enemies-only',
          minimumRange: 0,
          maximumRange: 2,
        },
        effects: [
          { id: 'cast-hit', payload: { type: 'damage', recipient: 'affected-units', amount: 10 } },
          { id: 'repeat-hit', payload: { type: 'damage', recipient: 'affected-units', amount: 4 } },
          {
            id: 'caster-buff',
            payload: {
              type: 'apply-status',
              recipient: 'actor',
              statusId: 'guarded',
              stacks: 1,
              durationTurns: 2,
              potencyBasisPoints: 1200,
            },
          },
        ],
        groundArea: {
          durationRounds: 3,
          visualPresetId: 'embers',
          entryEffectIds: ['repeat-hit'],
          timing: 'instant',
        },
      },
    ],
  }).behaviors[0]!
  const before = JSON.stringify(behavior)
  const report = abilityBehaviorInformation(behavior)
  expect(report.effects.map((effect) => effect.repeatsOnEntry)).toEqual([false, true, false])
  expect(report.targetMethodExplanation).toContain('only the effects marked for entry')
  expect(Object.fromEntries(report.rows).Effects).not.toContain('Repeats on entry')
  expect(JSON.stringify(report)).not.toContain('repeat-hit')
  expect(JSON.stringify(behavior)).toBe(before)
})
