import {
  parseItemEquipRequirements,
  type ItemEquipRequirements,
} from '../character/item-equip-requirements'
import { parseAbilityDefinition, type AbilityDefinition } from '../combat/combat-definition'
import { isFinalizedContentMedia, type FinalizedContentImage } from '../combat/content-media'
import type { AuthoredItem } from './authored-content'
export const ITEM_INVENTORY_CATEGORIES = [
  'gear',
  'battle-items',
  'materials',
  'general',
  'event',
  'companion',
] as const
export type ItemInventoryCategory = (typeof ITEM_INVENTORY_CATEGORIES)[number]
export type ItemClass =
  'armor' | 'hand-armor' | 'weapon' | 'battle-item' | 'material' | 'general' | 'event' | 'companion'
export type ItemTier = 'D' | 'C' | 'B' | 'A' | 'S'
export interface ItemArtworkMedia {
  readonly artworkId?: string
  readonly artwork?: FinalizedContentImage
}
export interface ItemActionBinding {
  readonly media?: ItemArtworkMedia
  readonly behaviorId: string
  readonly name: string
}
export interface RuntimeItemDefinition {
  readonly schemaVersion: 2
  readonly id: string
  readonly contentVersion: number
  readonly name: string
  readonly description: string
  readonly sortOrder: number
  readonly enabled: boolean
  readonly media: ItemArtworkMedia
  readonly inventoryCategory: ItemInventoryCategory
  readonly itemClass: ItemClass
  readonly tier: ItemTier
  readonly qualityPoints: number
  readonly equipment: {
    readonly slot: 'head' | 'body' | 'pants' | 'boots' | 'hand'
    readonly hands: 1 | 2
  } | null
  readonly maximumStack: number
  readonly requirements: null
  readonly equipRequirements?: ItemEquipRequirements
  readonly ability: AbilityDefinition | null
  readonly actions?: {
    readonly attack?: ItemActionBinding
    readonly support?: ItemActionBinding
    readonly use?: ItemActionBinding
  }
  readonly battleUses: number | null
  readonly consumeOnUse: false
  readonly tags: readonly string[]
}
export type ItemDefinition = AuthoredItem | RuntimeItemDefinition
const fail = (path: string, message: string): never => {
  throw new TypeError(`${path}: ${message}`)
}
function record(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'Expected a record.')
  const row = value as Record<string, unknown>
  if (Object.keys(row).some((key) => !keys.includes(key))) fail(path, 'Unsupported field.')
  return row
}
function text(value: unknown, path: string, max: number): asserts value is string {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    ![...value].length ||
    [...value].length > max ||
    [...value].some(
      (character) => character.codePointAt(0)! < 32 || character.codePointAt(0) === 127,
    )
  )
    fail(path, 'Enter bounded trimmed text.')
}
function identity(value: unknown, path: string) {
  text(value, path, 160)
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/u.test(value)) fail(path, 'Expected a stable identity.')
}
function integer(value: unknown, min: number, max: number, path: string) {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max)
    fail(path, `Expected integer ${min}–${max}.`)
}
/** Strict executable boundary; retained V1 is deliberately parsed by authored-content. */
export function parseRuntimeItemDefinition(value: unknown): RuntimeItemDefinition {
  const row = record(value, 'item', [
    'schemaVersion',
    'id',
    'contentVersion',
    'name',
    'description',
    'sortOrder',
    'enabled',
    'media',
    'inventoryCategory',
    'itemClass',
    'tier',
    'qualityPoints',
    'equipment',
    'maximumStack',
    'requirements',
    'equipRequirements',
    'ability',
    'actions',
    'battleUses',
    'consumeOnUse',
    'tags',
  ])
  if (row.schemaVersion !== 2) fail('schemaVersion', 'Expected Item V2.')
  identity(row.id, 'id')
  text(row.name, 'name', 120)
  text(row.description, 'description', 4000)
  integer(row.contentVersion, 1, Number.MAX_SAFE_INTEGER, 'contentVersion')
  integer(row.sortOrder, 0, 1000000, 'sortOrder')
  if (typeof row.enabled !== 'boolean') fail('enabled', 'Expected a boolean.')
  const media = record(row.media, 'media', ['artworkId', 'artwork'])
  if (media.artworkId !== undefined) identity(media.artworkId, 'media.artworkId')
  if (
    media.artwork !== undefined &&
    (!isFinalizedContentMedia(media.artwork) || media.artwork.kind !== 'image')
  )
    fail('media.artwork', 'Expected a finalized image.')
  if (!media.artwork && !media.artworkId) fail('media', 'Artwork is required.')
  if (!ITEM_INVENTORY_CATEGORIES.includes(row.inventoryCategory as ItemInventoryCategory))
    fail('inventoryCategory', 'Choose a category.')
  const categories: Record<ItemClass, ItemInventoryCategory> = {
    armor: 'gear',
    'hand-armor': 'gear',
    weapon: 'gear',
    'battle-item': 'battle-items',
    material: 'materials',
    general: 'general',
    event: 'event',
    companion: 'companion',
  }
  if (
    typeof row.itemClass !== 'string' ||
    !Object.hasOwn(categories, row.itemClass) ||
    categories[row.itemClass as ItemClass] !== row.inventoryCategory
  )
    fail('itemClass', 'Class and inventory category must agree.')
  if (typeof row.tier !== 'string' || !['D', 'C', 'B', 'A', 'S'].includes(row.tier))
    fail('tier', 'Choose D, C, B, A or S.')
  const equippable = ['armor', 'hand-armor', 'weapon', 'battle-item'].includes(
    String(row.itemClass),
  )
  integer(row.qualityPoints, equippable ? 1 : 0, equippable ? 100 : 0, 'qualityPoints')
  integer(row.maximumStack, 1, row.inventoryCategory === 'gear' ? 1 : 99, 'maximumStack')
  if (equippable) {
    const equipment = record(row.equipment, 'equipment', ['slot', 'hands'])
    if (![1, 2].includes(Number(equipment.hands)) || typeof equipment.hands !== 'number')
      fail('equipment.hands', 'Choose one or two hands.')
    if (row.itemClass === 'armor') {
      if (
        typeof equipment.slot !== 'string' ||
        !['head', 'body', 'pants', 'boots'].includes(equipment.slot) ||
        equipment.hands !== 1
      )
        fail('equipment', 'Choose an exact armor slot and one unit.')
    } else if (equipment.slot !== 'hand' || (equipment.hands === 2 && row.itemClass !== 'weapon'))
      fail('equipment', 'Only weapons may occupy two hands.')
  } else if (row.equipment !== null) fail('equipment', 'Non-equippable items require null.')
  if (row.equipRequirements !== undefined) {
    if (!equippable) fail('equipRequirements', 'Only equippable Items have equip requirements.')
    parseItemEquipRequirements(row.equipRequirements)
  }
  if (row.requirements !== null)
    fail('requirements', 'Item wrapper Requirements must be null; use ability Requirements.')
  if (row.consumeOnUse !== false) fail('consumeOnUse', 'Persistent consumption is not implemented.')
  if (
    !Array.isArray(row.tags) ||
    row.tags.length > 32 ||
    new Set(row.tags).size !== row.tags.length
  )
    fail('tags', 'Use at most 32 unique identity tags.')
  for (const tag of row.tags as unknown[]) identity(tag, 'tags')
  const ability = row.ability === null ? null : parseAbilityDefinition(row.ability)
  if (!equippable && ability !== null)
    fail('ability', 'Noncombat samples cannot execute abilities.')
  const actions =
    row.actions === undefined ? {} : record(row.actions, 'actions', ['attack', 'support', 'use'])
  const bound = new Set<string>()
  for (const [role, value] of Object.entries(actions)) {
    const binding = record(value, `actions.${role}`, ['behaviorId', 'name', 'media'])
    if (binding.media !== undefined) {
      if (role !== 'support' || row.itemClass !== 'weapon')
        fail(`actions.${role}.media`, 'Only weapon techniques have independent artwork.')
      const media = record(binding.media, `actions.${role}.media`, ['artworkId', 'artwork'])
      if (media.artworkId !== undefined)
        identity(media.artworkId, `actions.${role}.media.artworkId`)
      if (
        media.artwork !== undefined &&
        (!isFinalizedContentMedia(media.artwork) || media.artwork.kind !== 'image')
      )
        fail(`actions.${role}.media.artwork`, 'Expected a finalized image.')
    }
    identity(binding.behaviorId, `actions.${role}.behaviorId`)
    text(binding.name, `actions.${role}.name`, 120)
    const behavior = ability?.behaviors.find((b) => b.id === binding.behaviorId)
    if (
      !behavior ||
      behavior.activation !== 'manual' ||
      behavior.mode !== 'action' ||
      bound.has(behavior.id)
    )
      fail(`actions.${role}`, 'Bind a distinct manual action in this Item.')
    bound.add(behavior!.id)
    if (
      (role === 'attack' && row.itemClass !== 'weapon') ||
      (role === 'use' && row.itemClass !== 'battle-item')
    )
      fail(`actions.${role}`, 'This binding is incompatible with the Item class.')
  }
  if (ability?.behaviors.some((b) => b.activation === 'manual' && !bound.has(b.id)))
    fail('actions', 'Every manual action must be bound.')
  if (row.itemClass === 'weapon' && !actions.attack)
    fail('actions.attack', 'A weapon requires an attack.')
  if (row.itemClass === 'battle-item') {
    if (!actions.use || Object.keys(actions).length !== 1 || ability?.behaviors.length !== 1)
      fail('actions.use', 'Consumables require exactly one Manual use behavior and no siblings.')
    integer(row.battleUses, 1, 99, 'battleUses')
  } else if (row.battleUses !== null) fail('battleUses', 'Only Consumables have per-battle uses.')
  return structuredClone({ ...row, ability }) as unknown as RuntimeItemDefinition
}

/** Captured absence stays literal: never consult a newer catalogue definition. */
export function itemActionMedia(
  definition: RuntimeItemDefinition,
  role: 'attack' | 'support' | 'use',
): ItemArtworkMedia {
  const technique = role === 'support' ? definition.actions?.support?.media : undefined
  return technique?.artwork || technique?.artworkId ? technique : definition.media
}
