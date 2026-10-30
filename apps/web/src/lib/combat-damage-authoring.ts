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
    if (
      object(effect) &&
      effect.type === 'damage' &&
      (effect.piercing === true || effect.shattersBarrier === true)
    ) {
      const next = { ...effect }
      delete next.element
      return next
    }
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
/** Retire only unchanged generated companions owned solely by a newly non-elemental Pierce. */
function elementlessPierceGroup(behavior: Record<string, unknown>) {
  if (!Array.isArray(behavior.effects)) return behavior
  const oldEffects = behavior.effects
  const removed = oldEffects.filter(
    (effect: unknown) =>
      object(effect) &&
      object(effect.payload) &&
      effect.payload.type === 'pierce' &&
      typeof effect.payload.element === 'string',
  )
  if (!removed.length) return behavior
  const effects = oldEffects.flatMap((effect: unknown) => {
    if (!object(effect) || !object(effect.payload)) return [effect]
    if (effect.payload.type === 'pierce') {
      const payload = { ...effect.payload }
      delete payload.element
      return [{ ...effect, payload }]
    }
    if (
      typeof effect.id !== 'string' ||
      !effect.id.startsWith('element-companion.') ||
      effect.requirements != null ||
      effect.timing !== undefined
    )
      return [effect]
    if (
      object(behavior.groundArea) &&
      Array.isArray(behavior.groundArea.entryEffectIds) &&
      behavior.groundArea.entryEffectIds.includes(effect.id)
    )
      return [effect]
    const payload = effect.payload
    for (const old of removed) {
      if (!object(old) || !object(old.payload)) continue
      const element = old.payload.element
      const status = (
        { ice: 'frozen', water: 'wet', storm: 'conductive' } as Record<string, string>
      )[String(element)]
      const fire = element === 'fire'
      const recipient = fire ? 'actor' : old.payload.recipient
      const target = fire ? 'self' : old.payload.target
      if (payload.recipient !== recipient || payload.target !== target) continue
      const expectedKeys = fire
        ? ['type', 'recipient', 'target', 'statusIds', 'removalMode']
        : [
            'type',
            'recipient',
            'target',
            'statusId',
            'stacks',
            'durationTurns',
            'potencyBasisPoints',
          ]
      if (Object.keys(payload).some((key) => !expectedKeys.includes(key))) continue
      const defaults = fire
        ? payload.type === 'remove-status' &&
          Array.isArray(payload.statusIds) &&
          payload.statusIds.length === 1 &&
          payload.statusIds[0] === 'frozen' &&
          (payload.removalMode === undefined || payload.removalMode === 'specified')
        : status &&
          payload.type === 'apply-status' &&
          payload.statusId === status &&
          payload.stacks === 1 &&
          payload.durationTurns === 2 &&
          (status === 'frozen'
            ? payload.potencyBasisPoints === undefined
            : payload.potencyBasisPoints === 2000)
      if (!defaults) continue
      const shared = oldEffects.some(
        (candidate: unknown) =>
          object(candidate) &&
          object(candidate.payload) &&
          candidate.payload.type === 'damage' &&
          candidate.payload.element === element &&
          (fire || candidate.payload.recipient === recipient),
      )
      if (!shared) return []
    }
    return [effect]
  })
  return { ...behavior, effects }
}
export function remapAbilityEffectDescriptions(
  previous: unknown,
  next: unknown,
  descriptions: unknown,
) {
  if (
    !object(previous) ||
    !object(next) ||
    !Array.isArray(previous.behaviors) ||
    !Array.isArray(next.behaviors) ||
    !Array.isArray(descriptions)
  )
    return descriptions
  const all = (groups: unknown[]) =>
    groups.flatMap((group) =>
      object(group) && Array.isArray(group.effects)
        ? group.effects.map(
            (effect: unknown) => `${String(group.id)}:${object(effect) ? String(effect.id) : ''}`,
          )
        : [],
    )
  const before = all(previous.behaviors),
    after = all(next.behaviors)
  if (before.length !== descriptions.length || before.length === after.length) return descriptions
  const notes = new Map(before.map((id, index) => [id, descriptions[index]]))
  return after.map((id) => notes.get(id) ?? null)
}
function ability(value: unknown): unknown {
  if (!object(value) || !Array.isArray(value.behaviors)) return value
  return {
    ...value,
    behaviors: value.behaviors.map((stored: unknown) => {
      if (!object(stored) || !Array.isArray(stored.effects)) return stored
      const behavior = elementlessPierceGroup(stored)
      if (!Array.isArray(behavior.effects)) return behavior
      const family = behavior.classification === 'attack' ? behavior.attackFamily : undefined
      if (family !== 'physical' && family !== 'mystic') return behavior
      return {
        ...behavior,
        effects: behavior.effects.map((effect: unknown) => {
          if (!object(effect) || !ordinaryDamage(effect.payload)) return effect
          const payload = { ...effect.payload }
          if (payload.type === 'pierce') delete payload.element
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
  if (Object.hasOwn(value, 'ability')) {
    const next = ability(value.ability)
    return {
      ...value,
      ability: next,
      ...(Array.isArray(value.effectDescriptions)
        ? {
            effectDescriptions: remapAbilityEffectDescriptions(
              value.ability,
              next,
              value.effectDescriptions,
            ),
          }
        : {}),
    }
  }
  return Array.isArray(value.effects) ? { ...value, effects: nativeEffects(value.effects) } : value
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
  if (kind === 'essence') {
    const projected = Object.hasOwn(definition, 'ability') ? skill(definition) : definition
    const nested = object(definition.skill) ? { ...skill(definition.skill) } : null
    if (
      nested &&
      Object.hasOwn(definition, 'ability') &&
      object(definition.skill) &&
      Array.isArray(definition.skill.effectDescriptions)
    )
      nested.effectDescriptions = remapAbilityEffectDescriptions(
        definition.ability,
        projected.ability,
        definition.skill.effectDescriptions,
      )
    return { ...projected, ...(nested ? { skill: nested } : {}) } as T
  }
  if (kind === 'resonance')
    return Object.hasOwn(definition, 'ability')
      ? (skill(definition) as T)
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
