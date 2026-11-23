import { validateDamageUpTypes, type DamageUpScope } from './combat-damage-up'
import { validateSealCategories, type SealCategory } from './combat-seal'
import { CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS } from './combat-effect-percentages'
import type { CombatStatusDefinition, CombatStatusInstance } from './actions'
import type { CombatCounterProfile } from './combat-counter'
import type { BlindsideModifiers } from './combat-blindside'

/** Optional fields distinguish new authored behavior from immutable historical captures. */
export interface CombatStatusTuning extends DamageUpScope {
  readonly sealedCategories?: readonly SealCategory[]
  readonly initiativeReductionBasisPoints?: number
  readonly defenseIncreaseBasisPoints?: number
  readonly rangeTiles?: number
  readonly movementApAdjustment?: number
  readonly damageTakenMultiplierBasisPoints?: number
  readonly increasedDamageTakenBasisPoints?: number
}

/** Display-only committed application values, never a replacement for combat calculations. */
export interface CombatEffectStrength extends CombatStatusTuning {
  readonly potencyBasisPoints?: number
  readonly counter?: CombatCounterProfile
  readonly reflectBarrierPolicyVersion?: 1
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
  if (statusId === 'inspired' && raw.damageTypes !== undefined) {
    validateDamageUpTypes(raw.damageTypes)
    result.damageTypes = [...(raw.damageTypes as readonly string[])]
  }
  if (statusId === 'seal' && raw.sealedCategories !== undefined) {
    validateSealCategories(raw.sealedCategories)
    result.sealedCategories = [...raw.sealedCategories]
  }
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
  numeric('rangeTiles', ['range-up', 'range-down'], 1, Number.MAX_SAFE_INTEGER)
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
  if (statusId === 'counter' && raw.reflectBarrierPolicyVersion === 1)
    result.reflectBarrierPolicyVersion = 1
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
  'rangeTiles',
  'initiativeReductionBasisPoints',
  'defenseIncreaseBasisPoints',
  'movementApAdjustment',
  'damageTakenMultiplierBasisPoints',
  'increasedDamageTakenBasisPoints',
] as const
export function combatStatusTuning(value: CombatStatusTuning): CombatStatusTuning {
  return {
    ...Object.fromEntries(
      COMBAT_STATUS_TUNING_FIELDS.flatMap((key) =>
        value[key] === undefined ? [] : [[key, value[key]]],
      ),
    ),
    ...(value.damageTypes === undefined ? {} : { damageTypes: [...value.damageTypes] }),
    ...(value.sealedCategories === undefined
      ? {}
      : { sealedCategories: [...value.sealedCategories] }),
  }
}
export function validateCombatStatusTuning(value: CombatStatusTuning, statusId: string): void {
  if (statusId === 'inspired') validateDamageUpTypes(value.damageTypes)
  else if (value.damageTypes !== undefined) throw new TypeError('Damage types require Damage Up.')
  if (statusId === 'seal') validateSealCategories(value.sealedCategories)
  else if (value.sealedCategories !== undefined)
    throw new TypeError('Category restrictions require Seal.')
  for (const key of COMBAT_STATUS_TUNING_FIELDS) {
    const amount = value[key]
    if (amount === undefined) continue
    const allowed = {
      rangeTiles: ['range-up', 'range-down'],
      initiativeReductionBasisPoints: ['wet'],
      defenseIncreaseBasisPoints: ['fortified'],
      movementApAdjustment: ['haste', 'slow'],
      damageTakenMultiplierBasisPoints: ['lowered-guard'],
      increasedDamageTakenBasisPoints: ['revealed', 'sensory'],
    }[key]
    const maximum =
      key === 'rangeTiles'
        ? Number.MAX_SAFE_INTEGER
        : key === 'movementApAdjustment'
          ? 100
          : ['initiativeReductionBasisPoints', 'defenseIncreaseBasisPoints'].includes(key)
            ? CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS
            : Number.MAX_SAFE_INTEGER - 10000
    if (
      !allowed.includes(statusId) ||
      !Number.isSafeInteger(amount) ||
      amount < (key === 'rangeTiles' ? 1 : 0) ||
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

export const DEFAULT_RECKLESS_POTENCY_BASIS_POINTS = 4000
export const DEFAULT_FORTIFIED_DEFENSE_BASIS_POINTS = 1500

/** Capture current paired defaults without replacing explicit values or historical omissions. */
export function withPairedCombatStatusDefaults<
  T extends {
    type: string
    statusId?: string
    potencyBasisPoints?: number
    defenseIncreaseBasisPoints?: number
  },
>(effect: T, current: boolean, definition?: CombatStatusDefinition): T {
  if (
    !current ||
    effect.type !== 'apply-status' ||
    !['reckless', 'fortified'].includes(effect.statusId ?? '') ||
    effect.potencyBasisPoints !== undefined ||
    effect.defenseIncreaseBasisPoints !== undefined
  )
    return effect
  // Master-authored status definitions retain their explicit modifier rules.
  if (definition) {
    const expected =
      effect.statusId === 'reckless'
        ? { outgoing: 14000, incoming: 12500 }
        : { outgoing: 8000, incoming: 7000 }
    if (
      definition.id !== effect.statusId ||
      definition.version !== 1 ||
      definition.damageTakenMultiplierBasisPoints !== 10000 ||
      definition.damageModifiers?.length !== 2 ||
      !definition.damageModifiers.every(
        (modifier) =>
          modifier.multiplierBasisPoints === expected[modifier.direction] &&
          modifier.condition.kind === 'always' &&
          Object.keys(modifier.condition).length === 1,
      ) ||
      new Set(definition.damageModifiers.map((modifier) => modifier.direction)).size !== 2
    )
      return effect
  }
  if (effect.statusId === 'reckless')
    return { ...effect, potencyBasisPoints: DEFAULT_RECKLESS_POTENCY_BASIS_POINTS }
  if (effect.statusId === 'fortified')
    return { ...effect, defenseIncreaseBasisPoints: DEFAULT_FORTIFIED_DEFENSE_BASIS_POINTS }
  return effect
}
