import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import { combatDamageForAuthoring } from './combat-damage-authoring'
import { skillAccuracyForAuthoring } from './skill-accuracy-authoring'

/** Shared editable projection; retained gameplay/capture readers never use it. */
export function combatContentForAuthoring(
  kind: CombatContentKind,
  definition: CombatContentDefinition,
) {
  return combatDamageForAuthoring(kind, skillAccuracyForAuthoring(kind, definition))
}
