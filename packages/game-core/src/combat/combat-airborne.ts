import type { CombatActionDefinition, CombatContentCatalog, CombatEncounterState } from './actions'
import { hasGameplayTag } from './gameplay-tags'
import type { TacticalBattleState } from './board'

export const AIRBORNE_JUMP = 3
export const AIRBORNE_ATTACK_TARGET_ELEVATION = 3

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
  return state.airborneJumpPolicyVersion === 1 &&
    hasGameplayTag(state, actorId, 'Airborne', content)
    ? AIRBORNE_JUMP
    : baseJump
}

export function airborneMovementTactical<
  T extends Omit<TacticalBattleState, 'battle'> & {
    battle: Pick<TacticalBattleState['battle'], 'currentTurn'>
  },
>(state: AirborneMovementState & { tactical: T }, content: CombatContentCatalog): T {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  const placement = state.tactical.placements.find((row) => row.combatantId === actorId)
  const profile = state.tactical.movementProfiles.find(
    (row) => row.id === placement?.movementProfileId,
  )
  if (
    !actorId ||
    !profile ||
    airborneJump(state, actorId, profile.maxElevationStep, content) === profile.maxElevationStep
  )
    return state.tactical
  return {
    ...state.tactical,
    movementProfiles: state.tactical.movementProfiles.map((row) =>
      row.id === profile.id ? { ...row, maxElevationStep: AIRBORNE_JUMP } : row,
    ),
  }
}

export function airborneDescription(legacyAirborne = false, legacyJump = false): string {
  if (legacyAirborne)
    return 'Ignore the Frozen Ground AP surcharge. Board bounds, elevation, obstacles, occupancy, Rooted and Movement allowance still apply.'
  return `Ground-targeted Skills always miss you (100% evasion), including area activations. ${legacyJump ? '' : `Your Jump is ${AIRBORNE_JUMP} while Airborne is active. `}Your Attack Skills have Target Elevation ${AIRBORNE_ATTACK_TARGET_ELEVATION} while Airborne is active. Ignore the Frozen Ground AP surcharge; board bounds, movement elevation, obstacles, occupancy, Rooted, Slow and Movement allowance still apply.`
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

export function combatActionHasGroundDelivery(
  action: Pick<CombatActionDefinition, 'target' | 'groundTargetedRecipientIds'>,
): boolean {
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
