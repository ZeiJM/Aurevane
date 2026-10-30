import type { CombatContentKind } from '@aurevane/db/combat-content'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import type { CombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import {
  combatTagDefinition,
  validateCombatTagPayload,
} from '@aurevane/game-core/combat/combat-tag-registry'
import { effectAuthoringTag } from '@aurevane/game-core/combat/combat-effect-authoring'
import { MAXIMUM_COMBAT_LINE_LENGTH } from '@aurevane/game-core/combat/combat-targeting-shapes'
import { remapAbilityEffectDescriptions } from './combat-damage-authoring'
import { withAuthoredElementalCompanions } from './combat-elemental-authoring'

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Conservative current-entry repairs. Strict parsing still runs before any persistence.
 * Intent comes from authored mechanics, never inferred from prose. Unknown/ambiguous entries stay
 * intact for the validator, and requirements, targets, triggers and effect identities never change.
 */
export function correctCombatContentEntries<T>(
  kind: CombatContentKind,
  input: T,
): {
  definition: T
  corrections: string[]
} {
  const corrections: string[] = []
  if (!['skill', 'essence', 'resonance'].includes(kind) || !object(input))
    return { definition: input, corrections }
  const definition = structuredClone(input)
  const root = definition as Record<string, unknown>
  const owner =
    kind === 'essence' && !Object.hasOwn(root, 'ability') && object(root.skill) ? root.skill : root

  function number(
    row: Record<string, unknown>,
    key: string,
    min: number,
    max: number,
    label: string,
    divisor = 1,
  ) {
    const before = row[key]
    if (typeof before !== 'number' || !Number.isFinite(before)) return
    const after = Math.max(min, Math.min(max, Math.round(before)))
    // Large changes can express a different intended mechanic; let strict validation explain them.
    if (after === before || Math.abs(after - before) > Math.max(1, max * 0.1)) return
    row[key] = after
    corrections.push(
      `${label}: ${before / divisor}${divisor === 100 ? '%' : ''} → ${after / divisor}${divisor === 100 ? '%' : ''}.`,
    )
  }
  function payload(value: unknown) {
    if (!object(value) || typeof value.type !== 'string' || !combatTagDefinition(value.type)) return
    if (!['damage', 'pierce', 'healing', 'apply-status', 'sensory'].includes(value.type)) return
    const label = effectAuthoringTag(value as unknown as CombatTagPayload).label
    if (['damage', 'pierce', 'healing'].includes(value.type))
      number(value, 'amount', value.vengeance === undefined ? 1 : 0, 20, `${label} power`)
    if (value.type === 'apply-status') {
      number(value, 'durationTurns', 1, 4, `${label} duration`)
      number(
        value,
        'potencyBasisPoints',
        100,
        value.statusId === 'suppress' ? 10000 : 5000,
        `${label} potency`,
        100,
      )
    }
    if (value.type === 'sensory')
      number(value, 'revealedDurationOwnerTurnStarts', 1, 4, 'Reveal duration')
  }
  function targeting(value: unknown) {
    if (!object(value) || value.geometryVersion !== 3 || !object(value.shape)) return
    const shape = value.shape
    const field = shape.kind === 'line' ? 'length' : shape.kind === 'circle' ? 'radius' : null
    if (!field) return
    number(
      shape,
      field,
      1,
      field === 'length' ? MAXIMUM_COMBAT_LINE_LENGTH : 5,
      `${shape.kind} ${field}`,
    )
    const reach = shape[field]
    const cap = field === 'length' ? MAXIMUM_COMBAT_LINE_LENGTH : 5
    if (
      Number.isSafeInteger(reach) &&
      (reach as number) >= 1 &&
      (reach as number) <= cap &&
      typeof value.maximumRange === 'number' &&
      Number.isFinite(value.maximumRange) &&
      value.maximumRange !== reach
    ) {
      corrections.push(`${shape.kind} range: ${value.maximumRange} → ${reach}.`)
      value.maximumRange = reach
    }
  }
  if (object(owner.ability) && Array.isArray(owner.ability.behaviors)) {
    const previousAbility = structuredClone(owner.ability)
    owner.ability.behaviors = owner.ability.behaviors.map((group: unknown) => {
      if (!object(group) || !Array.isArray(group.effects)) return group
      targeting(group.targeting)
      for (const effect of group.effects) if (object(effect)) payload(effect.payload)
      // Only complete, supported groups reach the companion helper. Preserve every authored entry;
      // conflicting/duplicate companions are left for strict validation rather than removed.
      if (
        !group.effects.every(
          (effect: unknown) =>
            object(effect) &&
            typeof effect.id === 'string' &&
            object(effect.payload) &&
            typeof effect.payload.type === 'string' &&
            combatTagDefinition(effect.payload.type) &&
            (() => {
              try {
                return validateCombatTagPayload(effect.payload).length === 0
              } catch {
                return false
              }
            })(),
        )
      )
        return group
      const next = withAuthoredElementalCompanions(
        group as unknown as AbilityBehavior,
        group as unknown as AbilityBehavior,
        { preserveExisting: true },
      )
      for (const effect of next.effects.slice(group.effects.length))
        corrections.push(
          `Added required ${effectAuthoringTag(effect.payload).label} for the selected damage element.`,
        )
      return next
    })
    const noteOwner = kind === 'essence' && object(root.skill) ? root.skill : owner
    if (Array.isArray(noteOwner.effectDescriptions))
      noteOwner.effectDescriptions = remapAbilityEffectDescriptions(
        previousAbility,
        owner.ability,
        noteOwner.effectDescriptions,
      )
  } else {
    targeting(owner.target)
    if (Array.isArray(owner.effects)) for (const effect of owner.effects) payload(effect)
  }
  return { definition, corrections }
}
