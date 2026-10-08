import type { MatureSkillDefinition } from './mature-skills'
import type { ResonanceSkillMatcher } from './resonance'

const STABLE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u

export function validResonanceSkillMatcher(
  matcher: ResonanceSkillMatcher,
  maximumTags = Infinity,
): boolean {
  if (!STABLE_ID.test(matcher.sourceDisciplineId) || !Array.isArray(matcher.requiredTags))
    return false
  if (matcher.matchMode === 'any-skill') return matcher.requiredTags.length === 0
  return (
    matcher.matchMode === undefined &&
    matcher.requiredTags.length >= 1 &&
    matcher.requiredTags.length <= maximumTags &&
    matcher.requiredTags.every((tag) => STABLE_ID.test(tag))
  )
}

export function matchesResonanceSkill(
  skill: MatureSkillDefinition,
  matcher: ResonanceSkillMatcher,
): boolean {
  return (
    skill.sourceDisciplineId === matcher.sourceDisciplineId &&
    (matcher.matchMode === 'any-skill' ||
      matcher.requiredTags.every((tag) => skill.tags.includes(tag)))
  )
}

function title(value: string): string {
  return value.replace(/[._-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** Use the actual matcher rather than inferring Utility from a private category like tempo. */
export function resonanceSkillMatcherDescription(matcher: ResonanceSkillMatcher): string {
  const skills = `${title(matcher.sourceDisciplineId)} Skills`
  return matcher.matchMode === 'any-skill'
    ? skills
    : `${skills} tagged ${matcher.requiredTags.map(title).join(' + ')}`
}
