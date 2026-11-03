import 'server-only'
import { parseRuntimeItemDefinition } from '@aurevane/game-core/content/items'
import { ITEM_INVENTORY_CATEGORIES } from '@aurevane/game-core/content/items'
import {
  EQUIPMENT_POSITIONS,
  type ItemInventorySnapshot,
} from '@aurevane/game-core/character/item-inventory'
import { parseCurrentSupportActionId } from '@aurevane/game-core/combat/support-actions'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { CharacterItemsRepository, CharacterItemsState } from './character-items-service'
export type ItemRpc = (
  name: string,
  parameters: Readonly<Record<string, unknown>>,
) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum
function unavailable(): never {
  throw new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'The server returned invalid Item inventory data.',
  )
}
export function throwItemRpcError(error: { code?: string; message?: string }): never {
  const message = error.message ?? ''
  if (error.code === '40001' || /ITEM_STALE_/.test(message))
    throw new AurevaneError('STALE_VERSION', 'Items changed. Refresh and try again.')
  if (error.code === '42501')
    throw new AurevaneError(
      'FORBIDDEN',
      'This character or Item operation is not available to your account.',
    )
  const messages: Record<string, string> = {
    ITEM_BATTLE_ACTIVE: 'Items cannot change during a pending or active battle.',
    ITEM_CAPACITY: 'This inventory category is full.',
    ITEM_DELETION_PENDING: 'This character is pending deletion.',
    ITEM_GRANT_CONFLICT: 'This grant request has already been used for different Items.',
    ITEM_TEST_GRANT_INVALID: 'Choose a current Item and a quantity from 1 to 99 (one for Gear).',
  }
  if (messages[message]) throw new AurevaneError('INVALID_REQUEST', messages[message]!)
  if (error.code === '22023' && message.startsWith('ITEM_'))
    throw new AurevaneError(
      'INVALID_REQUEST',
      'The Item change is no longer valid. Refresh your inventory.',
    )
  throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Items are unavailable right now.', {
    cause: error,
  })
}
export function parseCharacterItemsState(value: unknown, characterId: string): CharacterItemsState {
  if (
    !object(value) ||
    !object(value.snapshot) ||
    !object(value.definitions) ||
    typeof value.catalogueToken !== 'string' ||
    !/^[a-f0-9]{32}$/.test(value.catalogueToken) ||
    typeof value.battleLocked !== 'boolean'
  )
    unavailable()
  const s = value.snapshot
  if (
    s.characterId !== characterId ||
    !integer(s.revision, 0) ||
    !Array.isArray(s.stacks) ||
    s.stacks.length > 240 ||
    !object(s.equipment) ||
    !object(s.selectedSupport) ||
    !parseCurrentSupportActionId(s.previousBasicSupport) ||
    !Array.isArray(s.grants)
  )
    unavailable()
  const ids = new Set<string>(),
    slots = new Set<string>()
  for (const stack of s.stacks) {
    if (
      !object(stack) ||
      typeof stack.id !== 'string' ||
      ids.has(stack.id) ||
      stack.characterId !== characterId ||
      typeof stack.itemId !== 'string' ||
      !ITEM_INVENTORY_CATEGORIES.includes(stack.inventoryCategory as never) ||
      !integer(stack.slotIndex, 0, 39) ||
      !integer(stack.quantity, 1, 99) ||
      !integer(stack.acquiredContentVersion, 1) ||
      typeof stack.acquiredAt !== 'string' ||
      typeof stack.provenance !== 'string'
    )
      unavailable()
    const slot = `${stack.inventoryCategory}:${stack.slotIndex}`
    if (slots.has(slot)) unavailable()
    ids.add(stack.id)
    slots.add(slot)
  }
  for (const [position, id] of Object.entries(s.equipment))
    if (!EQUIPMENT_POSITIONS.includes(position as never) || typeof id !== 'string' || !ids.has(id))
      unavailable()
  const selected = s.selectedSupport
  if (
    selected.kind === 'basic'
      ? !parseCurrentSupportActionId(selected.actionId)
      : selected.kind !== 'equipment' ||
        !EQUIPMENT_POSITIONS.includes(selected.position as never) ||
        typeof selected.itemId !== 'string' ||
        typeof selected.behaviorId !== 'string'
  )
    unavailable()
  const definitions: Record<string, ReturnType<typeof parseRuntimeItemDefinition>> = {}
  try {
    for (const [id, definition] of Object.entries(value.definitions)) {
      if (definition === null) continue
      const parsed = parseRuntimeItemDefinition(definition)
      if (parsed.id !== id) unavailable()
      definitions[id] = parsed
    }
  } catch {
    unavailable()
  }
  return {
    snapshot: structuredClone(s) as unknown as ItemInventorySnapshot,
    definitions,
    catalogueToken: value.catalogueToken,
    battleLocked: value.battleLocked,
  }
}
export function createRpcCharacterItemsRepository(rpc: ItemRpc): CharacterItemsRepository {
  async function call(name: string, parameters: Readonly<Record<string, unknown>>) {
    const { data, error } = await rpc(name, parameters)
    if (error) throwItemRpcError(error)
    return data
  }
  return {
    async read(userId, characterId) {
      return parseCharacterItemsState(
        await call('read_character_items_view_v1', {
          p_user_id: userId,
          p_character_id: characterId,
        }),
        characterId,
      )
    },
    async write(userId, characterId, expectedRevision, catalogueToken, command) {
      const data = await call('write_character_items_v1', {
        p_user_id: userId,
        p_character_id: characterId,
        p_expected_revision: expectedRevision,
        p_catalogue_token: catalogueToken,
        p_command: command,
      })
      if (
        !object(data) ||
        !Array.isArray(data.notices) ||
        data.notices.some((notice) => notice !== 'equipment-support-removed')
      )
        unavailable()
      return {
        state: parseCharacterItemsState(data.state, characterId),
        notices: data.notices as 'equipment-support-removed'[],
      }
    },
    async grant(userId, characterId, expectedRevision, key, items) {
      await call('grant_character_items_v1', {
        p_user_id: userId,
        p_character_id: characterId,
        p_expected_revision: expectedRevision,
        p_grant_key: key,
        p_items: items,
      })
    },
  }
}
export function createSupabaseCharacterItemsRepository(): CharacterItemsRepository {
  const client = createSupabaseAdminClient()
  return createRpcCharacterItemsRepository((name, parameters) => client.rpc(name, parameters))
}
