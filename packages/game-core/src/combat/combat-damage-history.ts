import type { CombatEncounterState } from './actions'
import { normalizeCombatEffectState, type DamageProvenance } from './combat-effect-state'

const DAMAGE_HISTORY_WINDOW_ROUNDS = 3

export interface RecordCombatDamageHistoryInput {
  targetCombatantId: string
  amount: number
  provenance: DamageProvenance
}

export function recordCombatDamageHistory(
  state: CombatEncounterState,
  input: RecordCombatDamageHistoryInput,
): CombatEncounterState {
  assertActualDamage(input.amount)
  const target = combatantById(state, input.targetCombatantId, 'damage-history target')

  if (input.amount === 0 || !qualifiesForDamageHistory(state, target.teamId, input)) {
    return state
  }

  const effectState = normalizeCombatEffectState(state.effectState)
  const round = activeRound(state)
  const minimumRound = Math.max(1, round - (DAMAGE_HISTORY_WINDOW_ROUNDS - 1))
  const damageHistory = effectState.damageHistory
    .filter((entry) => entry.round >= minimumRound && entry.round <= round)
    .map((entry) => ({ ...entry }))

  const existingIndex = damageHistory.findIndex(
    (entry) => entry.combatantId === input.targetCombatantId && entry.round === round,
  )
  if (existingIndex >= 0) {
    const existing = damageHistory[existingIndex]
    const amount = existing.amount + input.amount
    if (!Number.isSafeInteger(amount)) {
      throw new RangeError('Combat damage-history amount exceeds the safe integer limit.')
    }
    damageHistory[existingIndex] = { ...existing, amount }
  } else {
    damageHistory.push({ combatantId: input.targetCombatantId, round, amount: input.amount })
  }

  damageHistory.sort((left, right) => {
    const combatant = left.combatantId.localeCompare(right.combatantId)
    return combatant !== 0 ? combatant : left.round - right.round
  })

  return {
    ...state,
    effectState: {
      ...effectState,
      damageHistory,
    },
  }
}

export function recentCombatDamageSuffered(
  state: CombatEncounterState,
  combatantId: string,
): number {
  combatantById(state, combatantId, 'damage-history combatant')
  const round = activeRound(state)
  const minimumRound = Math.max(1, round - (DAMAGE_HISTORY_WINDOW_ROUNDS - 1))
  const history = normalizeCombatEffectState(state.effectState).damageHistory
  let total = 0

  for (const entry of history) {
    if (entry.combatantId !== combatantId || entry.round < minimumRound || entry.round > round) {
      continue
    }
    total += entry.amount
    if (!Number.isSafeInteger(total)) {
      throw new RangeError('Recent combat damage exceeds the safe integer limit.')
    }
  }

  return total
}

function qualifiesForDamageHistory(
  state: CombatEncounterState,
  targetTeamId: string,
  input: RecordCombatDamageHistoryInput,
): boolean {
  if (input.provenance.kind !== 'direct-hostile' && input.provenance.kind !== 'periodic-hostile') {
    return false
  }

  const sourceId = input.provenance.sourceCombatantId
  if (sourceId === null || sourceId === input.targetCombatantId) return false
  const source = combatantById(state, sourceId, 'damage-history source')
  return source.teamId !== targetTeamId
}

function combatantById(
  state: CombatEncounterState,
  combatantId: string,
  label: string,
): CombatEncounterState['tactical']['battle']['combatants'][number] {
  const combatant = state.tactical.battle.combatants.find(
    (candidate) => candidate.id === combatantId,
  )
  if (!combatant) throw new Error(`Unknown ${label} ${combatantId}.`)
  return combatant
}

function activeRound(state: CombatEncounterState): number {
  const round = state.tactical.battle.round
  if (!Number.isSafeInteger(round) || round < 1) {
    throw new RangeError('Combat damage history requires an active positive battle round.')
  }
  return round
}

function assertActualDamage(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError('Combat damage-history amount must be a non-negative safe integer.')
  }
}
