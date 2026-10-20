import { parseAbilityDefinition, type AbilityDefinition } from '../combat/combat-definition'
import { validateAbilityRequirements, type RequirementNode } from '../combat/combat-requirements'
import { combatTagDefinition } from '../combat/combat-tag-registry'

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
export interface AuthoredDiscipline extends AuthoredIdentity {
  readonly core: Readonly<
    Record<'might' | 'finesse' | 'vitality' | 'agility' | 'intellect' | 'resolve', number>
  >
  readonly focus: readonly string[]
  readonly enabledForPrimary: boolean
  readonly enabledForSecondary: boolean
  readonly linkedSkills: readonly string[]
  readonly unlock: { readonly kind: 'unavailable' }
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
/** Finite authoring intents only. These records never grant ownership or activate a runtime. */
export function parseNoncombatContentDefinition(
  kind: NoncombatContentKind,
  value: unknown,
): NoncombatContentDefinition {
  const specific =
    kind === 'discipline'
      ? ['core', 'focus', 'enabledForPrimary', 'enabledForSecondary', 'linkedSkills', 'unlock']
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
    if (object(row.unlock, 'unlock', ['kind']).kind !== 'unavailable')
      invalid('unlock', 'Authored Discipline admission is not available yet.')
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
