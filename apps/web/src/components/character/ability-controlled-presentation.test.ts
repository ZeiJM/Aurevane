import { expect, it } from 'vitest'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { abilityBehaviorInformation } from './ability-detail-presentation'

it('reports Controlled as manual whole-action timing rather than an automatic delayed packet', () => {
  const ability = defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability
  const behavior = parseAbilityDefinition({
    ...ability,
    behaviors: ability.behaviors.map((behavior) => ({
      ...behavior,
      effects: behavior.effects.map((effect) => ({ ...effect, timing: 'controlled' })),
    })),
  }).behaviors[0]!
  const information = abilityBehaviorInformation(behavior)
  expect(Object.fromEntries(information.rows).Effects).toContain('[Controlled]')
  expect(information.effectDescriptions[0]).toContain('whole selected action')
  expect(information.effectDescriptions[0]).toContain('legal release')
  expect(information.effectDescriptions[0]).not.toContain('global round boundaries later')
})
