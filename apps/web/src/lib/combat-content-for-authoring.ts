import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import { combatCategoryForAuthoring } from './combat-category-authoring'
import { combatDamageForAuthoring } from './combat-damage-authoring'
import { skillAccuracyForAuthoring } from './skill-accuracy-authoring'
import { combatGroundForAuthoring } from './combat-ground-for-authoring'

/** Shared editable projection; retained gameplay/capture readers never use it. */
export function combatContentForAuthoring(
  kind: CombatContentKind,
  definition: CombatContentDefinition,
) {
  return combatGroundForAuthoring(
    kind,
    combatCategoryForAuthoring(
      kind,
      combatDamageForAuthoring(kind, skillAccuracyForAuthoring(kind, definition)),
    ),
  )
}
