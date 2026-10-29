import { expect, it } from 'vitest'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { createDisciplineSkillDraft } from './discipline-skill-creation'

it('makes an independent template Skill with a new parent, identity and cooldown ownership', () => {
  const source = {
    ...structuredClone(latestEnabledMatureSkills()[0]!),
    ability: structuredClone(defaultBasicSkills()[0]!.ability),
  }
  const before = structuredClone(source)
  const result = createDisciplineSkillDraft(source, 'discipline.custom', 'skill.custom')
  expect(source).toEqual(before)
  expect(result).toMatchObject({
    id: 'skill.custom',
    sourceDisciplineId: 'discipline.custom',
    contentVersion: 1,
    name: 'New Skill',
    nameRef: 'skill.custom.name',
    descriptionRef: 'skill.custom.description',
  })
  expect(result.effects).toEqual(source.effects)
  expect(result.cooldown?.key).not.toBe(source.cooldown?.key)
  const cooldowns = result.ability?.behaviors.flatMap((row) =>
    row.cooldown ? [row.cooldown.key] : [],
  )
  expect(cooldowns?.every((key) => key.startsWith('skill.custom'))).toBe(true)
})
