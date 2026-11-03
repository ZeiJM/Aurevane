import 'server-only'
import {
  EQUIPMENT_POSITIONS,
  equipInventoryItem,
  unequipInventoryItem,
  selectInventorySupport,
  sortItemInventory,
  validateEquipmentLoadout,
  type ItemInventorySnapshot,
  type ItemCatalogue,
  type EquipmentAssignments,
  type EquipmentPosition,
  type ItemSupportSelection,
  type ItemInventorySort,
  type InventoryItemGrant,
  type ItemInventoryIssue,
} from '@aurevane/game-core/character/item-inventory'
import {
  ITEM_INVENTORY_CATEGORIES,
  type ItemInventoryCategory,
} from '@aurevane/game-core/content/items'
import { parseCurrentSupportActionId } from '@aurevane/game-core/combat/support-actions'
import { AurevaneError } from '@aurevane/game-core/errors'
import { presentItem, type ItemPresentation } from '@/lib/items/item-presentation'

export type StarterItemNotice =
  'starter-items-deferred-capacity' | 'starter-items-deferred-battle' | 'starter-items-unavailable'
export interface CharacterItemsState {
  readonly starterNotice?: StarterItemNotice
  readonly snapshot: ItemInventorySnapshot
  readonly definitions: ItemCatalogue
  readonly catalogueToken: string
  readonly battleLocked: boolean
}
export type ItemInventoryWrite =
  | {
      readonly action: 'equipment'
      readonly equipment: EquipmentAssignments
      readonly selectedSupport: ItemSupportSelection
      readonly replacePositions: readonly EquipmentPosition[]
    }
  | {
      readonly action: 'sort'
      readonly category: ItemInventoryCategory
      readonly stackIds: readonly string[]
    }
export interface CharacterItemsRepository {
  read(userId: string, characterId: string): Promise<CharacterItemsState>
  write(
    userId: string,
    characterId: string,
    expectedRevision: number,
    catalogueToken: string,
    command: ItemInventoryWrite,
  ): Promise<{ state: CharacterItemsState; notices: readonly 'equipment-support-removed'[] }>
  /** Trusted server acquisition only. Never expose this method through player intent parsing. */
  grant(
    userId: string,
    characterId: string,
    expectedRevision: number,
    key: string,
    items: readonly InventoryItemGrant[],
  ): Promise<void>
}
export interface CharacterItemsView {
  readonly characterId: string
  readonly revision: number
  readonly catalogueToken: string
  readonly battleLocked: boolean
  readonly qualityPoints: number
  readonly qualityPointLimit: 100
  readonly equipmentIssue: ItemInventoryIssue | null
  readonly equipment: EquipmentAssignments
  readonly selectedSupport: ItemSupportSelection
  readonly stacks: readonly {
    readonly id: string
    readonly itemId: string
    readonly inventoryCategory: ItemInventoryCategory
    readonly slotIndex: number
    readonly quantity: number
    readonly item: ItemPresentation | null
  }[]
  readonly notices: readonly ('equipment-support-removed' | StarterItemNotice)[]
}
export function characterItemsView(
  state: CharacterItemsState,
  notices: CharacterItemsView['notices'] = [],
): CharacterItemsView {
  const { snapshot, definitions } = state
  const validation = validateEquipmentLoadout(snapshot, definitions)
  const qualityPoints = Object.values(snapshot.equipment).reduce((sum, stackId) => {
    const stack = snapshot.stacks.find((row) => row.id === stackId)
    const definition = stack ? definitions[stack.itemId] : undefined
    return sum + (definition?.schemaVersion === 2 ? definition.qualityPoints : 0)
  }, 0)
  return {
    characterId: snapshot.characterId,
    revision: snapshot.revision,
    catalogueToken: state.catalogueToken,
    battleLocked: state.battleLocked,
    qualityPoints,
    qualityPointLimit: 100,
    equipmentIssue: validation.ok ? null : validation.issue,
    equipment: { ...snapshot.equipment },
    selectedSupport: { ...snapshot.selectedSupport },
    notices: [...notices, ...(state.starterNotice ? [state.starterNotice] : [])],
    stacks: snapshot.stacks.map((stack) => {
      const definition = definitions[stack.itemId]
      return {
        id: stack.id,
        itemId: stack.itemId,
        inventoryCategory: stack.inventoryCategory,
        slotIndex: stack.slotIndex,
        quantity: stack.quantity,
        item: definition?.schemaVersion === 2 ? presentItem(definition) : null,
      }
    }),
  }
}
export async function loadCharacterItems(
  userId: string,
  characterId: string,
  repository: CharacterItemsRepository,
): Promise<CharacterItemsView> {
  return characterItemsView(await repository.read(userId, characterId))
}
function invalid(message: string): never {
  throw new AurevaneError('INVALID_REQUEST', message)
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function position(value: unknown): EquipmentPosition {
  if (!EQUIPMENT_POSITIONS.includes(value as EquipmentPosition))
    invalid('Choose a valid equipment position.')
  return value as EquipmentPosition
}
function selection(value: unknown): ItemSupportSelection {
  if (!object(value)) invalid('Choose a valid Support Action.')
  if (
    value.kind === 'basic' &&
    Object.keys(value).every((key) => ['kind', 'actionId'].includes(key))
  ) {
    const actionId = parseCurrentSupportActionId(value.actionId)
    if (actionId) return { kind: 'basic', actionId }
  }
  if (
    value.kind === 'equipment' &&
    Object.keys(value).every((key) => ['kind', 'position', 'itemId', 'behaviorId'].includes(key)) &&
    typeof value.itemId === 'string' &&
    typeof value.behaviorId === 'string'
  )
    return {
      kind: 'equipment',
      position: position(value.position),
      itemId: value.itemId,
      behaviorId: value.behaviorId,
    }
  return invalid('Choose a valid Support Action.')
}
/** External commands carry intent only; ownership/QP/battle locks/CAS are enforced again atomically in SQL. */
export async function mutateCharacterItems(
  userId: string,
  characterId: string,
  input: unknown,
  repository: CharacterItemsRepository,
): Promise<CharacterItemsView> {
  const fields: Record<string, readonly string[]> = {
    equip: ['stackId', 'position', 'replacePositions'],
    unequip: ['position'],
    support: ['selection'],
    sort: ['category', 'order'],
  }
  if (
    !object(input) ||
    typeof input.action !== 'string' ||
    !fields[input.action] ||
    Object.keys(input).some(
      (key) =>
        ![
          'action',
          'expectedRevision',
          'catalogueToken',
          ...fields[input.action as string]!,
        ].includes(key),
    )
  )
    invalid('Choose a supported Item command without extra fields.')
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    (input.expectedRevision as number) < 0 ||
    typeof input.catalogueToken !== 'string'
  )
    invalid('Refresh the inventory revision and catalogue.')
  const current = await repository.read(userId, characterId)
  if (
    current.snapshot.revision !== input.expectedRevision ||
    current.catalogueToken !== input.catalogueToken
  )
    throw new AurevaneError('STALE_VERSION', 'Items changed. Refresh the inventory and try again.')
  if (current.battleLocked) invalid('Items cannot change during a pending or active battle.')
  const { snapshot, definitions } = current
  const revision = input.expectedRevision as number
  let result
  let replacePositions: EquipmentPosition[] = []
  let category: ItemInventoryCategory | undefined
  switch (input.action) {
    case 'equip':
      if (typeof input.stackId !== 'string' || input.stackId.length > 160)
        invalid('Choose an owned Item stack.')
      if (input.replacePositions !== undefined && !Array.isArray(input.replacePositions))
        invalid('Choose explicit swap positions.')
      replacePositions = ((input.replacePositions ?? []) as unknown[]).map(position)
      result = equipInventoryItem(
        snapshot,
        definitions,
        revision,
        input.stackId,
        position(input.position),
        replacePositions,
      )
      break
    case 'unequip':
      replacePositions = [position(input.position)]
      result = unequipInventoryItem(snapshot, definitions, revision, replacePositions[0]!)
      break
    case 'support':
      result = selectInventorySupport(snapshot, definitions, revision, selection(input.selection))
      break
    case 'sort': {
      if (!ITEM_INVENTORY_CATEGORIES.includes(input.category as ItemInventoryCategory))
        invalid('Choose an inventory category.')
      category = input.category as ItemInventoryCategory
      if (
        !(
          Array.isArray(input.order) &&
          input.order.length <= 40 &&
          input.order.every((id) => typeof id === 'string')
        ) &&
        !['name', 'tier', 'quality-points', 'quantity', 'newest', 'class'].includes(
          input.order as string,
        )
      )
        invalid('Choose a valid inventory order.')
      result = sortItemInventory(
        snapshot,
        definitions,
        revision,
        category,
        input.order as ItemInventorySort | string[],
      )
      break
    }
    default:
      return invalid('Choose a supported Item command.')
  }
  if (!result.ok) invalid(result.issue.message)
  const command: ItemInventoryWrite = category
    ? {
        action: 'sort',
        category,
        stackIds: result.snapshot.stacks
          .filter((row) => row.inventoryCategory === category)
          .sort((a, b) => a.slotIndex - b.slotIndex)
          .map((row) => row.id),
      }
    : {
        action: 'equipment',
        equipment: result.snapshot.equipment,
        selectedSupport:
          input.action === 'support' ? result.snapshot.selectedSupport : snapshot.selectedSupport,
        replacePositions,
      }
  const saved = await repository.write(
    userId,
    characterId,
    revision,
    current.catalogueToken,
    command,
  )
  return characterItemsView(saved.state, saved.notices)
}
/** Reusable idempotent acquisition hook; its manifest must come from trusted server source. */
export async function grantCharacterItems(
  userId: string,
  characterId: string,
  manifest: { readonly key: string; readonly items: readonly InventoryItemGrant[] },
  repository: CharacterItemsRepository,
): Promise<CharacterItemsView> {
  const state = await repository.read(userId, characterId)
  await repository.grant(userId, characterId, state.snapshot.revision, manifest.key, manifest.items)
  return loadCharacterItems(userId, characterId, repository)
}
