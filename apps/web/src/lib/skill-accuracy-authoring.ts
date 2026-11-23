import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'

function skillBody(
  kind: CombatContentKind,
  definition: CombatContentDefinition,
): CombatContentDefinition | null {
  if (kind === 'skill') return definition
  const skill = definition.skill
  return kind === 'essence' && skill && typeof skill === 'object' && !Array.isArray(skill)
    ? (skill as CombatContentDefinition)
    : null
}

/** Only the retired per-Skill field is removed. Status accuracy, roll modes,
 * fixed-chance rules and immutable battle definitions remain untouched. */
export function skillAccuracyForAuthoring(
  kind: CombatContentKind,
  definition: CombatContentDefinition,
): CombatContentDefinition {
  const skill = skillBody(kind, definition)
  if (!skill || !Object.hasOwn(skill, 'accuracyModifierBasisPoints')) return definition
  const next = { ...skill }
  delete next.accuracyModifierBasisPoints
  return kind === 'essence' ? { ...definition, skill: next } : next
}

export function hasRetiredSkillAccuracyModifier(
  kind: CombatContentKind,
  definition: CombatContentDefinition,
): boolean {
  const modifier = skillBody(kind, definition)?.accuracyModifierBasisPoints
  return modifier !== undefined && modifier !== 0
}
