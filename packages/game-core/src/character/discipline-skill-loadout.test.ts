import { describe, expect, it } from 'vitest'

import {
  disciplineSkillCapacity,
  validateDisciplineSkillLoadout,
  type DisciplineSkillReference,
} from './discipline-skill-loadout'

function skill(
  skillId: string,
  sourceDisciplineId: string,
  contentVersion = 1,
): DisciplineSkillReference {
  return { skillId, contentVersion, sourceDisciplineId }
}

describe('P3.4 Discipline Skill loadout authority', () => {
  it('uses the canonical eight-pure / six-mixed capacity contract', () => {
    expect(disciplineSkillCapacity(null)).toBe(8)
    expect(disciplineSkillCapacity('lifebinder')).toBe(6)
  })

  it('accepts learned Primary Skills for a pure build and rejects Secondary sources', () => {
    const learned = [skill('vanguard.forceful-strike', 'vanguard', 2)]
    expect(
      validateDisciplineSkillLoadout({
        primaryDisciplineId: 'vanguard',
        secondaryDisciplineId: null,
        equipped: learned,
        learned,
      }),
    ).toEqual([])

    expect(
      validateDisciplineSkillLoadout({
        primaryDisciplineId: 'vanguard',
        secondaryDisciplineId: null,
        equipped: [skill('lifebinder.mending-light', 'lifebinder')],
        learned: [skill('lifebinder.mending-light', 'lifebinder')],
      }),
    ).toContainEqual(expect.objectContaining({ code: 'inactive-skill-source' }))
  })

  it('accepts a mixed split without assuming a fixed Primary/Secondary ratio', () => {
    const learned = [
      skill('vanguard.one', 'vanguard'),
      skill('vanguard.two', 'vanguard'),
      skill('lifebinder.one', 'lifebinder'),
      skill('lifebinder.two', 'lifebinder'),
      skill('lifebinder.three', 'lifebinder'),
      skill('lifebinder.four', 'lifebinder'),
    ]
    expect(
      validateDisciplineSkillLoadout({
        primaryDisciplineId: 'vanguard',
        secondaryDisciplineId: 'lifebinder',
        equipped: learned,
        learned,
      }),
    ).toEqual([])
  })

  it('rejects over-capacity, duplicate, and unlearned selections', () => {
    const equipped = Array.from({ length: 7 }, (_, index) =>
      skill(`vanguard.skill-${index + 1}`, 'vanguard'),
    )
    equipped[6] = equipped[0]
    const learned = equipped.slice(0, 5)
    const issues = validateDisciplineSkillLoadout({
      primaryDisciplineId: 'vanguard',
      secondaryDisciplineId: 'lifebinder',
      equipped,
      learned,
    })

    expect(issues).toContainEqual(expect.objectContaining({ code: 'capacity-exceeded' }))
    expect(issues).toContainEqual(expect.objectContaining({ code: 'duplicate-skill' }))
    expect(issues).toContainEqual(expect.objectContaining({ code: 'skill-not-learned' }))
  })
})
