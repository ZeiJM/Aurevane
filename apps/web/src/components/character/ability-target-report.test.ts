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
  expect(rows).toMatchObject({ Target: 'Self / Enemy', Range: '4', 'Line of Sight': 'Required' })
  expect(Object.keys(rows)).toHaveLength(10)
  const selfOnly = { ...target, categories: ['self' as const] }
  expect(skillCompactRangeDescription({ target: selfOnly })).toBe('N/A')
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
