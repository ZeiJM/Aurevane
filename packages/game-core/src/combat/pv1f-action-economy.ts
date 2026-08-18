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
export const PV1F_MOVEMENT_COST_PER_TERRAIN_POINT = 10 as const
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

export const PV1F_GUARD_ACTION: CombatActionDefinition = {
  id: PV1F_GUARD_ACTION_ID,
  version: 1,
  sourceType: 'basic-action',
  tags: ['basic', 'defensive', 'buff'],
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
  requirements: [{ kind: 'actor-status-absent', statusId: 'guarded' }],
  effects: [{ type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 }],
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

  const remaining = economy.current - cost
  const resources = replaceResources(actor.temporaryResources, [{ ...economy, current: remaining }])
  return withCombatantAndTurn(
    prepared,
    { ...actor, temporaryResources: resources },
    {
      ...turn,
      actionState:
        remaining >= Math.min(PV1F_BASIC_ATTACK_COST, PV1F_GUARD_COST) ? 'ready' : 'spent',
    },
  )
}

export function evaluatePv1fAction(
  state: StatDrivenCombatEncounterState,
  actionId: string,
  target: CombatTargetSelection,
): {
  prepared: StatDrivenCombatEncounterState
  action: CombatActionDefinition
  cost: number
  evaluation: CombatActionEvaluation
} {
  const prepared = preparePv1fTurnEconomy(state)
  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('PV-1F action evaluation requires an active turn.')
  const action = resolvePv1fActionDefinition(prepared, actorId, actionId)
  const cost = pv1fActionCost(action.id)
  const evaluation = evaluateCombatAction(prepared, action, target, PV1F_COMBAT_CONTENT)
  return { prepared, action, cost, evaluation }
}

export function executePv1fAction(
  state: StatDrivenCombatEncounterState,
  actionId: string,
  target: CombatTargetSelection,
): Pv1fTransition {
  const { prepared, action, cost } = evaluatePv1fAction(state, actionId, target)
  if (!canAffordPv1fEconomy(prepared, cost)) {
    throw new Error('Not enough Action Economy remains for that action.')
  }

  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('PV-1F action execution requires an active turn.')
  const transition =
    action.sourceType === 'basic-attack'
      ? executeStatDrivenAttack(prepared, action, target, PV1F_COMBAT_CONTENT)
      : (() => {
          const resolved = executeCombatAction(prepared, action, target, PV1F_COMBAT_CONTENT)
          return {
            state: reattachStatDrivenCombatBridge(resolved.state, prepared.statBridge),
            events: resolved.events,
          }
        })()
  const next = spendPv1fActionEconomy(transition.state, cost)
  const remaining = readPv1fActionEconomy(next, actorId)?.current ?? 0
  return {
    state: next,
    events: [
      ...transition.events,
      { event: 'action_economy_spent', combatantId: actorId, amount: cost, remaining },
    ],
  }
}

export function evaluatePv1fMovement(
  state: StatDrivenCombatEncounterState,
  path: readonly GridPosition[],
) {
  const prepared = preparePv1fTurnEconomy(state)
  const movement = evaluateCurrentMovementPath(prepared.tactical, path)
  const economyCost = movement.cost * PV1F_MOVEMENT_COST_PER_TERRAIN_POINT
  return { prepared, movement, economyCost }
}

export function executePv1fMovement(
  state: StatDrivenCombatEncounterState,
  path: readonly GridPosition[],
): Pv1fTransition {
  const { prepared, movement, economyCost } = evaluatePv1fMovement(state, path)
  if (!movement.legal)
    throw new Error(movement.issues[0]?.message ?? 'That movement path is not legal.')
  if (!canAffordPv1fEconomy(prepared, economyCost)) {
    throw new Error('Not enough Action Economy remains for that movement path.')
  }
  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('PV-1F movement requires an active turn.')
  const moved = moveCurrentCombatant(prepared.tactical, path)
  const encounter = reattachStatDrivenCombatBridge(
    createCombatEncounterState(moved.state, prepared.statusState),
    prepared.statBridge,
  )
  const next = spendPv1fActionEconomy(encounter, economyCost)
  const remaining = readPv1fActionEconomy(next, actorId)?.current ?? 0
  return {
    state: next,
    events: [
      ...moved.events,
      { event: 'action_economy_spent', combatantId: actorId, amount: economyCost, remaining },
    ],
  }
}

export function finishPv1fTurn(
  state: StatDrivenCombatEncounterState,
  facing: BattleFacing,
): Pv1fTransition {
  const prepared = preparePv1fTurnEconomy(state)
  const selected = selectCurrentFinalFacing(prepared.tactical, facing)
  const encounter = reattachStatDrivenCombatBridge(
    createCombatEncounterState(selected.state, prepared.statusState),
    prepared.statBridge,
  )
  const ended = endCombatTurn(encounter, PV1F_COMBAT_CONTENT)
  const bridged = reattachStatDrivenCombatBridge(ended.state, prepared.statBridge)
  return {
    state: preparePv1fTurnEconomy(bridged),
    events: [...selected.events, ...ended.events],
  }
}

export function resolvePv1fActionDefinition(
  state: StatDrivenCombatEncounterState,
  actorId: string,
  actionId: string,
): CombatActionDefinition {
  const actor = getCombatant(state, actorId)
  if (actionId === PV1F_BASIC_ATTACK_ID) {
    return createPv1fBasicAttackDefinition(readPv1fBasicAttackDamage(state, actorId))
  }
  if (actionId === PV1F_GUARD_ACTION_ID) return PV1F_GUARD_ACTION
  if (actionId === PV1F_RECOVER_ACTION_ID) return createPv1fRecoverAction(actor.maxHp)
  throw new Error(`Unsupported PV-1F action ${actionId}.`)
}

function getCombatant(state: StatDrivenCombatEncounterState, combatantId: string): BattleCombatant {
  const combatant = state.tactical.battle.combatants.find(
    (candidate) => candidate.id === combatantId,
  )
  if (!combatant) throw new Error(`Unknown combatant ${combatantId}.`)
  return combatant
}

function replaceResources(
  current: readonly BattleTemporaryResource[],
  replacements: readonly BattleTemporaryResource[],
): readonly BattleTemporaryResource[] {
  const replacementKeys = new Set(replacements.map((resource) => resource.key))
  return [
    ...current
      .filter((resource) => !replacementKeys.has(resource.key))
      .map((resource) => ({ ...resource })),
    ...replacements.map((resource) => ({ ...resource })),
  ].sort((left, right) => left.key.localeCompare(right.key))
}

function withCombatantAndTurn(
  state: StatDrivenCombatEncounterState,
  combatant: BattleCombatant,
  currentTurn: NonNullable<StatDrivenCombatEncounterState['tactical']['battle']['currentTurn']>,
): StatDrivenCombatEncounterState {
  const next: StatDrivenCombatEncounterState = {
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
  }
  const issues = validateStatDrivenCombatEncounterState(next)
  if (issues.length > 0) {
    throw new Error(`Invalid PV-1F combat state: ${issues[0]?.field}: ${issues[0]?.message}`)
  }
  return next
}
