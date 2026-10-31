import type { CombatStatusInstance } from './actions'

/** Optional fields distinguish new authored behavior from immutable historical captures. */
export interface CombatStatusTuning {
  readonly initiativeReductionBasisPoints?: number
  readonly defenseIncreaseBasisPoints?: number
  readonly movementApAdjustment?: number
  readonly damageTakenMultiplierBasisPoints?: number
  readonly increasedDamageTakenBasisPoints?: number
}
export const COMBAT_STATUS_TUNING_FIELDS = [
  'initiativeReductionBasisPoints',
  'defenseIncreaseBasisPoints',
  'movementApAdjustment',
  'damageTakenMultiplierBasisPoints',
  'increasedDamageTakenBasisPoints',
] as const
export function combatStatusTuning(value: CombatStatusTuning): CombatStatusTuning {
  return Object.fromEntries(
    COMBAT_STATUS_TUNING_FIELDS.flatMap((key) =>
      value[key] === undefined ? [] : [[key, value[key]]],
    ),
  )
}
export function validateCombatStatusTuning(value: CombatStatusTuning, statusId: string): void {
  for (const key of COMBAT_STATUS_TUNING_FIELDS) {
    const amount = value[key]
    if (amount === undefined) continue
    const allowed = {
      initiativeReductionBasisPoints: ['wet'],
      defenseIncreaseBasisPoints: ['fortified'],
      movementApAdjustment: ['haste', 'slow'],
      damageTakenMultiplierBasisPoints: ['lowered-guard'],
      increasedDamageTakenBasisPoints: ['revealed', 'sensory'],
    }[key]
    const maximum =
      key === 'movementApAdjustment'
        ? 100
        : ['initiativeReductionBasisPoints', 'defenseIncreaseBasisPoints'].includes(key)
          ? 10000
          : Number.MAX_SAFE_INTEGER - 10000
    if (
      !allowed.includes(statusId) ||
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      amount > maximum
    )
      throw new RangeError(`Invalid ${key} for ${statusId}.`)
  }
}
export function configuredRevealed(status: CombatStatusInstance): boolean {
  return (
    status.statusId === 'revealed' &&
    status.timingState !== 'pending' &&
    (status.applicationModifiers ?? [status]).some(
      (row) => row.increasedDamageTakenBasisPoints !== undefined,
    )
  )
}
export function hasConfiguredRevealed(
  state: {
    statusState: readonly { combatantId: string; statuses: readonly CombatStatusInstance[] }[]
  },
  targetId: string,
): boolean {
  return (
    state.statusState
      .find((row) => row.combatantId === targetId)
      ?.statuses.some(configuredRevealed) === true
  )
}
