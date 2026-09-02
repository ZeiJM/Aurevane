import {
  createBasicAttackDefinition,
  createCombatEncounterState,
  endCombatTurn,
  evaluateCombatAction,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatActionEvaluation,
  type CombatContentCatalog,
  type CombatStatusDefinition,
  type CombatTargetSelection,
} from './actions'
import type { BattleCombatant, BattleFacing, BattleTemporaryResource } from './battle-state'
import {
  evaluateCurrentMovementPath,
  moveCurrentCombatant,
  selectCurrentFinalFacing,
  type GridPosition,
} from './board'
import {
  PV1F_BASIC_ATTACK_COST,
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_GUARD_COST,
  PV1F_MOVEMENT_COST_PER_TERRAIN_POINT,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
  pv1fFlatActionCost,
} from './pv1f-skills'
import {
  executeStatDrivenAttack,
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

export {
  PV1F_BASIC_ATTACK_COST,
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_GUARD_COST,
  PV1F_MOVEMENT_COST_PER_TERRAIN_POINT,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_MP_RECOVER_COST,
  PV1F_RECOVER_ACTION_ID,
  PV1F_RECOVER_COST,
} from './pv1f-skills'

export const PV1F_ACTION_ECONOMY_MAXIMUM = 100 as const
export const PV1F_RECOVER_PERCENT = 10 as const
export const PV1F_MP_RECOVER_PERCENT = 10 as const
export const PV1F_STATUS_MAXIMUM_STACKS = 3 as const

export const PV1F_ACTION_ECONOMY_RESOURCE_KEY = 'pv1f.action-economy' as const
export const PV1F_ACTION_ECONOMY_TURN_KEY = 'pv1f.action-economy-turn' as const
export const PV1F_BASIC_ATTACK_DAMAGE_KEY = 'pv1f.basic-attack-damage' as const

export const PV1F_GUARDED_STATUS: CombatStatusDefinition = {
  id: 'guarded',
  version: 1,
  maximumStacks: PV1F_STATUS_MAXIMUM_STACKS,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 8_500,
}

// Lowered Guard is a one-turn anti-timeout debuff. A combatant who times out again can receive
// a fresh application, but one application must never persist beyond the next owner-turn start.
export const PV1F_LOWERED_GUARD_STATUS: CombatStatusDefinition = {
  id: 'lowered-guard',
  version: 1,
  maximumStacks: PV1F_STATUS_MAXIMUM_STACKS,
  durationOwnerTurnStarts: 1,
  damageTakenMultiplierBasisPoints: 25_000,
}

export const PV1F_COMBAT_CONTENT: CombatContentCatalog = {
  statuses: [PV1F_GUARDED_STATUS, PV1F_LOWERED_GUARD_STATUS],
}

export type Pv1fActionEconomyActionId =
  | typeof PV1F_BASIC_ATTACK_ID
  | typeof PV1F_GUARD_ACTION_ID
  | typeof PV1F_RECOVER_ACTION_ID
  | typeof PV1F_MP_RECOVER_ACTION_ID

export interface Pv1fActionEconomyIntent {
  actionId: Pv1fActionEconomyActionId
  target?: CombatTargetSelection
}

export interface Pv1fActionEconomyEvaluation {
  allowed: boolean
  actionEconomyCost: number
  remainingActionEconomy: number
  action: CombatActionEvaluation
}

function currentActionEconomy(state: StatDrivenCombatEncounterState): number {
  const value = state.temporaryResources[PV1F_ACTION_ECONOMY_RESOURCE_KEY]
  return typeof value === 'number' ? value : PV1F_ACTION_ECONOMY_MAXIMUM
}

function withCurrentActionEconomy(
  state: StatDrivenCombatEncounterState,
  value: number,
): StatDrivenCombatEncounterState {
  return {
    ...state,
    temporaryResources: {
      ...state.temporaryResources,
      [PV1F_ACTION_ECONOMY_RESOURCE_KEY]: value,
    },
  }
}

function actionDefinitionForIntent(
  state: StatDrivenCombatEncounterState,
  intent: Pv1fActionEconomyIntent,
): CombatActionDefinition | null {
  switch (intent.actionId) {
    case PV1F_BASIC_ATTACK_ID:
      return createBasicAttackDefinition(state)
    case PV1F_GUARD_ACTION_ID:
    case PV1F_RECOVER_ACTION_ID:
    case PV1F_MP_RECOVER_ACTION_ID:
      return state.content.actions.find((action) => action.id === intent.actionId) ?? null
    default:
      return null
  }
}

export function createPv1fCombatEncounterState(
  combatants: BattleCombatant[],
  options?: {
    firstCombatantId?: string
    temporaryResources?: Record<string, BattleTemporaryResource>
  },
): StatDrivenCombatEncounterState {
  const initial = createCombatEncounterState(combatants, {
    firstCombatantId: options?.firstCombatantId,
    temporaryResources: {
      ...(options?.temporaryResources ?? {}),
      [PV1F_ACTION_ECONOMY_RESOURCE_KEY]: PV1F_ACTION_ECONOMY_MAXIMUM,
      [PV1F_ACTION_ECONOMY_TURN_KEY]: 1,
    },
  })
  return reattachStatDrivenCombatBridge({
    ...initial,
    content: PV1F_COMBAT_CONTENT,
  })
}

function actionEconomyCostForIntent(intent: Pv1fActionEconomyIntent): number {
  return pv1fFlatActionCost(intent.actionId)
}

export function evaluatePv1fActionEconomyIntent(
  state: StatDrivenCombatEncounterState,
  intent: Pv1fActionEconomyIntent,
): Pv1fActionEconomyEvaluation {
  validateStatDrivenCombatEncounterState(state)
  const definition = actionDefinitionForIntent(state, intent)
  if (!definition) {
    throw new Error(`Unknown PV-1F action '${intent.actionId}'.`)
  }
  const actionEconomyCost = actionEconomyCostForIntent(intent)
  const remaining = currentActionEconomy(state)
  const action = evaluateCombatAction(state, definition, intent.target)
  const allowed = action.allowed && remaining >= actionEconomyCost
  return {
    allowed,
    actionEconomyCost,
    remainingActionEconomy: allowed ? remaining - actionEconomyCost : remaining,
    action,
  }
}

export function executePv1fActionEconomyIntent(
  state: StatDrivenCombatEncounterState,
  intent: Pv1fActionEconomyIntent,
): StatDrivenCombatEncounterState {
  const evaluation = evaluatePv1fActionEconomyIntent(state, intent)
  if (!evaluation.allowed) {
    throw new Error(
      evaluation.action.reason ??
        `Not enough Action Economy for '${intent.actionId}' (${evaluation.actionEconomyCost} required).`,
    )
  }
  const definition = actionDefinitionForIntent(state, intent)
  if (!definition) throw new Error(`Unknown PV-1F action '${intent.actionId}'.`)

  const executed =
    intent.actionId === PV1F_BASIC_ATTACK_ID
      ? executeStatDrivenAttack(state, definition, intent.target)
      : executeCombatAction(state, definition, intent.target)
  return withCurrentActionEconomy(executed, evaluation.remainingActionEconomy)
}

export function movePv1fCurrentCombatant(
  state: StatDrivenCombatEncounterState,
  path: GridPosition[],
): StatDrivenCombatEncounterState {
  validateStatDrivenCombatEncounterState(state)
  const movement = evaluateCurrentMovementPath(state, path)
  if (!movement.allowed) throw new Error(movement.reason ?? 'Movement is not allowed.')

  const cost = movement.terrainPoints * PV1F_MOVEMENT_COST_PER_TERRAIN_POINT
  const remaining = currentActionEconomy(state)
  if (remaining < cost) {
    throw new Error(`Not enough Action Economy for movement (${cost} required).`)
  }

  return withCurrentActionEconomy(moveCurrentCombatant(state, path), remaining - cost)
}

export function finishPv1fCurrentTurn(
  state: StatDrivenCombatEncounterState,
  facing: BattleFacing,
): StatDrivenCombatEncounterState {
  validateStatDrivenCombatEncounterState(state)
  const faced = selectCurrentFinalFacing(state, facing)
  const ended = endCombatTurn(faced)
  return {
    ...ended,
    temporaryResources: {
      ...ended.temporaryResources,
      [PV1F_ACTION_ECONOMY_RESOURCE_KEY]: PV1F_ACTION_ECONOMY_MAXIMUM,
      [PV1F_ACTION_ECONOMY_TURN_KEY]:
        typeof ended.temporaryResources[PV1F_ACTION_ECONOMY_TURN_KEY] === 'number'
          ? Number(ended.temporaryResources[PV1F_ACTION_ECONOMY_TURN_KEY]) + 1
          : 1,
    },
  }
}
