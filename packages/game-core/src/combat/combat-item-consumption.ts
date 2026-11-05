import type { CombatEncounterState, CombatEncounterIssue } from './actions-legacy'
import type { CapturedCombatAbilitySource } from './combat-behavior-capture'

/** Private accepted-use receipt counts; captured definitions and starting stock remain immutable. */
export interface CombatItemConsumptionState {
  readonly version: 1
  readonly consumed: readonly { readonly sourceInstanceId: string; readonly count: number }[]
}
/** Only the controlling owner may receive this number in a public projection. */
export function combatItemStock(
  state: CombatEncounterState,
  source: CapturedCombatAbilitySource,
): number | null {
  if (source.equipment?.consumptionPolicyVersion !== 1) return null
  const unit = source.equipment.unit
  const spent = (state.itemConsumptionState?.consumed ?? []).reduce((sum, row) => {
    const origin = state.capturedAbilitySources?.find(
      (candidate) => candidate.sourceInstanceId === row.sourceInstanceId,
    )
    return origin?.ownerCombatantId === source.ownerCombatantId &&
      origin.equipment?.unit.ownedStackId === unit.ownedStackId
      ? sum + row.count
      : sum
  }, 0)
  return Math.max(0, unit.ownedQuantity! - spent)
}
export function consumeCombatItemStock(
  state: CombatEncounterState,
  source: CapturedCombatAbilitySource,
  behaviorId: string,
): CombatEncounterState {
  if (source.equipment?.roles.use !== behaviorId || source.equipment.consumptionPolicyVersion !== 1)
    return state
  if (combatItemStock(state, source) === 0)
    throw new TypeError('Consumable stock is exhausted. Equip another stack after battle.')
  const rows = state.itemConsumptionState?.consumed ?? []
  const previous = rows.find((row) => row.sourceInstanceId === source.sourceInstanceId)
  return {
    ...state,
    itemConsumptionState: {
      version: 1,
      consumed: [
        ...rows.filter((row) => row.sourceInstanceId !== source.sourceInstanceId),
        { sourceInstanceId: source.sourceInstanceId, count: (previous?.count ?? 0) + 1 },
      ].sort((a, b) => a.sourceInstanceId.localeCompare(b.sourceInstanceId)),
    },
  }
}
export function validateCombatItemConsumptionState(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  const value = state.itemConsumptionState
  if (value === undefined) return []
  try {
    if (
      !value ||
      value.version !== 1 ||
      Object.keys(value).some((key) => !['version', 'consumed'].includes(key)) ||
      !Array.isArray(value.consumed)
    )
      throw new TypeError()
    const seen = new Set<string>()
    for (const row of value.consumed) {
      const source = state.capturedAbilitySources?.find(
        (candidate) => candidate.sourceInstanceId === row?.sourceInstanceId,
      )
      if (
        !row ||
        Object.keys(row).some((key) => !['sourceInstanceId', 'count'].includes(key)) ||
        seen.has(row.sourceInstanceId) ||
        !Number.isSafeInteger(row.count) ||
        row.count < 1 ||
        source?.equipment?.consumptionPolicyVersion !== 1 ||
        row.count > source.equipment.unit.ownedQuantity!
      )
        throw new TypeError()
      seen.add(row.sourceInstanceId)
      const total = value.consumed
        .filter((other) => {
          const origin = state.capturedAbilitySources?.find(
            (candidate) => candidate.sourceInstanceId === other.sourceInstanceId,
          )
          return (
            origin?.ownerCombatantId === source.ownerCombatantId &&
            origin.equipment?.unit.ownedStackId === source.equipment!.unit.ownedStackId
          )
        })
        .reduce((sum, other) => sum + other.count, 0)
      if (total > source.equipment.unit.ownedQuantity!) throw new TypeError()
    }
    return []
  } catch {
    return [
      { field: 'itemConsumptionState', message: 'Invalid private consumable stock receipts.' },
    ]
  }
}
