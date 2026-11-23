import type { CombatActionDefinition, CombatEncounterState, CombatTargetSpec } from './actions'
import { combatTargetCategories } from './combat-targeting-shapes'
import { combatStatusApplications } from './combat-status-applications'

/** Only maximum aim reach changes. Authored footprints and minimum range remain literal. */
export function combatRangeTarget(
  state: Pick<CombatEncounterState, 'rangeModifierPolicyVersion' | 'statusState'>,
  actorId: string,
  action: CombatActionDefinition,
): CombatTargetSpec {
  const target = action.target
  if (
    state.rangeModifierPolicyVersion !== 1 ||
    action.rangeModifierEligible === false ||
    (!action.rangeModifierEligible &&
      !['basic-attack', 'discipline-skill'].includes(action.sourceType)) ||
    action.tags.some((tag) => ['essence', 'resonance', 'severance', 'ascension'].includes(tag)) ||
    target.shape.kind === 'all' ||
    combatTargetCategories(target).every((category) => category === 'self')
  )
    return target
  let adjustment = 0n
  for (const status of state.statusState.find((row) => row.combatantId === actorId)?.statuses ??
    []) {
    if (status.timingState === 'pending' || !['range-up', 'range-down'].includes(status.statusId))
      continue
    for (const application of combatStatusApplications(status)) {
      const amount = BigInt(application.rangeTiles ?? 0) * BigInt(application.stacks)
      adjustment += status.statusId === 'range-up' ? amount : -amount
    }
  }
  const maximumRange = BigInt(target.maximumRange) + adjustment
  const minimum = BigInt(target.minimumRange)
  // Exact net stacking precedes technical saturation: large opposing applications
  // cancel without order-dependent overflow, while every usable board range stays exact.
  const bounded =
    maximumRange < minimum
      ? minimum
      : maximumRange > BigInt(Number.MAX_SAFE_INTEGER)
        ? BigInt(Number.MAX_SAFE_INTEGER)
        : maximumRange
  return adjustment === 0n ? target : { ...target, maximumRange: Number(bounded) }
}
