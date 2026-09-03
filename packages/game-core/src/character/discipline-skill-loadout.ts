export const PURE_DISCIPLINE_SKILL_CAPACITY = 8 as const
export const MIXED_DISCIPLINE_SKILL_CAPACITY = 6 as const

export interface DisciplineSkillReference {
  readonly skillId: string
  readonly contentVersion: number
  readonly sourceDisciplineId: string
}

export interface DisciplineSkillLoadoutIssue {
  readonly code:
    | 'capacity-exceeded'
    | 'duplicate-skill'
    | 'invalid-skill-reference'
    | 'inactive-skill-source'
    | 'skill-not-learned'
  readonly message: string
  readonly skillId?: string
}

export interface DisciplineSkillLoadoutValidationInput {
  readonly primaryDisciplineId: string
  readonly secondaryDisciplineId: string | null
  readonly equipped: readonly DisciplineSkillReference[]
  readonly learned: readonly DisciplineSkillReference[]
}

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

export function disciplineSkillCapacity(secondaryDisciplineId: string | null): number {
  return secondaryDisciplineId === null
    ? PURE_DISCIPLINE_SKILL_CAPACITY
    : MIXED_DISCIPLINE_SKILL_CAPACITY
}

function key(reference: DisciplineSkillReference): string {
  return `${reference.skillId}:${reference.contentVersion}:${reference.sourceDisciplineId}`
}

function validReference(reference: DisciplineSkillReference): boolean {
  return (
    STABLE_ID_PATTERN.test(reference.skillId) &&
    Number.isSafeInteger(reference.contentVersion) &&
    reference.contentVersion > 0 &&
    STABLE_ID_PATTERN.test(reference.sourceDisciplineId)
  )
}

export function validateDisciplineSkillLoadout(
  input: DisciplineSkillLoadoutValidationInput,
): readonly DisciplineSkillLoadoutIssue[] {
  const issues: DisciplineSkillLoadoutIssue[] = []
  const capacity = disciplineSkillCapacity(input.secondaryDisciplineId)
  if (input.equipped.length > capacity) {
    issues.push({
      code: 'capacity-exceeded',
      message: `That build may equip at most ${capacity} Discipline Skills.`,
    })
  }

  const allowedSources = new Set(
    input.secondaryDisciplineId === null
      ? [input.primaryDisciplineId]
      : [input.primaryDisciplineId, input.secondaryDisciplineId],
  )
  const learned = new Set(input.learned.map(key))
  const seen = new Set<string>()

  for (const reference of input.equipped) {
    if (!validReference(reference)) {
      issues.push({
        code: 'invalid-skill-reference',
        message: 'A Discipline Skill reference is invalid.',
        skillId: reference.skillId,
      })
      continue
    }
    if (seen.has(reference.skillId)) {
      issues.push({
        code: 'duplicate-skill',
        message: 'A Discipline Skill may only be equipped once.',
        skillId: reference.skillId,
      })
    }
    seen.add(reference.skillId)

    if (!allowedSources.has(reference.sourceDisciplineId)) {
      issues.push({
        code: 'inactive-skill-source',
        message: 'That Discipline Skill does not come from an active Discipline.',
        skillId: reference.skillId,
      })
    }
    if (!learned.has(key(reference))) {
      issues.push({
        code: 'skill-not-learned',
        message: 'That Discipline Skill has not been learned for this character.',
        skillId: reference.skillId,
      })
    }
  }

  return issues
}

// P3.4 exact-head validation trigger; removed in the next commit.
