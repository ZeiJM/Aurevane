import { expect, it } from 'vitest'
import { currentEssenceDefinitions, essenceCombatSkill } from '@aurevane/game-core/combat/essence'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { readMechanicsBody, writeMechanicsBody } from './essence-editor-mechanics'
it('edits the canonical Essence mechanics actually consumed by combat without rewriting its retained Skill shadow', () => {
  const source = {
    ...structuredClone(currentEssenceDefinitions()[0]!),
    ability: structuredClone(defaultBasicSkills()[0]!.ability),
  }
  const body = readMechanicsBody('essence', { ...source })
  expect(body.ability).toEqual(source.ability)
  const ability = {
    ...source.ability,
    behaviors: source.ability.behaviors.map((row) => ({
      ...row,
      costs: [{ resource: 'ap' as const, amount: 61 }],
    })),
  }
  const result = writeMechanicsBody('essence', { ...source }, { ...body, ability })
  expect(result.skill).toEqual(source.skill)
  expect(
    essenceCombatSkill(result as unknown as typeof source).ability?.behaviors[0]?.costs,
  ).toEqual([{ resource: 'ap', amount: 61 }])
  expect(source.ability.behaviors[0]?.costs).not.toEqual([{ resource: 'ap', amount: 61 }])
})
it('keeps nested-format Essence ownership and ordinary Skill identity', () => {
  const source = { ...structuredClone(currentEssenceDefinitions()[0]!) }
  const body = readMechanicsBody('essence', source)
  const result = writeMechanicsBody('essence', source, { ...body, name: 'Edited' })
  expect(result).not.toHaveProperty('ability')
  expect(result.skill).toMatchObject({ name: 'Edited' })
  expect(writeMechanicsBody('skill', body, { ...body, name: 'Skill' })).toMatchObject({
    name: 'Skill',
  })
})
