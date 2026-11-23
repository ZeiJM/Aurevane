import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
const skillBody = (value: CombatContentDefinition) => (value.skill ?? {}) as CombatContentDefinition

/** Match essenceCombatSkill: a canonical root takes precedence over its retained nested envelope. */
export function readMechanicsBody(
  kind: CombatContentKind,
  value: CombatContentDefinition,
): CombatContentDefinition {
  if (kind !== 'essence') return value
  const skill = skillBody(value)
  return Object.hasOwn(value, 'ability') ? { ...skill, ability: value.ability } : skill
}
export function writeMechanicsBody(
  kind: CombatContentKind,
  value: CombatContentDefinition,
  body: CombatContentDefinition,
): CombatContentDefinition {
  if (kind !== 'essence') return body
  if (!Object.hasOwn(value, 'ability')) return { ...value, skill: body }
  const { ability, ...skill } = body
  const retained = skillBody(value)
  return {
    ...value,
    ability,
    skill: {
      ...skill,
      ...(Object.hasOwn(retained, 'ability') ? { ability: retained.ability } : {}),
    },
  }
}
