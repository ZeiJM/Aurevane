import { describe, expect, it } from 'vitest'
import {
  latestEnabledMatureSkills,
  toCombatActionDefinition,
  validateMatureSkillDefinition,
  type MatureSkillDefinition,
} from './mature-skills'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import type { CombatActionDefinition } from './actions'

function stagedSkill(): MatureSkillDefinition {
  const previous = latestEnabledMatureSkills()[0]
  if (!previous) throw new Error('Expected an existing enabled Skill fixture.')
  return {
    ...previous,
    effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' }],
  } as unknown as MatureSkillDefinition
}

describe('Status copying: staged publication boundary', () => {
  it('rejects the incomplete copy family at the mature Skill definition boundary', () => {
    expect(validateMatureSkillDefinition(stagedSkill())).toContain('effects.status-copy-staged')
  })
  it('does not bind staged copying to the ordinary repeated-Skill adapter', () => {
    expect(() => toCombatActionDefinition(stagedSkill(), 'pve')).toThrow(/status-copy-staged/)
  })
  it('does not permit the old Basic Attack path to carry a copy command', () => {
    const action = {
      id: 'test.copy-basic', version: 1, sourceType: 'basic-attack', tags: [],
      target: { kind: 'unit', teamPolicy: 'enemy', shape: { kind: 'single' },
        minimumRange: 1, maximumRange: 3, requiresLineOfSight: false,
        maximumElevationDifference: null, friendlyFire: 'enemies-only' },
      cost: { spendsAction: true, mp: 0 }, requirements: [],
      effects: stagedSkill().effects,
    } as CombatActionDefinition
    expect(() => validateCombatActionDefinition(action)).toThrow()
  })
})
