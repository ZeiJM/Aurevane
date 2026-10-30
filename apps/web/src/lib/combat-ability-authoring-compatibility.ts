import { AUTHORABLE_EFFECT_TAGS } from '@aurevane/game-core/combat/combat-effect-authoring'
import type { CombatContentKind } from '@aurevane/db/combat-content'
import {
  validateAbilityDefinition,
  type AbilityEffect,
  type AbilityBehavior,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { hasSelectedAimRequirement } from '@aurevane/game-core/combat/combat-effect-target-authoring'
import { combatTargetAllowsHostileHit } from '@aurevane/game-core/combat/combat-targeting-shapes'

/** Authoring projections only. Never apply to captured or historical gameplay definitions. */
export function moveUsesLocalOrGlobalEffects(group: AbilityBehavior): boolean {
  return (
    group.mode === 'action' &&
    group.effects.some(({ payload }) => payload.type === 'move') &&
    group.effects.every(
      ({ payload }) =>
        payload.recipient === 'actor' ||
        ('target' in payload && (payload.target === 'self' || payload.target === 'all')),
    )
  )
}
export function moveWithoutSeparateAim(group: AbilityBehavior): boolean {
  return (
    moveUsesLocalOrGlobalEffects(group) &&
    !hasSelectedAimRequirement([
      group.requirements,
      ...group.effects.map(({ requirements }) => requirements),
    ])
  )
}
export function authoringAccuracyApplicable(group: AbilityBehavior): boolean {
  const payloads = group.effects.map(({ payload }) => payload)
  return (
    group.mode === 'action' &&
    !!group.targeting &&
    payloads.some((payload) => ['primary-unit', 'affected-units'].includes(payload.recipient)) &&
    combatTargetAllowsHostileHit(group.targeting, payloads)
  )
}

/** Inactive values stay in the raw persistent draft; only this detached view is executable. */
export function activeAbilityForAuthoring(value: AbilityDefinition): AbilityDefinition {
  return {
    ...value,
    behaviors: value.behaviors.map((group) => {
      let next = { ...group }
      if (moveWithoutSeparateAim(group) && group.targeting) {
        next = {
          ...next,
          targeting: {
            ...group.targeting,
            geometryVersion: 3,
            kind: 'self',
            categories: ['self'],
            teamPolicy: 'self',
            shape: { kind: 'single' },
            minimumRange: 0,
            maximumRange: 0,
            maximumSelections: 1,
            requiresLineOfSight: false,
            maximumElevationDifference: null,
            friendlyFire: 'allies-only',
          },
        }
        delete next.groundArea
      }
      if (!authoringAccuracyApplicable(next)) delete next.accuracy
      return next
    }),
  }
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
/** Malformed or unknown structures remain visible to strict validation instead of being discarded. */
export function activeCombatContentForAuthoring<T>(kind: CombatContentKind, value: T): T {
  if (!['skill', 'essence', 'resonance'].includes(kind) || !record(value)) return value
  const body = kind === 'essence' && record(value.skill) ? value.skill : value
  const ability = body.ability
  if (
    !record(ability) ||
    !Array.isArray(ability.behaviors) ||
    !ability.behaviors.every(
      (group) =>
        record(group) &&
        ['action', 'modifier'].includes(String(group.mode)) &&
        Array.isArray(group.effects) &&
        group.effects.every(
          (effect) =>
            record(effect) &&
            record(effect.payload) &&
            typeof effect.payload.type === 'string' &&
            typeof effect.payload.recipient === 'string',
        ) &&
        (group.targeting === null ||
          (record(group.targeting) &&
            record(group.targeting.shape) &&
            ['single', 'all', 'circle', 'line'].includes(String(group.targeting.shape.kind)))),
    )
  )
    return value
  const next = {
    ...body,
    ability: activeAbilityForAuthoring(ability as unknown as AbilityDefinition),
  }
  return (body === value ? next : { ...value, skill: next }) as T
}
export function hasInactiveCombatSettings(kind: CombatContentKind, value: unknown): boolean {
  const active = activeCombatContentForAuthoring(kind, value)
  return active !== value && JSON.stringify(active) !== JSON.stringify(value)
}

export function reorderedAuthoringEffects(
  effects: readonly AbilityEffect[],
  from: number,
  to: number,
): readonly AbilityEffect[] {
  const next = [...effects]
  ;[next[from], next[to]] = [next[to]!, next[from]!]
  return next
}
export function insertAuthoringEffect(
  effects: readonly AbilityEffect[],
  effect: AbilityEffect,
): readonly AbilityEffect[] {
  const index =
    effect.payload.type === 'move'
      ? 0
      : effect.payload.type === 'summon'
        ? effects.length
        : effects.findIndex((row) => row.payload.type === 'summon')
  const next = [...effects]
  next.splice(index < 0 ? next.length : index, 0, effect)
  return next
}
export function authoringEffectOrderIssue(
  group: AbilityBehavior,
  effects: readonly AbilityEffect[],
): string | undefined {
  if (!effects.some(({ payload }) => payload.type === 'move' || payload.type === 'summon'))
    return undefined
  return validateAbilityDefinition(
    activeAbilityForAuthoring({ schemaVersion: 1, behaviors: [{ ...group, effects }] }),
  ).find(
    (issue) =>
      issue.code === 'unsupported-combination' &&
      (issue.message.includes('Move') || issue.message.includes('Summon')),
  )?.message
}
export function authoringReorderIssue(
  group: AbilityBehavior,
  index: number,
  direction: 1 | -1,
): string | undefined {
  const to = index + direction
  if (to < 0 || to >= group.effects.length) return 'Already at the end of the effect list.'
  if (
    !['move', 'summon'].includes(group.effects[index]!.payload.type) &&
    !['move', 'summon'].includes(group.effects[to]!.payload.type)
  )
    return undefined
  // A retained invalid order must still be repairable one position at a time.
  if (
    (group.effects[index]!.payload.type === 'move' && direction === -1) ||
    (group.effects[index]!.payload.type === 'summon' && direction === 1)
  )
    return undefined
  return authoringEffectOrderIssue(group, reorderedAuthoringEffects(group.effects, index, to))
}
export function authoringAddedEffectIssue(
  group: AbilityBehavior,
  tagId: string,
): string | undefined {
  const type = AUTHORABLE_EFFECT_TAGS.find((row) => row.id === tagId)?.opcode
  const has = (type: string) => group.effects.some((row) => row.payload.type === type)
  if (type === 'move' && (has('move') || has('summon')))
    return 'Move occurs once, first, and cannot share a group with Summon.'
  if (type === 'summon') {
    if (has('move') || has('summon'))
      return 'Summon must be the final effect and cannot share a group with Move.'
    if (group.targeting?.shape.kind !== 'single' || (group.targeting.maximumSelections ?? 1) > 1)
      return 'Summon requires one Single Empty Tile selection.'
    if (
      group.effects.some(
        ({ payload }) =>
          payload.recipient !== 'actor' &&
          (!('target' in payload) || (payload.target !== 'self' && payload.target !== 'all')),
      )
    )
      return 'Summon needs Empty Tile delivery. Choose Self or All for preceding effects, or use another behavior group.'
  }
  if (
    (type === 'copy-statuses' || type === 'sensory') &&
    (group.targeting?.shape.kind !== 'single' || (group.targeting.maximumSelections ?? 1) > 1)
  )
    return 'Copy and Reveal require one Single unit selection.'
  return undefined
}
