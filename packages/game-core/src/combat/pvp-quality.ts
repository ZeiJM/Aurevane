import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatStatusDefinition,
  type CombatTargetSelection,
} from './actions'
import type { BattleCombatant, BattleTemporaryResource } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import {
  PV1F_COMBAT_CONTENT,
  canAffordPv1fEconomy,
  evaluatePv1fAction,
  executePv1fMovement,
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
  spendPv1fActionEconomy,
} from './pv1f-action-economy'
import {
  executeStatDrivenAttack,
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

export const PVP_MISSED_TURN_STREAK_KEY = 'pvp.missed-turn-streak' as const
export const PVP_LOWERED_GUARD_STATUS_ID = 'lowered-guard' as const

// Two stacks at 15,811 bp each produce 2.49987721x before integer damage rounding. That keeps the
// generic combat-content validator inside its existing 2x-per-stack safety bound while delivering
// the requested 2.5x total incoming-damage result to normal integer combat damage.
export const PVP_LOWERED_GUARD_STATUS: CombatStatusDefinition = {
  id: PVP_LOWERED_GUARD_STATUS_ID,
  version: 1,
  maximumStacks: 2,
  durationOwnerTurnStarts: 1_000,
  damageTakenMultiplierBasisPoints: 15_811,
}

export const PVP_COMBAT_CONTENT: CombatContentCatalog = {
  statuses: [...PV1F_COMBAT_CONTENT.statuses, PVP_LOWERED_GUARD_STATUS],
}

const APPLY_LOWERED_GUARD: CombatActionDefinition = {
  id: 'pvp.lowered-guard.apply',
  version: 1,
  sourceType: 'scenario',
  tags: ['pvp', 'afk', 'debuff'],
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
  cost: { spendsAction: false, mp: 0 },
  requirements: [],
  effects: [
    {
      type: 'apply-status',
      recipient: 'actor',
      statusId: PVP_LOWERED_GUARD_STATUS_ID,
      stacks: 2,
    },
  ],
}

export interface PvpQualityTransition {
  state: StatDrivenCombatEncounterState
  events: readonly unknown[]
}

export function createPvpQualityResources(): readonly BattleTemporaryResource[] {
  return [{ key: PVP_MISSED_TURN_STREAK_KEY, current: 0, maximum: 2 }]
}

export function isPvpQualityEncounter(state: StatDrivenCombatEncounterState): boolean {
  return state.tactical.battle.combatants.some((combatant) =>
    combatant.temporaryResources.some((resource) => resource.key === PVP_MISSED_TURN_STREAK_KEY),
  )
}

export function clearPvpAfkPenaltyForCurrentActor(
  state: StatDrivenCombatEncounterState,
): StatDrivenCombatEncounterState {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId || !isPvpQualityEncounter(state)) return state
  const actor = getCombatant(state, actorId)
  const streak = actor.temporaryResources.find(
    (resource) => resource.key === PVP_MISSED_TURN_STREAK_KEY,
  )
  const resources = streak
    ? replaceResources(actor.temporaryResources, [{ ...streak, current: 0 }])
    : actor.temporaryResources
  const nextActor = { ...actor, temporaryResources: resources }
  const statusState = state.statusState.map((row) =>
    row.combatantId === actorId
      ? {
          ...row,
          statuses: row.statuses.filter(
            (status) => status.statusId !== PVP_LOWERED_GUARD_STATUS_ID,
          ),
        }
      : row,
  )
  return rebuild(state, nextActor, statusState)
}

export function executePvpAction(
  state: StatDrivenCombatEncounterState,
  actionId: string,
  target: CombatTargetSelection,
): PvpQualityTransition {
  const active = clearPvpAfkPenaltyForCurrentActor(state)
  const { prepared, action, cost, evaluation } = evaluatePv1fAction(active, actionId, target)
  if (!evaluation.legal) {
    throw new Error(evaluation.issues[0]?.message ?? 'That PvP action is not legal.')
  }
  if (!canAffordPv1fEconomy(prepared, cost)) {
    throw new Error('Not enough Action Economy remains for that action.')
  }

  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('PvP action execution requires an active turn.')

  const transition =
    action.sourceType === 'basic-attack'
      ? executeStatDrivenAttack(prepared, action, target, PVP_COMBAT_CONTENT)
      : (() => {
          const resolved = executeCombatAction(prepared, action, target, PVP_COMBAT_CONTENT)
          return {
            state: reattachStatDrivenCombatBridge(resolved.state, prepared.statBridge),
            events: resolved.events,
          }
        })()

  const next = spendEconomyForActor(transition.state, actorId, cost)
  const remaining = readPv1fActionEconomy(next, actorId)?.current ?? 0
  return {
    state: next,
    events: [
      ...transition.events,
      { event: 'action_economy_spent', combatantId: actorId, amount: cost, remaining },
    ],
  }
}

export function executePvpMovement(
  state: StatDrivenCombatEncounterState,
  path: readonly { x: number; y: number }[],
): PvpQualityTransition {
  return executePv1fMovement(clearPvpAfkPenaltyForCurrentActor(state), path)
}

export function finishPvpTurn(
  state: StatDrivenCombatEncounterState,
  facing: 'north' | 'east' | 'south' | 'west',
  clearAfkPenalty = true,
): PvpQualityTransition {
  const active = clearAfkPenalty ? clearPvpAfkPenaltyForCurrentActor(state) : state
  const prepared = preparePv1fTurnEconomy(active)
  const selected = selectCurrentFinalFacing(prepared.tactical, facing)
  const encounter = reattachStatDrivenCombatBridge(
    createCombatEncounterState(selected.state, prepared.statusState),
    prepared.statBridge,
  )
  const ended = endCombatTurn(encounter, PVP_COMBAT_CONTENT)
  const bridged = reattachStatDrivenCombatBridge(ended.state, prepared.statBridge)
  return {
    state: preparePv1fTurnEconomy(bridged),
    events: [...selected.events, ...ended.events],
  }
}

export function timeoutPvpTurn(state: StatDrivenCombatEncounterState): PvpQualityTransition {
  const turn = state.tactical.battle.currentTurn
  if (state.tactical.battle.lifecycle !== 'active' || !turn) {
    throw new Error('PvP timeout requires an active turn.')
  }
  const actor = getCombatant(state, turn.combatantId)
  const streak = actor.temporaryResources.find(
    (resource) => resource.key === PVP_MISSED_TURN_STREAK_KEY,
  )
  if (!streak) throw new Error('PvP timeout tracking is unavailable for this combatant.')

  const nextStreak = Math.min(2, streak.current + 1)
  let nextState = rebuild(
    state,
    {
      ...actor,
      temporaryResources: replaceResources(actor.temporaryResources, [
        { ...streak, current: nextStreak },
      ]),
    },
    state.statusState,
  )
  const events: unknown[] = [
    {
      event: 'pvp_turn_timed_out',
      combatantId: actor.id,
      consecutiveMisses: nextStreak,
    },
  ]

  if (nextStreak >= 2) {
    const applied = executeCombatAction(
      nextState,
      APPLY_LOWERED_GUARD,
      { kind: 'self' },
      PVP_COMBAT_CONTENT,
    )
    nextState = reattachStatDrivenCombatBridge(applied.state, nextState.statBridge)
    events.push(...applied.events)
    events.push({
      event: 'pvp_lowered_guard_applied',
      combatantId: actor.id,
      damageTakenMultiplierBasisPoints: 25_000,
    })
  }

  const placement = nextState.tactical.placements.find(
    (candidate) => candidate.combatantId === actor.id,
  )
  if (!placement) throw new Error('The timed-out combatant has no tactical placement.')
  const ended = finishPvpTurn(nextState, placement.facing, false)
  return { state: ended.state, events: [...events, ...ended.events] }
}

export function surrenderPvpCombatant(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): PvpQualityTransition {
  if (state.tactical.battle.lifecycle !== 'active') {
    throw new Error('Only an active PvP combatant can surrender.')
  }
  const target = getCombatant(state, combatantId)
  if (target.hp <= 0) return { state, events: [] }

  let nextState = state
  const events: unknown[] = []
  if (state.tactical.battle.currentTurn?.combatantId === combatantId) {
    const placement = state.tactical.placements.find(
      (candidate) => candidate.combatantId === combatantId,
    )
    if (!placement) throw new Error('The surrendering combatant has no tactical placement.')
    const handedOff = finishPvpTurn(state, placement.facing, false)
    nextState = handedOff.state
    events.push(...handedOff.events)
  }

  const currentTarget = getCombatant(nextState, combatantId)
  nextState = rebuild(
    nextState,
    { ...currentTarget, hp: 0 },
    nextState.statusState,
  )
  events.push({ event: 'pvp_combatant_surrendered', combatantId })

  const livingTeams = new Set(
    nextState.tactical.battle.combatants
      .filter((combatant) => combatant.hp > 0)
      .map((combatant) => combatant.teamId),
  )
  if (livingTeams.size <= 1) {
    const winningTeamId = [...livingTeams][0] ?? null
    const battle = {
      ...nextState.tactical.battle,
      lifecycle: 'completed' as const,
      currentTurn: null,
    }
    const tactical = createTacticalBattleState({ ...nextState.tactical, battle })
    nextState = reattachStatDrivenCombatBridge(
      createCombatEncounterState(tactical, nextState.statusState),
      nextState.statBridge,
    )
    events.push({ event: 'battle_completed', winningTeamId })
  }

  assertValid(nextState)
  return { state: nextState, events }
}

function spendEconomyForActor(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
  cost: number,
): StatDrivenCombatEncounterState {
  if (state.tactical.battle.lifecycle === 'active') {
    return spendPv1fActionEconomy(state, cost)
  }
  if (state.tactical.battle.lifecycle !== 'completed') {
    throw new Error('Action Economy cannot be spent after that battle transition.')
  }
  const actor = getCombatant(state, combatantId)
  const economy = actor.temporaryResources.find((resource) => resource.key === 'pv1f.action-economy')
  if (!economy || economy.current < cost) {
    throw new Error('Not enough Action Economy remains for that command.')
  }
  return rebuild(
    state,
    {
      ...actor,
      temporaryResources: replaceResources(actor.temporaryResources, [
        { ...economy, current: economy.current - cost },
      ]),
    },
    state.statusState,
  )
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
  const keys = new Set(replacements.map((resource) => resource.key))
  return [
    ...current.filter((resource) => !keys.has(resource.key)).map((resource) => ({ ...resource })),
    ...replacements.map((resource) => ({ ...resource })),
  ].sort((left, right) => left.key.localeCompare(right.key))
}

function rebuild(
  state: StatDrivenCombatEncounterState,
  combatant: BattleCombatant,
  statusState: StatDrivenCombatEncounterState['statusState'],
): StatDrivenCombatEncounterState {
  const battle = {
    ...state.tactical.battle,
    combatants: state.tactical.battle.combatants.map((candidate) =>
      candidate.id === combatant.id ? combatant : candidate,
    ),
  }
  const tactical = createTacticalBattleState({ ...state.tactical, battle })
  const encounter = createCombatEncounterState(tactical, statusState)
  const next = reattachStatDrivenCombatBridge(encounter, state.statBridge)
  assertValid(next)
  return next
}

function assertValid(state: StatDrivenCombatEncounterState): void {
  const issues = validateStatDrivenCombatEncounterState(state)
  if (issues.length > 0) {
    throw new Error(`Invalid PvP quality state: ${issues[0]?.field}: ${issues[0]?.message}`)
  }
}
