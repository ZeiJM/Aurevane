import { combatStatBonus } from './combat-stat-bonuses'
import { effectUsesGroundDelivery } from './combat-effect-delivery'
import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEncounterState,
  CombatEffectDefinition,
} from './actions'
import { hasGameplayTag } from './gameplay-tags'
import type { TacticalBattleState } from './board'

import { AIRBORNE_JUMP, AIRBORNE_ATTACK_TARGET_ELEVATION } from './combat-airborne-description'
export {
  AIRBORNE_JUMP,
  AIRBORNE_ATTACK_TARGET_ELEVATION,
  airborneDescription,
} from './combat-airborne-description'

type AirborneMovementState = Pick<
  CombatEncounterState,
  'statusState' | 'effectState' | 'airborneJumpPolicyVersion'
>

/** Effective values are derived from active status; saved movement/stat profiles stay unchanged. */
export function airborneJump(
  state: AirborneMovementState,
  actorId: string,
  baseJump: number,
  content: CombatContentCatalog,
): number {
  const bonus =
    'capturedAbilitySources' in state && 'tactical' in state
      ? combatStatBonus(state as CombatEncounterState, actorId, 'jump')
      : 0
  return state.airborneJumpPolicyVersion === 1 &&
    hasGameplayTag(state, actorId, 'Airborne', content)
    ? AIRBORNE_JUMP
    : baseJump + bonus
}

export function airborneMovementTactical<
  T extends Omit<TacticalBattleState, 'battle'> & {
    battle: Pick<TacticalBattleState['battle'], 'currentTurn'>
  },
>(
  state: AirborneMovementState & { tactical: T },
  content: CombatContentCatalog,
  authoredMaximumElevation?: number,
): T {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  const placement = state.tactical.placements.find((row) => row.combatantId === actorId)
  const profile = state.tactical.movementProfiles.find(
    (row) => row.id === placement?.movementProfileId,
  )
  const jump = profile
    ? (authoredMaximumElevation ?? airborneJump(state, actorId!, profile.maxElevationStep, content))
    : undefined
  if (!actorId || !profile || jump === profile.maxElevationStep) return state.tactical
  return {
    ...state.tactical,
    movementProfiles: state.tactical.movementProfiles.map((row) =>
      row.id === profile.id ? { ...row, maxElevationStep: jump! } : row,
    ),
  }
}

export function airborneGroundMiss(
  state: CombatEncounterState,
  action: Pick<CombatActionDefinition, 'target' | 'groundTargetedRecipientIds'>,
  targetId: string,
  content: CombatContentCatalog,
): boolean {
  return (
    state.airbornePolicyVersion === 1 &&
    (action.groundTargetedRecipientIds !== undefined
      ? action.groundTargetedRecipientIds.includes(targetId)
      : action.target.kind === 'ground-tile') &&
    hasGameplayTag(state, targetId, 'Airborne', content)
  )
}

export function airborneEffectGroundMiss(
  state: CombatEncounterState,
  action: Pick<CombatActionDefinition, 'target' | 'groundTargetedRecipientIds'>,
  effect: Pick<CombatEffectDefinition, 'target'>,
  targetId: string,
  content: CombatContentCatalog,
): boolean {
  return (
    state.airbornePolicyVersion === 1 &&
    effectUsesGroundDelivery(action, effect, targetId) &&
    hasGameplayTag(state, targetId, 'Airborne', content)
  )
}

export function combatActionHasGroundDelivery(
  action: Pick<CombatActionDefinition, 'target' | 'groundTargetedRecipientIds'> &
    Partial<Pick<CombatActionDefinition, 'effects'>>,
): boolean {
  if (
    action.effects?.some((effect) => effect.target === 'ground' || effect.target === 'empty-tile')
  )
    return true
  return action.groundTargetedRecipientIds !== undefined
    ? action.groundTargetedRecipientIds.length > 0
    : action.target.kind === 'ground-tile'
}

/** Transient targeting override; immutable authored Skills and saved loadouts are untouched. */
export function airborneAttackAction<T extends CombatActionDefinition>(
  state: CombatEncounterState,
  action: T,
  content: CombatContentCatalog,
  actorId = state.tactical.battle.currentTurn?.combatantId,
): T {
  return state.airbornePolicyVersion === 1 &&
    actorId &&
    action.tags.includes('attack') &&
    action.sourceType !== 'basic-attack' &&
    hasGameplayTag(state, actorId, 'Airborne', content)
    ? {
        ...action,
        target: { ...action.target, maximumElevationDifference: AIRBORNE_ATTACK_TARGET_ELEVATION },
      }
    : action
}
