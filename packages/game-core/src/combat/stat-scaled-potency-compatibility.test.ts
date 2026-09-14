import { describe, expect, it } from 'vitest'

import {
  P2_3_UNARMED_ATTACK_PROFILE,
  createBasicAttackDefinition,
  type CombatEffectDefinition,
} from './actions'
import { P36_REPRESENTATIVE_ESSENCES } from './essence'
import { latestEnabledMatureSkills } from './mature-skills'

function damageEffects(
  effects: readonly CombatEffectDefinition[],
): readonly Extract<CombatEffectDefinition, { type: 'damage' }>[] {
  return effects.filter(
    (effect): effect is Extract<CombatEffectDefinition, { type: 'damage' }> => effect.type === 'damage',
  )
}

describe('P4.K2 behavior-preserving scaling migration', () => {
  it('does not opt any current enabled Discipline Skill into offensive scaling yet', () => {
    const skills = latestEnabledMatureSkills()
    expect(skills.length).toBeGreaterThan(0)

    const authoredDamage = skills.flatMap((skill) =>
      damageEffects(skill.effects).map((effect) => ({ skillId: skill.id, effect })),
    )
    expect(authoredDamage.length).toBeGreaterThan(0)
    expect(
      authoredDamage.filter(({ effect }) => Object.prototype.hasOwnProperty.call(effect, 'scaling')),
    ).toEqual([])
  })

  it('does not opt any current enabled Essence Skill into offensive scaling yet', () => {
    const essences = P36_REPRESENTATIVE_ESSENCES.filter((essence) => essence.enabled)
    expect(essences.length).toBeGreaterThan(0)

    const authoredDamage = essences.flatMap((essence) =>
      damageEffects(essence.skill.effects).map((effect) => ({ essenceId: essence.essenceId, effect })),
    )
    expect(authoredDamage.length).toBeGreaterThan(0)
    expect(
      authoredDamage.filter(({ effect }) => Object.prototype.hasOwnProperty.call(effect, 'scaling')),
    ).toEqual([])
  })

  it('keeps the current Basic Attack authored damage unscaled', () => {
    const basicAttack = createBasicAttackDefinition(P2_3_UNARMED_ATTACK_PROFILE)
    const damage = damageEffects(basicAttack.effects)

    expect(damage).toHaveLength(1)
    expect(Object.prototype.hasOwnProperty.call(damage[0], 'scaling')).toBe(false)
    expect(damage[0]?.amount).toBe(P2_3_UNARMED_ATTACK_PROFILE.damage)
  })
})
