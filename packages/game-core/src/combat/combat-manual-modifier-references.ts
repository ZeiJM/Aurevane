import type { CombatEncounterState } from './actions'
import type { ManualCombatModifierSelection } from './combat-ability-command'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import type { AbilityBehavior } from './combat-definition'
import {
  combatModifierCompatibilityFacts,
  combatModifierFactsCompatible,
  type CombatModifierRootFacts,
} from './combat-modifier-compatibility'

/** Structural admission only: no target Requirements, resources, clocks or usage are settled. */
export function resolveCombatManualModifierReferences(
  state: CombatEncounterState,
  actorId: string,
  references: readonly ManualCombatModifierSelection[] = [],
) {
  if (!Array.isArray(references) || references.length > 15)
    throw new TypeError('modifier-command-budget')
  const seen = new Set<string>()
  return references
    .map((reference) => {
      if (
        !reference ||
        Object.keys(reference).some((key) => !['sourceInstanceId', 'behaviorId'].includes(key)) ||
        typeof reference.sourceInstanceId !== 'string' ||
        !reference.sourceInstanceId ||
        reference.sourceInstanceId.trim() !== reference.sourceInstanceId ||
        typeof reference.behaviorId !== 'string' ||
        !reference.behaviorId ||
        reference.behaviorId.trim() !== reference.behaviorId
      )
        throw new TypeError('invalid-modifier-reference')
      const key = JSON.stringify([reference.sourceInstanceId, reference.behaviorId])
      if (seen.has(key)) throw new TypeError('duplicate-modifier-reference')
      seen.add(key)
      const captured = state.capturedAbilitySources?.find(
        (row) => row.sourceInstanceId === reference.sourceInstanceId,
      )
      if (!captured) throw new TypeError('modifier-source-missing')
      const source = captureCombatAbilitySource(captured)
      if (source.ownerCombatantId !== actorId) throw new TypeError('modifier-source-owner-mismatch')
      if (!state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId))
        throw new TypeError('modifier-source-inactive')
      const behavior = source.definition.behaviors.find((row) => row.id === reference.behaviorId)
      if (!behavior || behavior.activation !== 'manual' || behavior.mode !== 'modifier')
        throw new TypeError('manual-modifier-behavior-required')
      return { source, behavior }
    })
    .sort(
      (a, b) =>
        compare(a.source.sourceInstanceId, b.source.sourceInstanceId) ||
        compare(a.behavior.id, b.behavior.id),
    )
}

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Prime admission and paid composition use the same supported inherited-target contract. */
export function combatModifierRootCompatible(
  behavior: AbilityBehavior,
  root: CombatModifierRootFacts,
): boolean {
  return combatModifierFactsCompatible(combatModifierCompatibilityFacts(behavior), root)
}
