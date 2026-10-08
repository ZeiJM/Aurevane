import { resolveMatureSkillVersion, type MatureSkillDefinition } from './mature-skills'
import { resolveEssenceForBuild } from './essence'
import { PERCENTAGE_RECOVERY_CONTENT_TAG } from './combat-recovery-roster'
/** Fixtures for contracts that explicitly test the previously published Power-based content. */
export function prePercentageRecoverySkill(id: string): MatureSkillDefinition {
  const current = resolveMatureSkillVersion(id)!
  return current.authoring.validationTags.includes(PERCENTAGE_RECOVERY_CONTENT_TAG)
    ? resolveMatureSkillVersion(id, current.contentVersion - 1)!
    : current
}
export function prePercentageRecoveryEssence(primary: string) {
  const current = resolveEssenceForBuild(primary, null)!
  return current.authoring.validationTags.includes(PERCENTAGE_RECOVERY_CONTENT_TAG)
    ? resolveEssenceForBuild(primary, null, current.contentVersion - 1)!
    : current
}
