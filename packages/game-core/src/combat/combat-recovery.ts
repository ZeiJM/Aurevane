import type { CombatEffectDefinition, CombatEncounterIssue, CombatEncounterState } from './actions'
import { normalizeCombatEffectState, type CombatOngoingRecovery } from './combat-effect-state'
import { usesUnboundedEffectApplications } from './effect-application-rules'

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

function recoveryBaseKey(row: CombatOngoingRecovery): string {
  return JSON.stringify([row.targetCombatantId, row.kind, row.sourceActionId])
}

function recoveryOrder(row: CombatOngoingRecovery): number {
  return row.applicationOrder ?? 0
}

function compareRecovery(left: CombatOngoingRecovery, right: CombatOngoingRecovery): number {
  const leftKey = recoveryBaseKey(left)
  const rightKey = recoveryBaseKey(right)
  return leftKey < rightKey
    ? -1
    : leftKey > rightKey
      ? 1
      : recoveryOrder(left) - recoveryOrder(right)
}

function nextRecoveryOrder(rows: readonly CombatOngoingRecovery[]): number {
  const maximum = rows.reduce((value, row) => Math.max(value, recoveryOrder(row)), 0)
  if (maximum >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Recovery application order has reached the safe integer limit.')
  }
  return maximum + 1
}

/**
 * Append a newly cast schedule or update one already ticking.
 * Historical schedules without applicationOrder remain valid and update by their old identity.
 */
export function replaceRecoverySchedule(
  state: CombatEncounterState,
  recovery: CombatOngoingRecovery,
  mode: 'legacy' | 'append' | 'update' = 'update',
): CombatEncounterState {
  const effects = normalizeCombatEffectState(state.effectState)
  const alive = state.tactical.battle.combatants.some(
    (row) => row.id === recovery.targetCombatantId && row.hp > 0,
  )

  if (mode === 'legacy') {
    const key = recoveryBaseKey(recovery)
    const remaining = effects.ongoingRecovery.filter((row) => recoveryBaseKey(row) !== key)
    if (alive && recovery.remainingFutureTicks > 0) remaining.push({ ...recovery })
    else if (remaining.length === effects.ongoingRecovery.length) return state
    return {
      ...state,
      effectState: {
        ...effects,
        ongoingRecovery: remaining.sort(compareRecovery),
      },
    }
  }

  if (mode === 'append') {
    if (!alive || recovery.remainingFutureTicks <= 0) return state
    const next = {
      ...recovery,
      applicationOrder: nextRecoveryOrder(effects.ongoingRecovery),
    }
    return {
      ...state,
      effectState: {
        ...effects,
        ongoingRecovery: [...effects.ongoingRecovery, next].sort(compareRecovery),
      },
    }
  }

  const matches = (row: CombatOngoingRecovery) =>
    recovery.applicationOrder !== undefined
      ? row.applicationOrder === recovery.applicationOrder
      : row.applicationOrder === undefined && recoveryBaseKey(row) === recoveryBaseKey(recovery)
  let found = false
  const ongoingRecovery = effects.ongoingRecovery.flatMap((row) => {
    if (!matches(row)) return [row]
    found = true
    return alive && recovery.remainingFutureTicks > 0 ? [{ ...recovery }] : []
  })
  if (!found) return state
  return {
    ...state,
    effectState: {
      ...effects,
      ongoingRecovery: ongoingRecovery.sort(compareRecovery),
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
        'Recovery schedules must have valid identities, safe amounts, one to three future ticks, and stable application order.',
    },
  ]
  if (
    !effects ||
    typeof effects !== 'object' ||
    Array.isArray(effects) ||
    !Array.isArray(effects.ongoingRecovery)
  )
    return invalid
  const ids = new Set(state.tactical.battle.combatants.map((row) => row.id))
  const unbounded = usesUnboundedEffectApplications(state)
  const seenOrders = new Set<number>()
  const historicalKeys = new Set<string>()
  let previous: CombatOngoingRecovery | null = null
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
    if (unbounded) {
      if (
        row.applicationOrder === undefined ||
        !Number.isSafeInteger(row.applicationOrder) ||
        row.applicationOrder < 1 ||
        seenOrders.has(row.applicationOrder)
      )
        return invalid
      seenOrders.add(row.applicationOrder)
    } else {
      if (row.applicationOrder !== undefined) return invalid
      const key = recoveryBaseKey(row)
      if (historicalKeys.has(key)) return invalid
      historicalKeys.add(key)
    }
    if (previous && compareRecovery(previous, row) > 0) return invalid
    previous = row
  }
  return []
}
