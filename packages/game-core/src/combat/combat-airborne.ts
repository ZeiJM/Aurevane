import type { CombatActionDefinition, CombatContentCatalog, CombatEncounterState } from './actions'
import { hasGameplayTag } from './gameplay-tags'

export function airborneGroundMiss(
  state: CombatEncounterState,
  action: Pick<CombatActionDefinition, 'target'>,
  targetId: string,
  content: CombatContentCatalog,
): boolean {
  return (
    state.airbornePolicyVersion === 1 &&
    action.target.kind === 'ground-tile' &&
    hasGameplayTag(state, targetId, 'Airborne', content)
  )
}

/** Transient targeting override; immutable authored Skills and saved loadouts are untouched. */
export function airborneAttackAction<T extends CombatActionDefinition>(
  state: CombatEncounterState,
  action: T,
  content: CombatContentCatalog,
): T {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  return state.airbornePolicyVersion === 1 &&
    actorId &&
    action.tags.includes('attack') &&
    action.sourceType !== 'basic-attack' &&
    hasGameplayTag(state, actorId, 'Airborne', content)
    ? { ...action, target: { ...action.target, maximumElevationDifference: 3 } }
    : action
}
