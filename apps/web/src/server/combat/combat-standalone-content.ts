import type { CombatStatusDefinition } from '@aurevane/game-core/combat/actions'
import { validateCombatStatusDefinition } from '@aurevane/game-core/combat/combat-authoring-validation'
import type { CombatContentDefinition } from '@aurevane/db/combat-content'

export const EFFECT_PROFILE_AUTHORING_BLOCKER = Object.freeze({
  code: 'EFFECT_PROFILE_AUTHORING_UNSUPPORTED' as const,
  message:
    'Effect Profile authoring and publication are unsupported: no definition schema or runtime adapter is registered. Retained records are read-only.',
})
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
function fields(
  value: unknown,
  allowed: readonly string[],
): asserts value is Record<string, unknown> {
  if (!object(value) || Object.keys(value).some((key) => !allowed.includes(key)))
    throw new TypeError('Unsupported Status definition fields.')
}
function text(value: unknown, max: number): boolean {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value
  )
}

/** Stored publication version is separate from the existing runtime Status version. */
export function parseStoredStatusDefinition(
  value: unknown,
): CombatContentDefinition & CombatStatusDefinition {
  fields(value, [
    'id',
    'version',
    'contentVersion',
    'name',
    'kind',
    'description',
    'maximumStacks',
    'durationOwnerTurnStarts',
    'damageTakenMultiplierBasisPoints',
    'damageModifiers',
    'gameplayTags',
    'endOfTurn',
    'movement',
    'polarity',
    'amplifyCopyable',
    'curseCopyable',
    'reactionClass',
    'effectCategories',
    'absorbHpBasisPoints',
    'absorbMpBasisPoints',
    'reflectBasisPoints',
    'markAccuracyBonusBasisPoints',
    'blindAccuracyPenaltyBasisPoints',
  ])
  for (const key of ['name', 'description'] as const)
    if (value[key] !== undefined && !text(value[key], key === 'name' ? 200 : 4000))
      throw new TypeError('Invalid Status presentation text.')
  if (value.kind !== undefined && !['Buff', 'Debuff', 'Effect'].includes(String(value.kind)))
    throw new TypeError('Invalid Status presentation kind.')
  if (
    value.contentVersion !== undefined &&
    (!Number.isSafeInteger(value.contentVersion) || (value.contentVersion as number) < 1)
  )
    throw new TypeError('Invalid Status publication version.')
  if (value.endOfTurn !== undefined) fields(value.endOfTurn, ['type', 'amount'])
  if (value.movement !== undefined) fields(value.movement, ['blocked', 'additionalApPerTile'])
  if (value.damageModifiers !== undefined) {
    if (!Array.isArray(value.damageModifiers))
      throw new TypeError('Invalid Status damage modifiers.')
    const conditions: Readonly<Record<string, readonly string[]>> = {
      always: [],
      'opponent-tag': ['tag'],
      'opponent-status': ['statusId'],
      'owner-hp-at-most': ['basisPoints'],
      'distance-at-least': ['tiles'],
      'opponent-is-source': ['matches'],
      'attacker-facing': ['relation'],
    }
    for (const modifier of value.damageModifiers) {
      fields(modifier, ['direction', 'multiplierBasisPoints', 'condition'])
      if (
        !object(modifier.condition) ||
        typeof modifier.condition.kind !== 'string' ||
        !Object.hasOwn(conditions, modifier.condition.kind)
      )
        throw new TypeError('Unsupported Status damage condition.')
      fields(modifier.condition, ['kind', ...conditions[modifier.condition.kind]!])
    }
  }
  // Reuse current combat semantics, including optional accuracy/reactive/copy metadata.
  validateCombatStatusDefinition(value as unknown as CombatStatusDefinition)
  return structuredClone(value) as CombatContentDefinition & CombatStatusDefinition
}

/** Legacy opaque bytes are retained for inspection, never validated as editable/runtime content. */
export function retainOpaqueEffectProfile(
  value: unknown,
  key: string,
  version?: number,
): CombatContentDefinition {
  if (
    !object(value) ||
    !text(key, 160) ||
    (version !== undefined && (!Number.isSafeInteger(version) || version < 1))
  )
    throw new TypeError('Invalid retained Effect Profile envelope.')
  // Predecessor publication allowed every object. Body fields, even id/contentVersion,
  // are opaque data: only the stored envelope identifies this non-runtime record.
  return structuredClone(value)
}
