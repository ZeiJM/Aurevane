import { validateAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { expect, it } from 'vitest'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { upgradeSkillFormat } from './skill-format-upgrade'

it('upgrades every current Skill to a validated full editor draft without changing its source', () => {
  for (const source of latestEnabledMatureSkills()) {
    const before = structuredClone(source)
    const result = upgradeSkillFormat(source)
    expect(source).toEqual(before)
    expect(validateAbilityDefinition(result.ability), source.id).toEqual([])
    expect(result.ability?.behaviors[0]?.effects).toHaveLength(source.effects.length)
    expect(result.ability?.behaviors[0]?.costs).toContainEqual({
      resource: 'ap',
      amount: source.apCost,
    })
  }
})

it('requires an explicit choice before collapsing different context costs', () => {
  const source = { ...latestEnabledMatureSkills()[0]!, overrides: { pvp: { apCost: 99 } } }
  expect(() => upgradeSkillFormat(source)).toThrow('Choose')
  expect(upgradeSkillFormat(source, 'pvp').ability?.behaviors[0]?.costs).toContainEqual({
    resource: 'ap',
    amount: 99,
  })
  expect(upgradeSkillFormat(source, 'base').ability?.behaviors[0]?.costs).toContainEqual({
    resource: 'ap',
    amount: source.apCost,
  })
})

it('preserves Ground entry order and percentage recovery units', () => {
  const ground = latestEnabledMatureSkills().find((row) => row.groundArea)!
  const result = upgradeSkillFormat(ground).ability!.behaviors[0]!
  expect(result.groundArea?.entryEffectIds).toEqual(
    ground.groundArea!.entryEffectOrdinals.map((index) => `effect-${index + 1}`),
  )
  const recovery = latestEnabledMatureSkills().find((row) =>
    row.effects.some((effect) => effect.type === 'percentage-recovery'),
  )!
  const source = recovery.effects.find((effect) => effect.type === 'percentage-recovery')!
  const payload = upgradeSkillFormat(recovery).ability!.behaviors[0]!.effects.find(
    (effect) => effect.payload.type === 'percentage-recovery',
  )!.payload
  expect(payload).toMatchObject({
    type: 'percentage-recovery',
    percentageBasisPoints: source.percent * 100,
  })
  expect(payload).not.toHaveProperty('percent')
})
