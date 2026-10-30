import type { CombatContentKind } from '@aurevane/db/combat-content'
import { BASIC_SKILL_IDS } from '@aurevane/game-core/combat/combat-basic-actions'
import { standardSkillDamageScaling } from '@aurevane/game-core/combat/damage-scaling'

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Costs, backlash/Vengeance and periodic damage keep their own captured formula. */
function ordinaryDamage(value: unknown): value is Record<string, unknown> {
  return (
    object(value) &&
    ['damage', 'pierce'].includes(String(value.type)) &&
    value.recipient !== 'actor' &&
    value.target !== 'self' &&
    value.vengeance === undefined &&
    value.piercing !== true
  )
}
function nativeEffects(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return value.map((effect: unknown) => {
    if (!ordinaryDamage(effect)) return effect
    // Native current Skill/Resonance adapters already apply family, packet policy and Defense.
    // Removing selectable overrides lets that one authoritative formula run once.
    const next = { ...effect }
    delete next.scaling
    delete next.defenseKind
    delete next.facingModifiersBasisPoints
    return next
  })
}
function ability(value: unknown): unknown {
  if (!object(value) || !Array.isArray(value.behaviors)) return value
  return {
    ...value,
    behaviors: value.behaviors.map((behavior: unknown) => {
      if (!object(behavior) || !Array.isArray(behavior.effects)) return behavior
      const family = behavior.classification === 'attack' ? behavior.attackFamily : undefined
      if (family !== 'physical' && family !== 'mystic') return behavior
      return {
        ...behavior,
        effects: behavior.effects.map((effect: unknown) => {
          if (!object(effect) || !ordinaryDamage(effect.payload)) return effect
          const payload = { ...effect.payload }
          delete payload.facingModifiersBasisPoints
          return {
            ...effect,
            payload: {
              ...payload,
              defenseKind: family === 'mystic' ? 'ward' : 'armor',
              scaling: standardSkillDamageScaling(
                family === 'mystic' ? 'mystic-power' : 'physical-power',
              ),
            },
          }
        }),
      }
    }),
  }
}
function skill(value: Record<string, unknown>): Record<string, unknown> {
  return Object.hasOwn(value, 'ability')
    ? { ...value, ability: ability(value.ability) }
    : Array.isArray(value.effects)
      ? { ...value, effects: nativeEffects(value.effects) }
      : value
}

/** Authoring projection only. Never call from a retained/published reader or capture materializer. */
export function combatDamageForAuthoring<T>(kind: CombatContentKind, definition: T): T {
  if (!object(definition)) return definition
  if (kind === 'skill') {
    // Universal Basic attacks have their own existing standard formula and coefficient.
    if (typeof definition.id === 'string' && BASIC_SKILL_IDS.some((id) => id === definition.id))
      return definition
    return skill(definition) as T
  }
  if (kind === 'essence')
    return {
      ...definition,
      ...(object(definition.skill) ? { skill: skill(definition.skill) } : {}),
      ...(Object.hasOwn(definition, 'ability') ? { ability: ability(definition.ability) } : {}),
    } as T
  if (kind === 'resonance')
    return Object.hasOwn(definition, 'ability')
      ? ({ ...definition, ability: ability(definition.ability) } as T)
      : ({
          ...definition,
          ...(object(definition.trigger)
            ? {
                trigger: {
                  ...definition.trigger,
                  ...(Array.isArray(definition.trigger.resultEffects)
                    ? { resultEffects: nativeEffects(definition.trigger.resultEffects) }
                    : {}),
                  ...(Array.isArray(definition.trigger.payoffEffects)
                    ? { payoffEffects: nativeEffects(definition.trigger.payoffEffects) }
                    : {}),
                },
              }
            : {}),
        } as T)
  return definition
}

export function automaticDamageFamilyIssues(value: unknown) {
  if (!object(value) || !Array.isArray(value.behaviors)) return []
  return value.behaviors.flatMap((behavior: unknown, index) =>
    object(behavior) &&
    Array.isArray(behavior.effects) &&
    behavior.effects.some((effect: unknown) => object(effect) && ordinaryDamage(effect.payload)) &&
    (behavior.classification !== 'attack' ||
      !['physical', 'mystic'].includes(String(behavior.attackFamily)))
      ? [
          {
            path: `ability.behaviors[${index}].attackFamily`,
            code: 'DAMAGE_REQUIRES_ATTACK_FAMILY',
            message:
              'Direct damage requires Attack classification and a Physical or Mystic family for the battle formula.',
          },
        ]
      : [],
  )
}

export function automaticDamageDefinitionIssues(kind: CombatContentKind, definition: unknown) {
  if (!object(definition)) return []
  if (
    kind === 'skill' &&
    typeof definition.id === 'string' &&
    BASIC_SKILL_IDS.some((id) => id === definition.id)
  )
    return []
  if (kind === 'essence') {
    if (Object.hasOwn(definition, 'ability')) return automaticDamageFamilyIssues(definition.ability)
    return object(definition.skill)
      ? automaticDamageFamilyIssues(definition.skill.ability).map((issue) => ({
          ...issue,
          path: `skill.${issue.path}`,
        }))
      : []
  }
  return kind === 'skill' || kind === 'resonance'
    ? automaticDamageFamilyIssues(definition.ability)
    : []
}
