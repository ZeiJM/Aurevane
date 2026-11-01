import { CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS } from './combat-effect-percentages'
import type { CombatStatusInstance } from './actions'
import type { CombatCounterProfile } from './combat-counter'
import type { BlindsideModifiers } from './combat-blindside'

/** Optional fields distinguish new authored behavior from immutable historical captures. */
export interface CombatStatusTuning {
  readonly initiativeReductionBasisPoints?: number
  readonly defenseIncreaseBasisPoints?: number
  readonly movementApAdjustment?: number
  readonly damageTakenMultiplierBasisPoints?: number
  readonly increasedDamageTakenBasisPoints?: number
}

/** Display-only committed application values, never a replacement for combat calculations. */
export interface CombatEffectStrength extends CombatStatusTuning {
  readonly potencyBasisPoints?: number
  readonly counter?: CombatCounterProfile
  readonly blindsideModifiersBasisPoints?: BlindsideModifiers
  readonly recoveryAmountPerApplication?: number
  readonly endureReleaseBasisPoints?: number
}

/** Allowlist explicit values by effect identity; absent history never acquires today's defaults. */
export function combatEffectStrength(
  statusId: string,
  value: unknown,
): CombatEffectStrength | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  const numeric = (key: string, ids: readonly string[], minimum: number, maximum: number) => {
    const amount = raw[key]
    if (
      ids.includes(statusId) &&
      typeof amount === 'number' &&
      Number.isSafeInteger(amount) &&
      amount >= minimum &&
      amount <= maximum
    )
      result[key] = amount
  }
  numeric(
    'potencyBasisPoints',
    [
      'suppress',
      'guarded',
      'exposed',
      'inspired',
      'hexed',
      'mark',
      'blind',
      'warded',
      'challenged',
      'marked',
      'reckless',
      'fortified',
      'wet',
      'conductive',
      'summoned',
    ],
    100,
    CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS,
  )
  numeric('movementApAdjustment', ['haste', 'slow'], 0, 100)
  numeric('initiativeReductionBasisPoints', ['wet'], 0, CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS)
  numeric(
    'defenseIncreaseBasisPoints',
    ['fortified'],
    0,
    CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS,
  )
  numeric('damageTakenMultiplierBasisPoints', ['lowered-guard'], 0, Number.MAX_SAFE_INTEGER)
  numeric(
    'increasedDamageTakenBasisPoints',
    ['revealed', 'sensory'],
    0,
    Number.MAX_SAFE_INTEGER - 10000,
  )
  numeric('recoveryAmountPerApplication', ['healing', 'mp-recovery'], 0, Number.MAX_SAFE_INTEGER)
  numeric('endureReleaseBasisPoints', ['endure'], 1, Number.MAX_SAFE_INTEGER)
  const counter = raw.counter as Partial<CombatCounterProfile> | undefined
  if (
    statusId === 'counter' &&
    counter &&
    ['physical', 'mystic', 'full'].includes(String(counter.kind)) &&
    Number.isSafeInteger(counter.basisPoints) &&
    counter.basisPoints! > 0
  )
    result.counter = { kind: counter.kind, basisPoints: counter.basisPoints }
  const blindside = raw.blindsideModifiersBasisPoints as Partial<BlindsideModifiers> | undefined
  if (
    ['blindside', 'blindside-vulnerability'].includes(statusId) &&
    blindside &&
    ['side', 'rear'].every(
      (key) =>
        Number.isSafeInteger(blindside[key as keyof BlindsideModifiers]) &&
        blindside[key as keyof BlindsideModifiers]! >= 10000,
    )
  )
    result.blindsideModifiersBasisPoints = { side: blindside.side, rear: blindside.rear }
  return Object.keys(result).length ? (result as CombatEffectStrength) : undefined
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
          ? CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS
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

/** Authoring and restored applications use the same per-status percentage ceiling. */
export function maximumCombatStatusPotencyBasisPoints(statusId?: string): number {
  void statusId
  return CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS
}
