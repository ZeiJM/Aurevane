import type { CombatEncounterState, CombatResolutionEvent } from './actions-legacy'
import { normalizeCombatEffectState } from './combat-effect-state'

export interface CombatDamageHistoryOptions {
  round: number
  commandSourceCombatantId?: string
}

/**
 * Records qualifying committed HP loss without participating in damage resolution.
 *
 * The caller supplies the pre-resolution round so end-of-turn damage remains attributed to the
 * round in which it was committed even when initiative advancement crosses a round boundary.
 * Command callers may pin the acting combatant so future reactive damage events cannot be
 * mistaken for direct command damage.
 */
export function recordCommittedDamageHistory(
  state: CombatEncounterState,
  events: readonly CombatResolutionEvent[],
  options: CombatDamageHistoryOptions,
): CombatEncounterState {
  const qualifyingByTarget = new Map<string, number>()
  const targetOrder: string[] = []

  for (const event of events) {
    if (event.event !== 'damage_applied' || event.amount <= 0) continue
    if (
      options.commandSourceCombatantId !== undefined &&
      event.sourceCombatantId !== options.commandSourceCombatantId
    ) {
      continue
    }

    const source = state.tactical.battle.combatants.find(
      (combatant) => combatant.id === event.sourceCombatantId,
    )
    const target = state.tactical.battle.combatants.find(
      (combatant) => combatant.id === event.targetCombatantId,
    )
    if (!source || !target || source.teamId === target.teamId) continue

    if (!qualifyingByTarget.has(target.id)) targetOrder.push(target.id)
    qualifyingByTarget.set(target.id, (qualifyingByTarget.get(target.id) ?? 0) + event.amount)
  }

  if (qualifyingByTarget.size === 0) return state

  const effectState = normalizeCombatEffectState(state.effectState)
  const minimumRound = options.round - 2
  const damageHistory = effectState.damageHistory
    .filter((entry) => entry.round >= minimumRound)
    .map((entry) => ({ ...entry }))

  for (const targetCombatantId of targetOrder) {
    const amount = qualifyingByTarget.get(targetCombatantId)
    if (amount === undefined) continue

    const existingIndex = damageHistory.findIndex(
      (entry) => entry.combatantId === targetCombatantId && entry.round === options.round,
    )
    if (existingIndex >= 0) {
      const existing = damageHistory[existingIndex]
      if (!existing) continue
      const combinedAmount = existing.amount + amount
      if (!Number.isSafeInteger(combinedAmount)) {
        throw new RangeError('Combat damage-history amount must remain a safe integer.')
      }
      damageHistory[existingIndex] = { ...existing, amount: combinedAmount }
      continue
    }

    damageHistory.push({ combatantId: targetCombatantId, round: options.round, amount })
  }

  return {
    ...state,
    effectState: {
      ...effectState,
      damageHistory,
    },
  }
}
