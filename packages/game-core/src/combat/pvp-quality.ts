import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
} from './actions'
import type { BattleCombatant, BattleTemporaryResource } from './battle-state'
import { createTacticalBattleState } from './board'
import { PV1F_COMBAT_CONTENT, finishPv1fTurn } from './pv1f-action-economy'
import {
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

export const PVP_MISSED_TURN_STREAK_KEY = 'pvp.missed-turn-streak' as const
export const AI_MISSED_TURN_STREAK_KEY = 'ai.missed-turn-streak' as const
export const PVP_LOWERED_GUARD_STATUS_ID = 'lowered-guard' as const

const APPLY_LOWERED_GUARD: CombatActionDefinition = {
  id: 'battle.lowered-guard.apply',
  version: 1,
  sourceType: 'scenario',
  tags: ['afk', 'debuff'],
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
      stacks: 1,
    },
  ],
}

export interface PvpQualityTransition {
  state: StatDrivenCombatEncounterState
  events: readonly unknown[]
}

export function createPvpQualityResources(): readonly BattleTemporaryResource[] {
  return createMissedTurnResources(PVP_MISSED_TURN_STREAK_KEY)
}

export function createAiQualityResources(): readonly BattleTemporaryResource[] {
  return createMissedTurnResources(AI_MISSED_TURN_STREAK_KEY)
}

export function prepareAiQualityCombatant(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): StatDrivenCombatEncounterState {
  const combatant = getCombatant(state, combatantId)
  if (combatant.temporaryResources.some((resource) => resource.key === AI_MISSED_TURN_STREAK_KEY)) {
    return state
  }
  return rebuildCombatant(state, {
    ...combatant,
    temporaryResources: replaceResources(combatant.temporaryResources, createAiQualityResources()),
  })
}

export function timeoutPvpTurn(state: StatDrivenCombatEncounterState): PvpQualityTransition {
  return timeoutTrackedTurn(state, {
    streakKey: PVP_MISSED_TURN_STREAK_KEY,
    timeoutEvent: 'pvp_turn_timed_out',
    loweredGuardEvent: 'pvp_lowered_guard_applied',
    label: 'PvP',
    loweredGuardEveryTimeout: true,
    loweredGuardDurationOwnerTurnStarts: 1,
  })
}

export function timeoutAiTurn(state: StatDrivenCombatEncounterState): PvpQualityTransition {
  return timeoutTrackedTurn(state, {
    streakKey: AI_MISSED_TURN_STREAK_KEY,
    timeoutEvent: 'ai_turn_timed_out',
    loweredGuardEvent: 'ai_lowered_guard_applied',
    label: 'AI battle',
    loweredGuardEveryTimeout: false,
    loweredGuardDurationOwnerTurnStarts: null,
  })
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
    const handedOff = finishPv1fTurn(state, placement.facing)
    nextState = handedOff.state
    events.push(...handedOff.events)
  }

  const currentTarget = getCombatant(nextState, combatantId)
  nextState = rebuildCombatant(nextState, { ...currentTarget, hp: 0 })
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

export function resetPvpMissedTurnStreak(
  state: StatDrivenCombatEncounterState,
): StatDrivenCombatEncounterState {
  return resetMissedTurnStreak(state, PVP_MISSED_TURN_STREAK_KEY)
}

export function resetAiMissedTurnStreak(
  state: StatDrivenCombatEncounterState,
): StatDrivenCombatEncounterState {
  return resetMissedTurnStreak(state, AI_MISSED_TURN_STREAK_KEY)
}

export function isPvpQualityEncounter(state: StatDrivenCombatEncounterState): boolean {
  return hasQualityResource(state, PVP_MISSED_TURN_STREAK_KEY)
}

export function isAiQualityEncounter(state: StatDrivenCombatEncounterState): boolean {
  return hasQualityResource(state, AI_MISSED_TURN_STREAK_KEY)
}

function createMissedTurnResources(key: string): readonly BattleTemporaryResource[] {
  return [{ key, current: 0, maximum: 2 }]
}

function timeoutTrackedTurn(
  state: StatDrivenCombatEncounterState,
  options: {
    streakKey: string
    timeoutEvent: string
    loweredGuardEvent: string
    label: string
    loweredGuardEveryTimeout: boolean
    loweredGuardDurationOwnerTurnStarts: number | null
  },
): PvpQualityTransition {
  const turn = state.tactical.battle.currentTurn
  if (state.tactical.battle.lifecycle !== 'active' || !turn) {
    throw new Error(`${options.label} timeout requires an active turn.`)
  }

  const actor = getCombatant(state, turn.combatantId)
  const streak = actor.temporaryResources.find((resource) => resource.key === options.streakKey)
  if (!streak) {
    throw new Error(`${options.label} timeout tracking is unavailable for this combatant.`)
  }

  const nextStreak = Math.min(2, streak.current + 1)
  let nextState = rebuildCombatant(state, {
    ...actor,
    temporaryResources: replaceResources(actor.temporaryResources, [
      { ...streak, current: nextStreak },
    ]),
  })
  const events: unknown[] = [
    {
      event: options.timeoutEvent,
      combatantId: actor.id,
      consecutiveMisses: nextStreak,
    },
  ]

  if (options.loweredGuardEveryTimeout || nextStreak >= 2) {
    const applied = executeCombatAction(
      nextState,
      APPLY_LOWERED_GUARD,
      { kind: 'self' },
      PV1F_COMBAT_CONTENT,
    )
    nextState = reattachStatDrivenCombatBridge(applied.state, nextState.statBridge)
    if (options.loweredGuardDurationOwnerTurnStarts !== null) {
      nextState = setStatusRemainingOwnerTurnStarts(
        nextState,
        actor.id,
        PVP_LOWERED_GUARD_STATUS_ID,
        options.loweredGuardDurationOwnerTurnStarts,
      )
    }
    events.push(...applied.events)
    events.push({
      event: options.loweredGuardEvent,
      combatantId: actor.id,
      damageTakenMultiplierBasisPoints: 25_000,
    })
  }

  const placement = nextState.tactical.placements.find(
    (candidate) => candidate.combatantId === actor.id,
  )
  if (!placement) throw new Error('The timed-out combatant has no tactical placement.')

  const ended = finishPv1fTurn(nextState, placement.facing)
  return {
    state: ended.state,
    events: [...events, ...ended.events],
  }
}

function setStatusRemainingOwnerTurnStarts(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
  statusId: string,
  remainingOwnerTurnStarts: number,
): StatDrivenCombatEncounterState {
  const statusState = state.statusState.map((row) =>
    row.combatantId === combatantId
      ? {
          ...row,
          statuses: row.statuses.map((status) =>
            status.statusId === statusId ? { ...status, remainingOwnerTurnStarts } : status,
          ),
        }
      : row,
  )
  const next = { ...state, statusState }
  assertValid(next)
  return next
}

function resetMissedTurnStreak(
  state: StatDrivenCombatEncounterState,
  streakKey: string,
): StatDrivenCombatEncounterState {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) return state
  const actor = getCombatant(state, actorId)
  const streak = actor.temporaryResources.find((resource) => resource.key === streakKey)
  if (!streak || streak.current === 0) return state
  return rebuildCombatant(state, {
    ...actor,
    temporaryResources: replaceResources(actor.temporaryResources, [{ ...streak, current: 0 }]),
  })
}

function hasQualityResource(state: StatDrivenCombatEncounterState, key: string): boolean {
  return state.tactical.battle.combatants.some((combatant) =>
    combatant.temporaryResources.some((resource) => resource.key === key),
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
  const replacementKeys = new Set(replacements.map((resource) => resource.key))
  return [
    ...current
      .filter((resource) => !replacementKeys.has(resource.key))
      .map((resource) => ({ ...resource })),
    ...replacements.map((resource) => ({ ...resource })),
  ].sort((left, right) => left.key.localeCompare(right.key))
}

function rebuildCombatant(
  state: StatDrivenCombatEncounterState,
  combatant: BattleCombatant,
): StatDrivenCombatEncounterState {
  const battle = {
    ...state.tactical.battle,
    combatants: state.tactical.battle.combatants.map((candidate) =>
      candidate.id === combatant.id ? combatant : candidate,
    ),
  }
  const tactical = createTacticalBattleState({ ...state.tactical, battle })
  const encounter = createCombatEncounterState(tactical, state.statusState)
  const next = reattachStatDrivenCombatBridge(encounter, state.statBridge)
  assertValid(next)
  return next
}

function assertValid(state: StatDrivenCombatEncounterState): void {
  const issues = validateStatDrivenCombatEncounterState(state)
  if (issues.length > 0) {
    throw new Error(`Invalid battle quality state: ${issues[0]?.field}: ${issues[0]?.message}`)
  }
}
