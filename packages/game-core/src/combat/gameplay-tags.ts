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

const STATUS_PRESENTATION_TAGS: Readonly<Record<string, string>> = {
  guarded: 'Guard',
  exposed: 'Expose',
  wet: 'Wet',
  frozen: 'Frozen',
  conductive: 'Conductive',
  inspired: 'Inspire',
  hexed: 'Hex',
  invisible: 'Ghost',
  summoned: 'Summon',
  airborne: 'Airborne',
  displaced: 'Displaced',
  haste: 'Haste',
  slow: 'Slow',
  burn: 'Burn (Scorched)',
  bleed: 'Bleed (Bleeding)',
  poison: 'Poison (Poisoned)',
  reckless: 'Reckless',
  fortified: 'Fortified',
  challenged: 'Challenged',
  marked: 'Marked',
  warded: 'Warded',
  'lowered-guard': 'Off-guard',
  root: 'Root',
  blind: 'Blind',
  'absorb-hp': 'Absorb HP',
  'absorb-mp': 'Absorb MP',
  reflect: 'Reflect',
  amplify: 'Amplify',
  curse: 'Curse',
}

const POSITIVE_STATUS_IDS = new Set([
  'guarded',
  'inspired',
  'invisible',
  'summoned',
  'airborne',
  'haste',
  'fortified',
  'warded',
  'absorb-hp',
  'absorb-mp',
  'reflect',
  'amplify',
])

type PresentationEffect = {
  type: string
  recipient?: unknown
  [key: string]: unknown
}

export function validateGameplayTag(tag: unknown): asserts tag is GameplayTag {
  if (typeof tag !== 'string' || !GAMEPLAY_TAGS.includes(tag as GameplayTag))
    throw new TypeError('Unknown gameplay tag.')
}

export function combatStatusPresentationTag(statusId: string): string {
  return STATUS_PRESENTATION_TAGS[statusId] ?? titleIdentity(statusId)
}

export function combatActionPresentationTags(
  action: Pick<CombatActionDefinition, 'target' | 'effects'>,
): readonly string[] {
  const result = [targetPresentationTag(action), shapePresentationTag(action)]
  const seen = new Set(result)

  for (const definition of action.effects) {
    const effect = definition as unknown as PresentationEffect
    for (const rawLabel of effectPresentationTags(effect)) {
      const label =
        effect.recipient === 'actor' && action.target.kind !== 'self'
          ? `${rawLabel} · Self`
          : rawLabel
      if (!seen.has(label)) {
        result.push(label)
        seen.add(label)
      }
    }
  }

  return result
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
  if (effect.type === 'displace') {
    const authoring = effect as unknown as { direction?: unknown; distance?: unknown }
    if (
      !Number.isSafeInteger(authoring.distance) ||
      (authoring.distance as number) <= 0 ||
      !['primary-unit', 'affected-units'].includes(effect.recipient)
    )
      throw new TypeError('Displacement requires a positive distance on another unit.')
    if (
      authoring.direction !== undefined &&
      !['push', 'pull'].includes(authoring.direction as string)
    )
      throw new TypeError('Displacement direction must be Push or Pull.')
  }
}

function targetPresentationTag(action: Pick<CombatActionDefinition, 'target'>): string {
  const target = action.target
  if (target.kind === 'self') return 'Self'
  if (target.kind === 'ground-tile') return 'Ground'
  if (target.kind === 'empty-tile') return 'Empty Tile'
  if (target.teamPolicy === 'enemy') return 'Enemy'
  if (target.teamPolicy === 'self') return 'Self'
  if (target.teamPolicy === 'ally') return target.minimumRange === 0 ? 'Self/Ally' : 'Ally'
  return 'Anyone'
}

function shapePresentationTag(action: Pick<CombatActionDefinition, 'target'>): string {
  const shape = action.target.shape
  if (shape.kind === 'single') return 'Single'
  if (shape.kind === 'circle') return `Circle ${shape.radius}`
  return `Line ${shape.length}`
}

function effectPresentationTags(effect: PresentationEffect): readonly string[] {
  if (effect.type === 'damage') {
    const element =
      effect.element === 'water'
        ? 'Water Dmg'
        : effect.element === 'storm'
          ? 'Storm Dmg'
          : effect.element === 'fire'
            ? 'Fire Dmg'
            : 'Dmg'
    return effect.piercing === true ? [element, 'Pierce'] : [element]
  }
  if (effect.type === 'healing') return [`Heal ${positiveDisplayInteger(effect.ticks, 1)}`]
  if (effect.type === 'resource-change') {
    return typeof effect.delta === 'number' && effect.delta < 0
      ? ['MP Drain']
      : [`MP Rec ${positiveDisplayInteger(effect.ticks, 1)}`]
  }
  if (effect.type === 'remove-status') {
    const ids = Array.isArray(effect.statusIds)
      ? effect.statusIds.filter((id): id is string => typeof id === 'string')
      : []
    return [ids.length > 0 && ids.every((id) => POSITIVE_STATUS_IDS.has(id)) ? 'Dispel' : 'Cleanse']
  }
  if (effect.type === 'return-to-turn-start' || effect.type === 'revert') return ['Revert']
  if (effect.type === 'create-terrain' || effect.type === 'freeze-ground') return ['Freeze Ground']
  if (effect.type === 'displace') {
    const direction = effect.direction === 'pull' ? 'Pull' : 'Push'
    return [`${direction} ${positiveDisplayInteger(effect.distance, 1)}`]
  }
  if (effect.type === 'apply-status' && typeof effect.statusId === 'string') {
    return [combatStatusPresentationTag(effect.statusId)]
  }

  const directLabels: Readonly<Record<string, string>> = {
    copy: 'Copy',
    'absorb-hp': 'Absorb HP',
    'absorb-mp': 'Absorb MP',
    reflect: 'Reflect',
    vengeance: 'Vengeance',
    amplify: 'Amplify',
    curse: 'Curse',
    cleanse: 'Cleanse',
    dispel: 'Dispel',
    'apply-burn': 'Burn (Scorched)',
    'apply-bleed': 'Bleed (Bleeding)',
    'apply-poison': 'Poison (Poisoned)',
  }
  return directLabels[effect.type] ? [directLabels[effect.type]!] : []
}

function positiveDisplayInteger(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : fallback
}

function titleIdentity(value: string): string {
  return value
    .replace(/^(buff|debuff)\./, '')
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
