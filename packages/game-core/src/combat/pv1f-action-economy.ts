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
  executeStatDrivenAttack,
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

export const PV1F_ACTION_ECONOMY_MAXIMUM = 100 as const
export const PV1F_MOVEMENT_COST_PER_TERRAIN_POINT = 25 as const
export const PV1F_BASIC_ATTACK_COST = 30 as const
export const PV1F_GUARD_COST = 30 as const
export const PV1F_RECOVER_COST = 50 as const
export const PV1F_RECOVER_PERCENT = 10 as const

export const PV1F_ACTION_ECONOMY_RESOURCE_KEY = 'pv1f.action-economy' as const
export const PV1F_ACTION_ECONOMY_TURN_KEY = 'pv1f.action-economy-turn' as const
export const PV1F_BASIC_ATTACK_DAMAGE_KEY = 'pv1f.basic-attack-damage' as const

export const PV1F_BASIC_ATTACK_ID = 'basic.attack.unarmed.basic' as const
export const PV1F_GUARD_ACTION_ID = 'basic.guard' as const
export const PV1F_RECOVER_ACTION_ID = 'basic.recover' as const

export const PV1F_GUARDED_STATUS: CombatStatusDefinition = {
  id: 'guarded',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 8_500,
}

export const PV1F_COMBAT_CONTENT: CombatContentCatalog = {
  statuses: [PV1F_GUARDED_STATUS],
}

export interface Pv1fTransition {
  state: StatDrivenCombatEncounterState
  events: readonly unknown[]
}

export function calculatePv1fBasicAttackDamage(input: {
  level: number
  might: number
  finesse: number
}): number {
  for (const [field, value] of Object.entries(input)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`${field} must be a positive safe integer.`)
    }
  }
  return 6 + input.level + Math.floor(input.might * 0.8) + Math.floor(input.finesse * 0.4)
}

export function createPv1fBasicAttackDefinition(damage: number): CombatActionDefinition {
  if (!Number.isSafeInteger(damage) || damage < 1) {
    throw new RangeError('Basic Attack damage must be a positive safe integer.')
  }
  return createBasicAttackDefinition({
    id: 'unarmed.basic',
    version: 1,
    damage,
    minimumRange: 1,
    maximumRange: 1,
    requiresLineOfSight: false,
    maximumElevationDifference: 1,
    facingModifiersBasisPoints: {
      front: 10_000,
      side: 11_000,
      rear: 12_500,
    },
  })
}

export function createPv1fRecoverAction(maxHp: number): CombatActionDefinition {
  if (!Number.isSafeInteger(maxHp) || maxHp < 1) {
    throw new RangeError('Maximum HP must be a positive safe integer.')
  }
  const amount = Math.max(1, Math.round(maxHp * (PV1F_RECOVER_PERCENT / 100)))
  return {
    id: PV1F_RECOVER_ACTION_ID,
    version: 1,
    sourceType: 'basic-action',
    tags: ['basic', 'recovery'],
    target: {
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'allies-only',
    },
    cost: { spendsAction: true, mp: 0 },
    requirements: [{ kind: 'actor-hp-at-most', basisPoints: 9_999 }],
    effects: [{ type: 'healing', recipient: 'actor', amount }],
  }
}

export function createPv1fTemporaryResources(
  basicAttackDamage: number,
): readonly BattleTemporaryResource[] {
  if (!Number.isSafeInteger(basicAttackDamage) || basicAttackDamage < 1) {
    throw new RangeError('Basic Attack damage must be a positive safe integer.')
  }
  return [
    {
      key: PV1F_ACTION_ECONOMY_RESOURCE_KEY,
      current: PV1F_ACTION_ECONOMY_MAXIMUM,
      maximum: PV1F_ACTION_ECONOMY_MAXIMUM,
    },
    {
      key: PV1F_ACTION_ECONOMY_TURN_KEY,
      current: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    },
    {
      key: PV1F_BASIC_ATTACK_DAMAGE_KEY,
      current: basicAttackDamage,
      maximum: basicAttackDamage,
    },
  ].sort((left, right) => left.key.localeCompare(right.key))
}

export function readPv1fActionEconomy(
  state: StatDrivenCombatEncounterState,
  combatantId: string | null = state.tactical.battle.currentTurn?.combatantId ?? null,
): { current: number; maximum: number } | null {
  if (!combatantId) return null
  const combatant = state.tactical.battle.combatants.find(
    (candidate) => candidate.id === combatantId,
  )
  if (!combatant) return null
  const resource = combatant.temporaryResources.find(
    (candidate) => candidate.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )
  return resource ? { current: resource.current, maximum: resource.maximum } : null
}

export function readPv1fBasicAttackDamage(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): number {
  const combatant = getCombatant(state, combatantId)
  return (
    combatant.temporaryResources.find((resource) => resource.key === PV1F_BASIC_ATTACK_DAMAGE_KEY)
      ?.current ?? 16
  )
}

export function preparePv1fTurnEconomy(
  state: StatDrivenCombatEncounterState,
): StatDrivenCombatEncounterState {
  const battle = state.tactical.battle
  const turn = battle.currentTurn
  if (battle.lifecycle !== 'active' || !turn) return state

  const actor = getCombatant(state, turn.combatantId)
  const marker = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_TURN_KEY,
  )
  const economy = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )
  if (marker?.current === battle.turnNumber && economy) return state

  const resources = replaceResources(actor.temporaryResources, [
    {
      key: PV1F_ACTION_ECONOMY_RESOURCE_KEY,
      current: PV1F_ACTION_ECONOMY_MAXIMUM,
      maximum: PV1F_ACTION_ECONOMY_MAXIMUM,
    },
    {
      key: PV1F_ACTION_ECONOMY_TURN_KEY,
      current: battle.turnNumber,
      maximum: Number.MAX_SAFE_INTEGER,
    },
  ])

  return withCombatantAndTurn(
    state,
    { ...actor, temporaryResources: resources },
    {
      ...turn,
      actionState: 'ready',
    },
  )
}

export function pv1fActionCost(actionId: string): number {
  if (actionId === PV1F_BASIC_ATTACK_ID) return PV1F_BASIC_ATTACK_COST
  if (actionId === PV1F_GUARD_ACTION_ID) return PV1F_GUARD_COST
  if (actionId === PV1F_RECOVER_ACTION_ID) return PV1F_RECOVER_COST
  throw new Error(`No PV-1F Action Economy cost is registered for ${actionId}.`)
}

export function canAffordPv1fEconomy(state: StatDrivenCombatEncounterState, cost: number): boolean {
  const economy = readPv1fActionEconomy(preparePv1fTurnEconomy(state))
  return Boolean(economy && economy.current >= cost)
}

export function spendPv1fActionEconomy(
  state: StatDrivenCombatEncounterState,
  cost: number,
): StatDrivenCombatEncounterState {
  if (!Number.isSafeInteger(cost) || cost < 0 || cost > PV1F_ACTION_ECONOMY_MAXIMUM) {
    throw new RangeError('Action Economy cost must be a safe integer from 0 to 100.')
  }

  const prepared = preparePv1fTurnEconomy(state)
  const battle = prepared.tactical.battle
  const turn = battle.currentTurn
  if (battle.lifecycle !== 'active' || !turn)
    throw new Error('Action Economy requires an active turn.')
  const actor = getCombatant(prepared, turn.combatantId)
  const economy = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )
  if (!economy || economy.current < cost) {
    throw new Error('Not enough Action Economy remains for that command.')
  }

  return replaceCombatantTemporaryResource(prepared, actor.id, {
    ...economy,
    current: economy.current - cost,
  })
}

export function pv1fMovementCost(terrainCost: number): number {
  if (!Number.isSafeInteger(terrainCost) || terrainCost < 0) {
    throw new RangeError('Terrain movement cost must be a non-negative safe integer.')
  }
  return terrainCost * PV1F_MOVEMENT_COST_PER_TERRAIN_POINT
}

export function previewPv1fMovement(
  state: StatDrivenCombatEncounterState,
  path: readonly GridPosition[],
): { evaluation: ReturnType<typeof evaluateCurrentMovementPath>; cost: number; affordable: boolean } {
  const prepared = preparePv1fTurnEconomy(state)
  const evaluation = evaluateCurrentMovementPath(prepared.tactical, path)
  const cost = evaluation.ok ? pv1fMovementCost(evaluation.terrainCost) : 0
  return { evaluation, cost, affordable: evaluation.ok && canAffordPv1fEconomy(prepared, cost) }
}

export function executePv1fMovement(
  state: StatDrivenCombatEncounterState,
  path: readonly GridPosition[],
): Pv1fTransition {
  const prepared = preparePv1fTurnEconomy(state)
  const preview = previewPv1fMovement(prepared, path)
  if (!preview.evaluation.ok) throw new Error(preview.evaluation.reason)
  if (!preview.affordable) throw new Error('Not enough Action Economy remains for that movement.')
  const moved = moveCurrentCombatant(prepared.tactical, path)
  return {
    state: spendPv1fActionEconomy({ ...prepared, tactical: moved.state }, preview.cost),
    events: moved.events,
  }
}

export function previewPv1fAction(
  state: StatDrivenCombatEncounterState,
  action: CombatActionDefinition,
  selection: CombatTargetSelection,
  content: CombatContentCatalog = PV1F_COMBAT_CONTENT,
): { evaluation: CombatActionEvaluation; cost: number; affordable: boolean } {
  const prepared = preparePv1fTurnEconomy(state)
  const cost = pv1fActionCost(action.id)
  const evaluation = evaluateCombatAction(prepared.tactical, action, selection, content)
  return { evaluation, cost, affordable: evaluation.ok && canAffordPv1fEconomy(prepared, cost) }
}

export function executePv1fAction(
  state: StatDrivenCombatEncounterState,
  action: CombatActionDefinition,
  selection: CombatTargetSelection,
  content: CombatContentCatalog = PV1F_COMBAT_CONTENT,
): Pv1fTransition {
  const prepared = preparePv1fTurnEconomy(state)
  const preview = previewPv1fAction(prepared, action, selection, content)
  if (!preview.evaluation.ok) throw new Error(preview.evaluation.reasons[0] ?? 'Action is not legal.')
  if (!preview.affordable) throw new Error('Not enough Action Economy remains for that action.')
  const executed = executeCombatAction(prepared.tactical, action, selection, content)
  return {
    state: spendPv1fActionEconomy({ ...prepared, tactical: executed.state }, preview.cost),
    events: executed.events,
  }
}

export function executePv1fStatDrivenAttack(input: {
  state: StatDrivenCombatEncounterState
  targetCombatantId: string
  expectedTurnToken: string
  expectedRound: number
  expectedTurnNumber: number
  idempotencyKey: string
  correlationId: string
}): { state: StatDrivenCombatEncounterState; result: ReturnType<typeof executeStatDrivenAttack>['result'] } {
  const prepared = preparePv1fTurnEconomy(input.state)
  if (!canAffordPv1fEconomy(prepared, PV1F_BASIC_ATTACK_COST)) {
    throw new Error('Not enough Action Economy remains for Basic Attack.')
  }

  const result = executeStatDrivenAttack({ ...input, state: prepared })
  return {
    state: spendPv1fActionEconomy(result.state, PV1F_BASIC_ATTACK_COST),
    result: result.result,
  }
}

export function executePv1fEndTurn(
  state: StatDrivenCombatEncounterState,
  finalFacing?: BattleFacing | null,
): Pv1fTransition {
  const prepared = preparePv1fTurnEconomy(state)
  const withFacing = finalFacing
    ? { ...prepared, tactical: selectCurrentFinalFacing(prepared.tactical, finalFacing).state }
    : prepared
  const ended = endCombatTurn(withFacing.tactical)
  const next = preparePv1fTurnEconomy({ ...withFacing, tactical: ended.state })
  return { state: next, events: ended.events }
}

export function createPv1fStatDrivenEncounter(input: {
  battleId: string
  player: BattleCombatant
  opponent: BattleCombatant
  playerBasicAttackDamage: number
  opponentBasicAttackDamage: number
  board: Parameters<typeof createCombatEncounterState>[0]['board']
  currentTurn: Parameters<typeof createCombatEncounterState>[0]['currentTurn']
}): StatDrivenCombatEncounterState {
  const player = {
    ...input.player,
    temporaryResources: createPv1fTemporaryResources(input.playerBasicAttackDamage),
  }
  const opponent = {
    ...input.opponent,
    temporaryResources: createPv1fTemporaryResources(input.opponentBasicAttackDamage),
  }
  return reattachStatDrivenCombatBridge({
    tactical: createCombatEncounterState({
      battleId: input.battleId,
      combatants: [player, opponent],
      board: input.board,
      currentTurn: input.currentTurn,
    }),
    statBridge: validateStatDrivenCombatEncounterState({
      tactical: createCombatEncounterState({
        battleId: input.battleId,
        combatants: [player, opponent],
        board: input.board,
        currentTurn: input.currentTurn,
      }),
      statBridge: {
        version: 1,
        combatants: [],
      },
    }).statBridge,
  })
}

function getCombatant(state: StatDrivenCombatEncounterState, id: string): BattleCombatant {
  const combatant = state.tactical.battle.combatants.find((candidate) => candidate.id === id)
  if (!combatant) throw new Error(`Combatant ${id} is unavailable.`)
  return combatant
}

function replaceCombatantTemporaryResource(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
  resource: BattleTemporaryResource,
): StatDrivenCombatEncounterState {
  const combatant = getCombatant(state, combatantId)
  return withCombatantAndTurn(state, {
    ...combatant,
    temporaryResources: replaceResources(combatant.temporaryResources, [resource]),
  })
}

function replaceResources(
  resources: readonly BattleTemporaryResource[],
  replacements: readonly BattleTemporaryResource[],
): readonly BattleTemporaryResource[] {
  const byKey = new Map(resources.map((resource) => [resource.key, resource]))
  for (const replacement of replacements) byKey.set(replacement.key, replacement)
  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key))
}

function withCombatantAndTurn(
  state: StatDrivenCombatEncounterState,
  combatant: BattleCombatant,
  currentTurn = state.tactical.battle.currentTurn,
): StatDrivenCombatEncounterState {
  return reattachStatDrivenCombatBridge({
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((candidate) =>
          candidate.id === combatant.id ? combatant : candidate,
        ),
        currentTurn,
      },
    },
  })
}
