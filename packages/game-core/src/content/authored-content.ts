import { parseAbilityDefinition, type AbilityDefinition } from '../combat/combat-definition'
import { validateAbilityRequirements, type RequirementNode } from '../combat/combat-requirements'
import { combatTagDefinition } from '../combat/combat-tag-registry'
import type { DisciplineAtlasEntry, DisciplineMasteryStage } from '../character/discipline-atlas'

export const NONCOMBAT_CONTENT_KINDS = [
  'discipline',
  'tag',
  'item',
  'ascension',
  'severence',
] as const
export type NoncombatContentKind = (typeof NONCOMBAT_CONTENT_KINDS)[number]
interface AuthoredIdentity {
  readonly schemaVersion: 1
  readonly id: string
  readonly contentVersion: number
  readonly name: string
  readonly description: string
  readonly sortOrder: number
  readonly enabled: boolean
  readonly media: { readonly artworkId?: string }
}
export interface AuthoredItem extends AuthoredIdentity {
  readonly itemClass:
    'weapon' | 'armor' | 'accessory' | 'consumable' | 'tool' | 'material' | 'relic' | 'key'
  readonly usage: 'active' | 'passive' | 'none'
  readonly equipmentSlot: 'weapon' | 'armor' | 'accessory' | null
  readonly acquisition: 'unimplemented'
  readonly requirements: RequirementNode | null
  readonly ability: AbilityDefinition | null
}
export interface AuthoredTransformation extends AuthoredIdentity {
  readonly formName: string
  readonly requirements: RequirementNode | null
  readonly ability: AbilityDefinition | null
  readonly transformation: {
    readonly kind: 'ascension' | 'severence'
    readonly description: string
  }
}
/** These are the release prerequisites backed by current character progression facts. */
export type AuthoredDisciplineUnlock =
  | { readonly kind: 'always' }
  | {
      readonly kind: 'mastery'
      readonly disciplineId: string
      readonly minimumStage: DisciplineMasteryStage
    }
  | { readonly kind: 'rekindling'; readonly minimumCount: 1 | 2 | 3 }
  | { readonly kind: 'all'; readonly rules: readonly AuthoredDisciplineUnlock[] }
export interface AuthoredDiscipline extends AuthoredIdentity {
  readonly core: Readonly<
    Record<'might' | 'finesse' | 'vitality' | 'agility' | 'intellect' | 'resolve', number>
  >
  readonly focus: readonly string[]
  readonly enabledForPrimary: boolean
  readonly enabledForSecondary: boolean
  readonly linkedSkills: readonly string[]
  readonly unlock: AuthoredDisciplineUnlock | { readonly kind: 'unavailable' }
  /** Absent on retained Stage A drafts. Publication requires the complete producer envelope. */
  readonly atlas?: Pick<DisciplineAtlasEntry, 'family' | 'band' | 'disclosure' | 'power'>
  readonly skillStages?: readonly {
    readonly skillId: string
    readonly minimumStage: DisciplineMasteryStage
  }[]
  readonly essenceId?: string | null
  readonly resonanceSelections?: readonly {
    readonly withDisciplineId: string
    readonly resonanceId: string
  }[]
}
export interface AuthoredTag extends AuthoredIdentity {
  readonly tagId: string
  readonly explanation: string
}
export type NoncombatContentDefinition =
  AuthoredItem | AuthoredTransformation | AuthoredDiscipline | AuthoredTag
export function isNoncombatContentKind(value: unknown): value is NoncombatContentKind {
  return NONCOMBAT_CONTENT_KINDS.includes(value as NoncombatContentKind)
}
function invalid(path: string, message: string): never {
  throw new TypeError(`${path}: ${message}`)
}
function object(value: unknown, path: string, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid(path, 'Expected a record.')
  const row = value as Record<string, unknown>
  if (Object.keys(row).some((key) => !allowed.includes(key))) invalid(path, 'Unsupported field.')
  return row
}
function text(value: unknown, path: string, maximum: number): asserts value is string {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    [...value].length < 1 ||
    [...value].length > maximum ||
    [...value].some(
      (character) => character.codePointAt(0)! < 32 || character.codePointAt(0) === 127,
    )
  )
    invalid(path, 'Enter bounded, trimmed text.')
}
function id(value: unknown, path: string): asserts value is string {
  text(value, path, 160)
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/u.test(value))
    invalid(path, 'A stable lowercase identity is required.')
}
const COMMON = [
  'schemaVersion',
  'id',
  'contentVersion',
  'name',
  'description',
  'sortOrder',
  'enabled',
  'media',
]
const ATTRIBUTES = ['might', 'finesse', 'vitality', 'agility', 'intellect', 'resolve'] as const
function masteryStage(value: unknown, path: string): void {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5)
    invalid(path, 'Choose an implemented mastery stage from 1 to 5.')
}
function validateDisciplineUnlock(
  value: unknown,
  path: string,
  disciplineId: string,
  depth = 0,
): void {
  if (depth > 8) invalid(path, 'Prerequisites may nest at most 8 levels.')
  const row = object(value, path, ['kind', 'disciplineId', 'minimumStage', 'minimumCount', 'rules'])
  if (row.kind === 'always' || (row.kind === 'unavailable' && depth === 0)) {
    object(row, path, ['kind'])
  } else if (row.kind === 'mastery') {
    object(row, path, ['kind', 'disciplineId', 'minimumStage'])
    id(row.disciplineId, `${path}.disciplineId`)
    if (row.disciplineId === disciplineId)
      invalid(path, 'A Discipline cannot require its own mastery.')
    masteryStage(row.minimumStage, `${path}.minimumStage`)
  } else if (row.kind === 'rekindling') {
    object(row, path, ['kind', 'minimumCount'])
    if (![1, 2, 3].includes(row.minimumCount as number))
      invalid(path, 'Choose an implemented Rekindling count.')
  } else if (row.kind === 'all') {
    object(row, path, ['kind', 'rules'])
    if (!Array.isArray(row.rules) || row.rules.length < 1 || row.rules.length > 32)
      invalid(path, 'Use 1–32 supported prerequisites.')
    row.rules.forEach((rule, index) =>
      validateDisciplineUnlock(rule, `${path}.rules.${index}`, disciplineId, depth + 1),
    )
  } else invalid(path, 'This prerequisite has no authoritative progression producer.')
}
/** Finite authoring intents only. These records never grant ownership or activate a runtime. */
export function parseNoncombatContentDefinition(
  kind: NoncombatContentKind,
  value: unknown,
): NoncombatContentDefinition {
  const specific =
    kind === 'discipline'
      ? [
          'core',
          'focus',
          'enabledForPrimary',
          'enabledForSecondary',
          'linkedSkills',
          'unlock',
          'atlas',
          'skillStages',
          'essenceId',
          'resonanceSelections',
        ]
      : kind === 'tag'
        ? ['tagId', 'explanation']
        : kind === 'item'
          ? ['requirements', 'ability', 'itemClass', 'usage', 'equipmentSlot', 'acquisition']
          : ['requirements', 'ability', 'formName', 'transformation']
  const row = object(value, 'definition', [...COMMON, ...specific])
  if (row.schemaVersion !== 1) invalid('schemaVersion', 'Unsupported schema.')
  id(row.id, 'id')
  text(row.name, 'name', 120)
  text(row.description, 'description', 4000)
  if (!Number.isSafeInteger(row.contentVersion) || (row.contentVersion as number) < 1)
    invalid('contentVersion', 'Expected a positive version.')
  if (
    !Number.isSafeInteger(row.sortOrder) ||
    (row.sortOrder as number) < 0 ||
    (row.sortOrder as number) > 1000000
  )
    invalid('sortOrder', 'Expected 0–1000000.')
  if (typeof row.enabled !== 'boolean') invalid('enabled', 'Expected a boolean.')
  const media = object(row.media, 'media', ['artworkId'])
  if (media.artworkId !== undefined) id(media.artworkId, 'media.artworkId')
  if (kind === 'discipline') {
    const core = object(row.core, 'core', ATTRIBUTES)
    if (
      ATTRIBUTES.some((key) => !Number.isSafeInteger(core[key]) || (core[key] as number) < 1) ||
      ATTRIBUTES.reduce((sum, key) => sum + Number(core[key]), 0) !== 31
    )
      invalid('core', 'Six positive integer bases must total 31.')
    if (
      !Array.isArray(row.focus) ||
      row.focus.length < 2 ||
      row.focus.length > 3 ||
      new Set(row.focus).size !== row.focus.length ||
      row.focus.some((key) => !ATTRIBUTES.includes(key))
    )
      invalid('focus', 'Choose 2–3 distinct attributes; focus cap is 60 and other caps are 40.')
    if (typeof row.enabledForPrimary !== 'boolean' || typeof row.enabledForSecondary !== 'boolean')
      invalid('enabledForPrimary', 'Explicit enable flags are required.')
    if (
      !Array.isArray(row.linkedSkills) ||
      row.linkedSkills.length > 256 ||
      new Set(row.linkedSkills).size !== row.linkedSkills.length
    )
      invalid('linkedSkills', 'Use at most 256 distinct Skill references.')
    row.linkedSkills.forEach((key, index) => id(key, `linkedSkills.${index}`))
    validateDisciplineUnlock(row.unlock, 'unlock', row.id)
    const extended = ['atlas', 'skillStages', 'essenceId', 'resonanceSelections']
    if (
      extended.some((key) => Object.hasOwn(row, key)) ||
      (row.unlock as { kind: string }).kind !== 'unavailable'
    ) {
      const atlas = object(row.atlas, 'atlas', ['family', 'band', 'disclosure', 'power'])
      if (!['foundation', 'martial', 'hybrid', 'mage', 'support'].includes(atlas.family as string))
        invalid('atlas.family', 'Choose a supported Discipline family.')
      if (
        !['foundation', 'first-journey', 'rekindling-1', 'rekindling-2', 'rekindling-3'].includes(
          atlas.band as string,
        )
      )
        invalid('atlas.band', 'Choose a supported progression band.')
      // Secret revelation has no current persisted producer. Do not promise invented discovery.
      if (atlas.disclosure !== 'open')
        invalid('atlas.disclosure', 'Secret discovery authoring is not supported.')
      const axes = ['reliability', 'flexibility', 'setup', 'ruleAccess', 'execution']
      const power = object(atlas.power, 'atlas.power', axes)
      if (
        axes.some(
          (axis) =>
            !Number.isInteger(power[axis]) || Number(power[axis]) < 1 || Number(power[axis]) > 5,
        )
      )
        invalid('atlas.power', 'Every power axis must be an integer from 1 to 5.')
      if (!Array.isArray(row.skillStages) || row.skillStages.length !== row.linkedSkills.length)
        invalid('skillStages', 'Every linked Skill needs exactly one earned progression stage.')
      const seen = new Set<string>()
      row.skillStages.forEach((value, index) => {
        const path = `skillStages.${index}`
        const stage = object(value, path, ['skillId', 'minimumStage'])
        id(stage.skillId, `${path}.skillId`)
        if (!(row.linkedSkills as string[]).includes(stage.skillId) || seen.has(stage.skillId))
          invalid(path, 'Stage references must match the distinct linked Skills.')
        seen.add(stage.skillId)
        masteryStage(stage.minimumStage, `${path}.minimumStage`)
      })
      if (row.essenceId !== null) id(row.essenceId, 'essenceId')
      if (!Array.isArray(row.resonanceSelections) || row.resonanceSelections.length > 256)
        invalid('resonanceSelections', 'Use at most 256 explicit Discipline pair selections.')
      const pairs = new Set<string>()
      row.resonanceSelections.forEach((value, index) => {
        const path = `resonanceSelections.${index}`
        const pair = object(value, path, ['withDisciplineId', 'resonanceId'])
        id(pair.withDisciplineId, `${path}.withDisciplineId`)
        id(pair.resonanceId, `${path}.resonanceId`)
        if (pair.withDisciplineId === row.id || pairs.has(pair.withDisciplineId))
          invalid(path, 'Choose each other Discipline at most once.')
        pairs.add(pair.withDisciplineId)
      })
    }
  } else if (kind === 'tag') {
    text(row.tagId, 'tagId', 160)
    if (!combatTagDefinition(row.tagId)) invalid('tagId', 'Choose an implemented registry Tag.')
    text(row.explanation, 'explanation', 2000)
  } else {
    const issues = validateAbilityRequirements(row.requirements)
    if (issues.length) invalid(issues[0]!.path, issues[0]!.message)
    if (row.ability !== null) parseAbilityDefinition(row.ability)
    if (kind === 'item') {
      if (
        ![
          'weapon',
          'armor',
          'accessory',
          'consumable',
          'tool',
          'material',
          'relic',
          'key',
        ].includes(row.itemClass as string)
      )
        invalid('itemClass', 'Choose a supported Item class.')
      if (!['active', 'passive', 'none'].includes(row.usage as string))
        invalid('usage', 'Choose an authored usage intent.')
      if (
        row.equipmentSlot !== null &&
        !['weapon', 'armor', 'accessory'].includes(row.equipmentSlot as string)
      )
        invalid('equipmentSlot', 'Choose a supported equipment intent.')
      if (row.equipmentSlot !== null && row.itemClass !== row.equipmentSlot)
        invalid('equipmentSlot', 'The slot must match the Item class.')
      if (row.acquisition !== 'unimplemented')
        invalid('acquisition', 'Acquisition and inventory runtime are not implemented.')
    } else {
      text(row.formName, 'formName', 120)
      const transformation = object(row.transformation, 'transformation', ['kind', 'description'])
      if (transformation.kind !== kind)
        invalid('transformation.kind', 'The transformation intent must match its category.')
      text(transformation.description, 'transformation.description', 2000)
    }
  }
  return structuredClone(value) as NoncombatContentDefinition
}
export function noncombatPublicationBlocker(kind: NoncombatContentKind): {
  readonly path: string
  readonly code: string
  readonly message: string
} {
  const messages = {
    discipline: 'Authored Discipline admission and Core projection are not available yet.',
    tag: 'Versioned Tag presentation readers are not available yet.',
    item: 'Item acquisition, inventory, equipment and consumption adapters are not implemented.',
    ascension: 'Ascension ownership, progression and activation are not implemented.',
    severence: 'Severence ownership, progression and activation are not implemented.',
  }
  return { path: 'contentKind', code: `${kind}-runtime-unsupported`, message: messages[kind] }
}
