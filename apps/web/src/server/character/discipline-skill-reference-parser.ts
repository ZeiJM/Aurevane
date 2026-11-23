import type { DisciplineSkillReference } from '@aurevane/game-core/character/discipline-skill-loadout'

export function isDisciplineSkillIdentity(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value)
  )
}

/** Historical omission is preserved; a supplied malformed eligibility never becomes native. */
export function parseDisciplineSkillReference(value: unknown): DisciplineSkillReference | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (
    !isDisciplineSkillIdentity(row.skillId) ||
    !isDisciplineSkillIdentity(row.sourceDisciplineId) ||
    typeof row.contentVersion !== 'number' ||
    !Number.isSafeInteger(row.contentVersion) ||
    row.contentVersion < 1 ||
    (Object.hasOwn(row, 'earnedEligibility') && typeof row.earnedEligibility !== 'boolean') ||
    (Object.hasOwn(row, 'eligibilityDisciplineId') &&
      !isDisciplineSkillIdentity(row.eligibilityDisciplineId))
  )
    return null
  return {
    skillId: row.skillId,
    contentVersion: row.contentVersion,
    sourceDisciplineId: row.sourceDisciplineId,
    ...(Object.hasOwn(row, 'eligibilityDisciplineId')
      ? { eligibilityDisciplineId: row.eligibilityDisciplineId as string }
      : {}),
    ...(Object.hasOwn(row, 'earnedEligibility')
      ? { earnedEligibility: row.earnedEligibility as boolean }
      : {}),
  }
}
