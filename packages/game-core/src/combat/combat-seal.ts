import type { CombatActionDefinition, CombatEncounterState, CombatStatusInstance } from './actions'
import type { CombatActionSourceKind } from './combat-kernel-types'
import type { AbilityClassification } from './combat-requirements'

export const SEAL_CATEGORIES = ['attack', 'recovery', 'utility'] as const
export type SealCategory = (typeof SEAL_CATEGORIES)[number]
export function validateSealCategories(value: unknown): asserts value is readonly SealCategory[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 3 ||
    new Set(value).size !== value.length ||
    value.some((category) => !SEAL_CATEGORIES.includes(category))
  )
    throw new TypeError(
      'Seal requires one or more distinct categories: Attack, Recovery or Utility.',
    )
}
export function sealCategorySummary(categories: readonly SealCategory[]): string {
  return SEAL_CATEGORIES.filter((category) => categories.includes(category))
    .map((category) => category[0]!.toUpperCase() + category.slice(1))
    .join(', ')
}
export function sealCategoriesForStatus(
  status: Pick<CombatStatusInstance, 'sealedCategories' | 'applicationModifiers'>,
): readonly SealCategory[] {
  const applications = status.applicationModifiers ?? [status]
  return SEAL_CATEGORIES.filter((category) =>
    applications.some((application) => application.sealedCategories?.includes(category)),
  )
}
export function combatSealBlocksSkill(
  state: Pick<CombatEncounterState, 'statusState'>,
  combatantId: string,
  sourceKind: CombatActionSourceKind,
  classification: AbilityClassification,
): boolean {
  if (
    sourceKind !== 'discipline-skill' ||
    !SEAL_CATEGORIES.includes(classification as SealCategory)
  )
    return false
  return (
    state.statusState
      .find((row) => row.combatantId === combatantId)
      ?.statuses.some(
        (status) =>
          status.statusId === 'seal' &&
          status.timingState !== 'pending' &&
          (status.applicationModifiers ?? [status]).some((application) =>
            application.sealedCategories?.includes(classification as SealCategory),
          ),
      ) === true
  )
}
/** Only trusted canonical materialization delegates activation eligibility to participant checks. */
export function combatSealBlocksNativeAction(
  state: Pick<CombatEncounterState, 'statusState'>,
  combatantId: string,
  action: CombatActionDefinition,
): boolean {
  if (
    action.canonicalAbilityAction === true ||
    action.sourceType !== 'discipline-skill' ||
    action.tags.some((tag) => ['essence', 'resonance', 'severance', 'ascension'].includes(tag))
  )
    return false
  const classification = action.tags.includes('attack')
    ? 'attack'
    : action.tags.includes('recovery') || action.tags.includes('healing')
      ? 'recovery'
      : action.tags.includes('utility')
        ? 'utility'
        : action.effects.some((effect) => ['healing', 'percentage-recovery'].includes(effect.type))
          ? 'recovery'
          : 'utility'
  return combatSealBlocksSkill(state, combatantId, 'discipline-skill', classification)
}
