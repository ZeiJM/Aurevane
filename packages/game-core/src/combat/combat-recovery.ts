import type { CombatEffectDefinition, CombatEncounterIssue, CombatEncounterState } from './actions'
import { normalizeCombatEffectState, type CombatOngoingRecovery } from './combat-effect-state'

/** Shared by the live combat boundary and Master Panel validation. */
export function validateRecoveryEffect(effect: CombatEffectDefinition): void {
  if (effect.type !== 'healing' && effect.type !== 'resource-change') return
  const ticks = effect.ticks
  if (ticks === undefined) return // Immutable historical single-application effects.
  if (effect.type === 'resource-change' && effect.delta < 0 && ticks !== 1) {
    throw new RangeError('MP Drain is immediate-only and must use one tick.')
  }
  if (!Number.isSafeInteger(ticks) || ticks < 1 || ticks > 4) {
    throw new RangeError(
      `${effect.type === 'healing' ? 'Healing' : 'MP recovery'} ticks must be an integer between 1 and 4.`,
    )
  }
}

function recoveryKey(row: CombatOngoingRecovery): string {
  return JSON.stringify([row.targetCombatantId, row.kind, row.sourceActionId])
}

/** Replace the same recipient/resource/action schedule; different actions coexist. */
export function replaceRecoverySchedule(
  state: CombatEncounterState,
  recovery: CombatOngoingRecovery,
): CombatEncounterState {
  const effects = normalizeCombatEffectState(state.effectState)
  const key = recoveryKey(recovery)
  const remaining = effects.ongoingRecovery.filter((row) => recoveryKey(row) !== key)
  const alive = state.tactical.battle.combatants.some(
    (row) => row.id === recovery.targetCombatantId && row.hp > 0,
  )
  if (alive && recovery.remainingFutureTicks > 0) remaining.push({ ...recovery })
  else if (remaining.length === effects.ongoingRecovery.length) return state
  return {
    ...state,
    effectState: {
      ...effects,
      ongoingRecovery: remaining.sort((a, b) =>
        recoveryKey(a) < recoveryKey(b) ? -1 : recoveryKey(a) > recoveryKey(b) ? 1 : 0,
      ),
    },
  }
}

/** Defeat removes future recovery, never banking it for a later revival. */
export function clearDefeatedRecovery(state: CombatEncounterState): CombatEncounterState {
  if (!state.effectState) return state
  const alive = new Set(
    state.tactical.battle.combatants.filter((row) => row.hp > 0).map((row) => row.id),
  )
  const ongoingRecovery = state.effectState.ongoingRecovery.filter(
    (row) => state.tactical.battle.lifecycle === 'active' && alive.has(row.targetCombatantId),
  )
  if (ongoingRecovery.length === state.effectState.ongoingRecovery.length) return state
  return { ...state, effectState: { ...state.effectState, ongoingRecovery } }
}

export function validateOngoingRecoveryState(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  const effects = state.effectState
  if (effects === undefined) return []
  const invalid = [
    {
      field: 'effectState.ongoingRecovery',
      message:
        'Recovery schedules must have valid identities, safe amounts, one to three future ticks, and unique recipient/resource/action keys.',
    },
  ]
  if (
    !effects ||
    typeof effects !== 'object' ||
    Array.isArray(effects) ||
    !Array.isArray(effects.ongoingRecovery) ||
    effects.ongoingRecovery.length > state.tactical.battle.combatants.length * 256
  )
    return invalid
  const ids = new Set(state.tactical.battle.combatants.map((row) => row.id))
  const seen = new Set<string>()
  for (const row of effects.ongoingRecovery) {
    if (
      !row ||
      !['hp', 'mp'].includes(row.kind) ||
      !ids.has(row.sourceCombatantId) ||
      !ids.has(row.targetCombatantId) ||
      typeof row.sourceActionId !== 'string' ||
      !row.sourceActionId ||
      row.sourceActionId.trim() !== row.sourceActionId ||
      !Number.isSafeInteger(row.amountPerTick) ||
      row.amountPerTick < 0 ||
      !Number.isSafeInteger(row.remainingFutureTicks) ||
      row.remainingFutureTicks < 1 ||
      row.remainingFutureTicks > 3
    )
      return invalid
    const key = recoveryKey(row)
    if (seen.has(key)) return invalid
    seen.add(key)
  }
  return []
}
