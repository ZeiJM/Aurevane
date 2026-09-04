import { describe, expect, it } from 'vitest'

import {
  P33_REPRESENTATIVE_DISCIPLINE_SKILLS,
  resolveMatureSkillForContext,
  resolveMatureSkillVersion,
  toCombatActionDefinition,
  validateMatureSkillDefinition,
} from './mature-skills'

const enabledSkills = P33_REPRESENTATIVE_DISCIPLINE_SKILLS.filter((skill) => skill.enabled)

function skillsFor(disciplineId: string) {
  return enabledSkills.filter((skill) => skill.sourceDisciplineId === disciplineId)
}

describe('P3.8 representative buildcraft catalog', () => {
  it('supports a full eight-Skill pure Vanguard choice and a meaningful Lifebinder mix pool', () => {
    expect(skillsFor('vanguard')).toHaveLength(8)
    expect(skillsFor('lifebinder').length).toBeGreaterThanOrEqual(6)
  })

  it('keeps every enabled Skill identity unique and valid', () => {
    const keys = enabledSkills.map((skill) => `${skill.id}:${skill.contentVersion}`)
    expect(new Set(keys).size).toBe(keys.length)

    for (const skill of enabledSkills) {
      expect(validateMatureSkillDefinition(skill)).toEqual([])
      expect(resolveMatureSkillVersion(skill.id, skill.contentVersion)).toBe(skill)
    }
  })

  it('resolves every representative Skill through the shared PvE and PvP combat action path', () => {
    for (const skill of enabledSkills) {
      for (const context of ['pve', 'pvp'] as const) {
        const resolved = resolveMatureSkillForContext(skill, context)
        const action = toCombatActionDefinition(skill, context)

        expect(resolved.combatContext).toBe(context)
        expect(action.id).toBe(skill.id)
        expect(action.version).toBe(skill.contentVersion)
        expect(action.sourceType).toBe('discipline-skill')
        expect(action.cooldown?.key).toBe(skill.cooldown.key)
        expect(action.effects.length).toBeGreaterThan(0)
      }
    }
  })

  it('does not promote deferred movement or cleanse concepts into fake combat behavior', () => {
    expect(resolveMatureSkillVersion('vanguard.rush')).toBeNull()
    expect(resolveMatureSkillVersion('lifebinder.purify')).toBeNull()
  })
})
