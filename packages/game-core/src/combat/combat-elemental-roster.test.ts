import { describe, it, expect } from 'vitest'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
  validateMatureSkillDefinition,
} from './mature-skills'
describe('immutable current elemental roster', () => {
  it.each([
    ['frostweaver', 'ice'],
    ['tidecaller', 'water'],
    ['stormsinger', 'storm'],
  ] as const)('appends typed %s damage without unrelated changes', (discipline, element) => {
    const skills = latestEnabledMatureSkills().filter(
      (skill) =>
        skill.sourceDisciplineId === discipline &&
        skill.effects.some((effect) => effect.type === 'damage'),
    )
    expect(skills.length).toBeGreaterThan(0)
    for (const current of skills) {
      const old = resolveMatureSkillVersion(current.id, current.contentVersion - 1)!
      expect(
        current.effects
          .filter((effect) => effect.type === 'damage')
          .every((effect) => effect.element === element),
      ).toBe(true)
      expect({
        ...current,
        contentVersion: old.contentVersion,
        effects: old.effects,
        authoring: old.authoring,
      }).toEqual(old)
      expect(validateMatureSkillDefinition(current), current.id).toEqual([])
    }
  })
})
