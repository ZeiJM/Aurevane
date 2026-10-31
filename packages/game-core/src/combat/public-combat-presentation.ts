import type { AbilityDefinition } from './combat-definition'

/** Hit-authoring aliases are private at every nesting level; numeric combat stats remain public. */
type PrivateHitAuthoringKey =
  | 'catalogueToken'
  | 'sourceHash'
  | 'accuracyRule'
  | 'accuracyMode'
  | 'accuracyModifierBasisPoints'
  | 'endureState'
  | 'reversalState'
  | 'nextReversalAttackCommandId'
  | 'reversalAttackCommandId'
export type PublicCombat<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends readonly unknown[]
    ? { [K in keyof T]: PublicCombat<T[K]> }
    : T extends object
      ? {
          [
            K in keyof T as K extends PrivateHitAuthoringKey
              ? never
              : K extends 'accuracy'
                ? T[K] extends number | undefined
                  ? K
                  : never
                : K
          ]: PublicCombat<T[K]>
        }
      : T
export type PublicAbilityDefinition = PublicCombat<AbilityDefinition>

const PRIVATE_HIT_AUTHORING_KEYS = new Set<string>([
  'endureState',
  'reversalState',
  'nextReversalAttackCommandId',
  'reversalAttackCommandId',
  'sourceHash',
  'catalogueToken',
  'accuracyRule',
  'accuracyMode',
  'accuracyModifierBasisPoints',
])

/**
 * Apply to the final composed public envelope after viewer/packet projection, never to persistence
 * or execution. This does not replace source privacy, definition validation or packet allowlists.
 */
export function projectPublicCombat<T>(value: T): PublicCombat<T> {
  const ancestors = new WeakSet<object>()
  function visit(input: unknown, depth: number): unknown {
    if (depth > 128) throw new TypeError('Public combat data exceeds the JSON nesting budget.')
    if (
      input === null ||
      input === undefined ||
      typeof input === 'string' ||
      typeof input === 'boolean'
    )
      return input
    if (typeof input === 'number' && Number.isFinite(input)) return input
    if (typeof input !== 'object')
      throw new TypeError('Public combat data must be JSON compatible.')
    const prototype = Object.getPrototypeOf(input)
    if (!Array.isArray(input) && prototype !== Object.prototype && prototype !== null)
      throw new TypeError('Public combat data must contain plain records.')
    if (ancestors.has(input)) throw new TypeError('Public combat data must not contain cycles.')
    ancestors.add(input)
    try {
      return Array.isArray(input)
        ? input.map((entry) => visit(entry, depth + 1))
        : Object.fromEntries(
            Object.entries(input)
              .filter(
                ([key, entry]) =>
                  !PRIVATE_HIT_AUTHORING_KEYS.has(key) &&
                  (key !== 'accuracy' || typeof entry === 'number'),
              )
              .map(([key, entry]) => [key, visit(entry, depth + 1)]),
          )
    } finally {
      ancestors.delete(input)
    }
  }
  return visit(value, 0) as PublicCombat<T>
}
