import type { CombatTargetSpec } from './actions'
import type { AbilityBehavior } from './combat-definition'
import type { AbilityClassification } from './combat-requirements'
import { canonicalAbilityTargetSpec, combatTargetCategories } from './combat-targeting-shapes'

export interface CombatModifierCompatibilityFacts {
  readonly payloadsSupported: boolean
  readonly requiresExplicitUnit: boolean
}
export interface CombatModifierRootFacts {
  readonly classification: AbilityClassification | undefined
  readonly targetKind: CombatTargetSpec['kind'] | undefined
  readonly persistentGround: boolean
  readonly hasPrimaryRecipient: boolean
}

export function combatModifierCompatibilityFacts(
  behavior: AbilityBehavior,
): CombatModifierCompatibilityFacts {
  return {
    payloadsSupported: behavior.effects.every((effect) =>
      ['damage', 'pierce', 'apply-status', 'remove-status', 'damage-bonus'].includes(
        effect.payload.type,
      ),
    ),
    requiresExplicitUnit: behavior.effects.some(
      (effect) => effect.payload.recipient === 'primary-unit',
    ),
  }
}

export function combatNativeModifierRootFacts(
  target: CombatTargetSpec,
  classification: AbilityClassification,
): CombatModifierRootFacts {
  return {
    classification,
    targetKind: target.kind,
    persistentGround: false,
    hasPrimaryRecipient:
      target.kind === 'unit' &&
      ((target.geometryVersion !== 2 && target.geometryVersion !== 3) ||
        target.shape.kind === 'single') &&
      combatTargetCategories(target).some((category) => category !== 'ground'),
  }
}

export function combatCanonicalModifierRootFacts(
  behavior: AbilityBehavior,
): CombatModifierRootFacts {
  return {
    ...(behavior.targeting
      ? combatNativeModifierRootFacts(
          canonicalAbilityTargetSpec(behavior.targeting),
          behavior.classification,
        )
      : {
          classification: behavior.classification,
          targetKind: undefined,
          hasPrimaryRecipient: false,
        }),
    persistentGround: !!behavior.groundArea,
  }
}

export function combatModifierFactsCompatible(
  modifier: CombatModifierCompatibilityFacts,
  root: CombatModifierRootFacts,
): boolean {
  return (
    root.classification === 'attack' &&
    root.targetKind === 'unit' &&
    !root.persistentGround &&
    modifier.payloadsSupported &&
    (root.hasPrimaryRecipient || !modifier.requiresExplicitUnit)
  )
}
