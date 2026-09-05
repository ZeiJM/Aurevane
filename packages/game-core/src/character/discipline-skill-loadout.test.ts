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

describe('P3.4 Discipline Technique loadout authority', () => {
  it('uses the canonical four-technique capacity for pure and mixed builds', () => {
    expect(disciplineSkillCapacity(null)).toBe(4)
    expect(disciplineSkillCapacity('lifebinder')).toBe(4)
  })

  it('accepts learned Primary Techniques for a pure build and rejects Secondary sources', () => {
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

  it('accepts a mixed 2 + 2 split and rejects three Techniques from either source', () => {
    const valid = [
      skill('vanguard.one', 'vanguard'),
      skill('vanguard.two', 'vanguard'),
      skill('lifebinder.one', 'lifebinder'),
      skill('lifebinder.two', 'lifebinder'),
    ]
    expect(
      validateDisciplineSkillLoadout({
        primaryDisciplineId: 'vanguard',
        secondaryDisciplineId: 'lifebinder',
        equipped: valid,
        learned: valid,
      }),
    ).toEqual([])

    const invalid = [
      skill('vanguard.one', 'vanguard'),
      skill('vanguard.two', 'vanguard'),
      skill('vanguard.three', 'vanguard'),
      skill('lifebinder.one', 'lifebinder'),
    ]
    expect(
      validateDisciplineSkillLoadout({
        primaryDisciplineId: 'vanguard',
        secondaryDisciplineId: 'lifebinder',
        equipped: invalid,
        learned: invalid,
      }),
    ).toContainEqual(expect.objectContaining({ code: 'mixed-source-capacity-exceeded' }))
  })

  it('rejects over-capacity, duplicate, and unlearned selections', () => {
    const equipped = Array.from({ length: 5 }, (_, index) =>
      skill(`vanguard.skill-${index + 1}`, 'vanguard'),
    )
    equipped[4] = equipped[0]
    const learned = equipped.slice(0, 3)
    const issues = validateDisciplineSkillLoadout({
      primaryDisciplineId: 'vanguard',
      secondaryDisciplineId: null,
      equipped,
      learned,
    })

    expect(issues).toContainEqual(expect.objectContaining({ code: 'capacity-exceeded' }))
    expect(issues).toContainEqual(expect.objectContaining({ code: 'duplicate-skill' }))
    expect(issues).toContainEqual(expect.objectContaining({ code: 'skill-not-learned' }))
  })
})
