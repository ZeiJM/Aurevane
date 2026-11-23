import type { CombatContentKind } from '@aurevane/db/combat-content'
import { BASIC_SKILL_IDS } from '@aurevane/game-core/combat/combat-basic-actions'
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
function body(kind: CombatContentKind, definition: unknown) {
  if (!object(definition)) return null
  if (kind === 'skill' && BASIC_SKILL_IDS.some((id) => id === definition.id)) return null
  if (!['skill', 'essence', 'resonance'].includes(kind)) return null
  if (kind === 'essence' && !Object.hasOwn(definition, 'ability'))
    return object(definition.skill) ? definition.skill : null
  return definition
}
/** Only current editable actions are projected; historical and published readers never call this. */
export function combatCategoryForAuthoring<T>(kind: CombatContentKind, definition: T): T {
  const owner = body(kind, definition)
  if (
    !owner ||
    kind === 'resonance' ||
    !object(owner.ability) ||
    !Array.isArray(owner.ability.behaviors)
  )
    return definition
  const ability = {
    ...owner.ability,
    behaviors: owner.ability.behaviors.map((behavior: unknown) => {
      if (!object(behavior) || behavior.mode !== 'action') return behavior
      const next: Record<string, unknown> = { ...behavior, activation: 'manual' }
      delete next.automaticTarget
      delete next.automaticTrigger
      return next
    }),
  }
  const next = { ...owner, ability }
  return (owner === definition ? next : { ...definition, skill: next }) as T
}
export function combatCategoryIssues(kind: CombatContentKind, definition: unknown) {
  const owner = body(kind, definition)
  if (!owner || !object(owner.ability) || !Array.isArray(owner.ability.behaviors)) return []
  return owner.ability.behaviors.flatMap((behavior: unknown, index) => {
    if (!object(behavior)) return []
    const valid =
      kind === 'resonance'
        ? behavior.activation !== 'manual'
        : behavior.activation === 'manual' && behavior.mode === 'action'
    return valid
      ? []
      : [
          {
            path: `ability.behaviors[${index}]`,
            code: 'CATEGORY_ABILITY_TYPE',
            message:
              kind === 'resonance'
                ? 'Resonances must be Passive. Apply the category settings in the editor and choose the passive trigger before committing.'
                : 'Discipline Skills and Essences must be Manual Actions. Apply the category settings and replace any incompatible modifier effects before committing.',
          },
        ]
  })
}
