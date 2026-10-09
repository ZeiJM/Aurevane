import type { CombatActionDefinition, CombatContentCatalog, CombatEncounterState } from './actions'
import { hasGameplayTag } from './gameplay-tags'
import type { TacticalBattleState } from './board'

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
    ? 3
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
      row.id === profile.id ? { ...row, maxElevationStep: 3 } : row,
    ),
  }
}

export function airborneDescription(legacyAirborne = false, legacyJump = false): string {
  if (legacyAirborne)
    return 'Ignore the Frozen Ground AP surcharge. Board bounds, elevation, obstacles, occupancy, Rooted and Movement allowance still apply.'
  return `Ground-targeted Skills always miss you (100% evasion), including area activations. ${legacyJump ? '' : 'Your Jump is 3 while Airborne is active. '}Your Attack Skills have Target Elevation 3 while Airborne is active. Ignore the Frozen Ground AP surcharge; board bounds, movement elevation, obstacles, occupancy, Rooted, Slow and Movement allowance still apply.`
}

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
