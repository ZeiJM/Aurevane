import type { CombatEncounterIssue, CombatEncounterState } from './actions'

/** Kept outside effect instances so removal, replacement and Copy cannot renew an allowance. */
export interface CombatTurnTriggerState {
  preparedTurnNumber: number
  combatants: readonly {
    combatantId: string
    cycle: number
    usedKeys: readonly string[]
  }[]
}

export function prepareCombatTurnTriggers(state: CombatEncounterState): CombatEncounterState {
  const battle = state.tactical.battle
  const actorId = battle.currentTurn?.combatantId
  if (!actorId || state.turnTriggerState?.preparedTurnNumber === battle.turnNumber) return state
  const rows = state.turnTriggerState?.combatants ?? []
  const previous = rows.find((row) => row.combatantId === actorId)
  const cycle = (previous?.cycle ?? 0) + 1
  if (!Number.isSafeInteger(cycle)) throw new RangeError('Combat turn cycle overflow.')
  return {
    ...state,
    turnTriggerState: {
      preparedTurnNumber: battle.turnNumber,
      combatants: [
        ...rows.filter((row) => row.combatantId !== actorId),
        { combatantId: actorId, cycle, usedKeys: [] },
      ].sort((a, b) => a.combatantId.localeCompare(b.combatantId)),
    },
  }
}

/** Units moved before their first turn use cycle zero. Only their own turn start advances it. */
export function combatTurnCycle(state: CombatEncounterState, combatantId: string): number {
  return (
    prepareCombatTurnTriggers(state).turnTriggerState?.combatants.find(
      (row) => row.combatantId === combatantId,
    )?.cycle ?? 0
  )
}

export function claimCombatTurnTrigger(
  state: CombatEncounterState,
  combatantId: string,
  key: string,
): { state: CombatEncounterState; allowed: boolean } {
  if (!state.tactical.battle.combatants.some((unit) => unit.id === combatantId))
    throw new TypeError('Combat turn trigger requires an existing combatant.')
  if (!validKey(key)) throw new TypeError('Combat turn trigger requires a bounded nonempty key.')
  const prepared = prepareCombatTurnTriggers(state)
  const tracking = prepared.turnTriggerState ?? {
    preparedTurnNumber: state.tactical.battle.turnNumber,
    combatants: [],
  }
  const row = tracking.combatants.find((item) => item.combatantId === combatantId) ?? {
    combatantId,
    cycle: 0,
    usedKeys: [],
  }
  if (row.usedKeys.includes(key)) return { state: prepared, allowed: false }
  return {
    allowed: true,
    state: {
      ...prepared,
      turnTriggerState: {
        ...tracking,
        combatants: [
          ...tracking.combatants.filter((item) => item.combatantId !== combatantId),
          { ...row, usedKeys: [...row.usedKeys, key].sort() },
        ].sort((a, b) => a.combatantId.localeCompare(b.combatantId)),
      },
    },
  }
}

function validKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length <= 256 && key.trim() === key
}

export function validateCombatTurnTriggers(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  const issues: CombatEncounterIssue[] = []
  if (
    state.dotTriggerPolicyVersion !== undefined &&
    (state.dotTriggerPolicyVersion !== 1 || state.percentageDotPolicyVersion !== 1)
  )
    issues.push({
      field: 'dotTriggerPolicyVersion',
      message: 'Unsupported or unpaired DoT trigger policy.',
    })
  const tracking = state.turnTriggerState
  if (tracking === undefined) return issues
  const ids = new Set(state.tactical.battle.combatants.map((unit) => unit.id))
  const seen = new Set<string>()
  if (
    !tracking ||
    !Number.isSafeInteger(tracking.preparedTurnNumber) ||
    tracking.preparedTurnNumber < 1 ||
    tracking.preparedTurnNumber > state.tactical.battle.turnNumber ||
    !Array.isArray(tracking.combatants) ||
    tracking.combatants.some((row) => {
      if (!row || !ids.has(row.combatantId) || seen.has(row.combatantId)) return true
      seen.add(row.combatantId)
      return (
        !Number.isSafeInteger(row.cycle) ||
        row.cycle < 0 ||
        row.cycle > state.tactical.battle.turnNumber ||
        !Array.isArray(row.usedKeys) ||
        row.usedKeys.some((key: unknown) => !validKey(key)) ||
        new Set(row.usedKeys).size !== row.usedKeys.length
      )
    })
  )
    issues.push({
      field: 'turnTriggerState',
      message: 'Invalid persisted combat turn trigger state.',
    })
  return issues
}
