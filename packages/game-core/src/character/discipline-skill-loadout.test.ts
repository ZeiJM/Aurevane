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

  it.each([
    [1, 3],
    [2, 2],
    [3, 1],
  ])('accepts a mixed %i + %i split', (primaryCount, secondaryCount) => {
    const equipped = [
      ...Array.from({ length: primaryCount }, (_, index) =>
        skill(`vanguard.skill-${index + 1}`, 'vanguard'),
      ),
      ...Array.from({ length: secondaryCount }, (_, index) =>
        skill(`lifebinder.skill-${index + 1}`, 'lifebinder'),
      ),
    ]

    expect(
      validateDisciplineSkillLoadout({
        primaryDisciplineId: 'vanguard',
        secondaryDisciplineId: 'lifebinder',
        equipped,
        learned: equipped,
      }),
    ).toEqual([])
  })

  it('rejects a full mixed 4 + 0 split but allows partial one-source transition loadouts', () => {
    const fourPrimary = Array.from({ length: 4 }, (_, index) =>
      skill(`vanguard.skill-${index + 1}`, 'vanguard'),
    )
    const partialPrimary = [
      skill('vanguard.skill-1', 'vanguard'),
      skill('vanguard.skill-2', 'vanguard'),
    ]

    expect(
      validateDisciplineSkillLoadout({
        primaryDisciplineId: 'vanguard',
        secondaryDisciplineId: 'lifebinder',
        equipped: fourPrimary,
        learned: fourPrimary,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'mixed-source-capacity-exceeded' }),
        expect.objectContaining({ code: 'mixed-source-required' }),
      ]),
    )

    expect(
      validateDisciplineSkillLoadout({
        primaryDisciplineId: 'vanguard',
        secondaryDisciplineId: 'lifebinder',
        equipped: partialPrimary,
        learned: partialPrimary,
      }),
    ).toEqual([])
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
