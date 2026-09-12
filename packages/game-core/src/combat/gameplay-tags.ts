import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEffectDefinition,
  CombatEncounterState,
} from './actions'

export const GAMEPLAY_TAGS = [
  'Scorched',
  'Frozen',
  'Conductive',
  'Wet',
  'Bleeding',
  'Marked',
  'Guarded',
  'Inspired',
  'Hexed',
  'Invisible',
  'Exposed',
  'Poisoned',
  'Fortified',
  'Summoned',
  'Airborne',
  'Displaced',
] as const
export type GameplayTag = (typeof GAMEPLAY_TAGS)[number]
export type CombatElement = 'water' | 'storm' | 'fire'

/** Stable aliases read old snapshots without renaming their stored status identities. */
const STATUS_TAG_ALIASES: Readonly<Record<string, GameplayTag>> = {
  burn: 'Scorched',
  scorched: 'Scorched',
  frozen: 'Frozen',
  conductive: 'Conductive',
  wet: 'Wet',
  bleed: 'Bleeding',
  bleeding: 'Bleeding',
  marked: 'Marked',
  guarded: 'Guarded',
  inspired: 'Inspired',
  hexed: 'Hexed',
  invisible: 'Invisible',
  exposed: 'Exposed',
  poison: 'Poisoned',
  poisoned: 'Poisoned',
  fortified: 'Fortified',
  summoned: 'Summoned',
  airborne: 'Airborne',
  displaced: 'Displaced',
}

export function validateGameplayTag(tag: unknown): asserts tag is GameplayTag {
  if (typeof tag !== 'string' || !GAMEPLAY_TAGS.includes(tag as GameplayTag))
    throw new TypeError('Unknown gameplay tag.')
}

export function combatantGameplayTags(
  state: Pick<CombatEncounterState, 'statusState'>,
  combatantId: string,
  content: CombatContentCatalog,
): readonly GameplayTag[] {
  const tags = new Set<GameplayTag>()
  for (const status of state.statusState.find((row) => row.combatantId === combatantId)?.statuses ??
    []) {
    const alias = STATUS_TAG_ALIASES[status.statusId]
    if (alias) tags.add(alias)
    const definition = content.statuses.find(
      (candidate) => candidate.id === status.statusId && candidate.version === status.statusVersion,
    )
    for (const tag of definition?.gameplayTags ?? []) tags.add(tag)
  }
  return GAMEPLAY_TAGS.filter((tag) => tags.has(tag))
}

export function hasGameplayTag(
  state: Pick<CombatEncounterState, 'statusState'>,
  combatantId: string,
  tag: GameplayTag,
  content: CombatContentCatalog,
): boolean {
  return combatantGameplayTags(state, combatantId, content).includes(tag)
}

export function statusIdsForGameplayTag(
  state: Pick<CombatEncounterState, 'statusState'>,
  combatantId: string,
  tag: GameplayTag,
  content: CombatContentCatalog,
): readonly string[] {
  return (state.statusState.find((row) => row.combatantId === combatantId)?.statuses ?? [])
    .filter(
      (status) =>
        STATUS_TAG_ALIASES[status.statusId] === tag ||
        content.statuses
          .find(
            (definition) =>
              definition.id === status.statusId && definition.version === status.statusVersion,
          )
          ?.gameplayTags?.includes(tag),
    )
    .map((status) => status.statusId)
}

/** Validate additive metadata without reinterpreting published historical Skill definitions. */
export function validateGameplayActionMetadata(
  action: Pick<CombatActionDefinition, 'target' | 'requirements' | 'effects'>,
): void {
  for (const requirement of action.requirements) {
    if (
      requirement.kind === 'actor-tag-present' ||
      requirement.kind === 'actor-tag-absent' ||
      requirement.kind === 'target-tag-present'
    )
      validateGameplayTag(requirement.tag)
  }
  for (const effect of action.effects) {
    validateGameplayEffectMetadata(effect)
    if (
      effect.type === 'create-terrain' &&
      !['ground-tile', 'empty-tile'].includes(action.target.kind)
    )
      throw new TypeError('Frozen terrain requires authored ground targeting and affected tiles.')
  }
}

/** Shared content-boundary validation; the containing action supplies target-dependent legality. */
export function validateGameplayEffectMetadata(effect: CombatEffectDefinition): void {
  if (
    effect.type === 'damage' &&
    effect.element !== undefined &&
    !['water', 'storm', 'fire'].includes(effect.element)
  )
    throw new TypeError('Unknown damage element.')
  if (
    effect.type === 'create-terrain' &&
    (effect.recipient !== 'affected-tiles' || effect.terrain !== 'frozen')
  )
    throw new TypeError('Frozen terrain requires affected tiles.')
  if (
    effect.type === 'displace' &&
    (effect.distance !== 1 || !['primary-unit', 'affected-units'].includes(effect.recipient))
  )
    throw new TypeError('Displacement is a one-tile push of another unit.')
}
