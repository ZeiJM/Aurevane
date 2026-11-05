import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { ItemGrantCharacter, ItemGrantRequest } from '@/master/item-grant'
import { toServerErrorResponse } from '@/server/http/error-response'
import { throwItemRpcError, type ItemRpc } from '../character/supabase-character-items-repository'

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/.test(value)
const revision = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0
const token = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value)
function invalid(): never {
  throw new AurevaneError(
    'INVALID_REQUEST',
    'Choose a character, a current Item and a quantity from 1 to 99 (one for Gear). Refresh changed inventory before trying again.',
  )
}
function unavailable(): never {
  throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The server returned invalid Item grant data.')
}
function parseInput(input: unknown): ItemGrantRequest {
  if (!object(input)) invalid()
  const keys =
    input.action === 'search'
      ? ['action', 'query']
      : input.action === 'read'
        ? ['action', 'characterId']
        : [
            'action',
            'characterId',
            'itemId',
            'quantity',
            'expectedRevision',
            'catalogueToken',
            'requestId',
          ]
  if (Object.keys(input).some((key) => !keys.includes(key))) invalid()
  if (input.action === 'search') {
    if (
      typeof input.query !== 'string' ||
      input.query.trim().length < 2 ||
      input.query.trim().length > 80
    )
      invalid()
    return { action: 'search', query: input.query.trim() }
  }
  if (!uuid(input.characterId)) invalid()
  if (input.action === 'read') return { action: 'read', characterId: input.characterId }
  if (
    input.action !== 'grant' ||
    typeof input.itemId !== 'string' ||
    input.itemId.trim().length < 1 ||
    input.itemId.length > 160 ||
    !Number.isSafeInteger(input.quantity) ||
    (input.quantity as number) < 1 ||
    (input.quantity as number) > 99 ||
    !revision(input.expectedRevision) ||
    !token(input.catalogueToken) ||
    !uuid(input.requestId)
  )
    invalid()
  return input as ItemGrantRequest
}
function parseCharacter(value: unknown): ItemGrantCharacter {
  if (
    !object(value) ||
    !uuid(value.characterId) ||
    typeof value.name !== 'string' ||
    !value.name.trim()
  )
    unavailable()
  return { characterId: value.characterId, name: value.name }
}
export function createMasterTargetItemGrantHandler(dependencies: {
  selected(): Promise<{ userId: string; characterId: string }>
  rpc: ItemRpc
}) {
  return async (request: Request): Promise<Response> => {
    try {
      const actor = await dependencies.selected()
      let body: unknown
      try {
        body = await request.json()
      } catch {
        invalid()
      }
      const input = parseInput(body)
      const actorParameters = {
        p_actor_user_id: actor.userId,
        p_actor_character_id: actor.characterId,
      }
      const name =
        input.action === 'search'
          ? 'search_master_item_grant_characters_v1'
          : input.action === 'read'
            ? 'read_master_item_grant_target_v1'
            : 'grant_master_item_to_character_v1'
      const parameters =
        input.action === 'search'
          ? { ...actorParameters, p_query: input.query }
          : input.action === 'read'
            ? { ...actorParameters, p_character_id: input.characterId }
            : {
                ...actorParameters,
                p_character_id: input.characterId,
                p_item_id: input.itemId,
                p_quantity: input.quantity,
                p_expected_revision: input.expectedRevision,
                p_catalogue_token: input.catalogueToken,
                p_request_key: input.requestId,
              }
      const { data, error } = await dependencies.rpc(name, parameters)
      if (error) throwItemRpcError(error)
      if (!object(data)) unavailable()
      let result: unknown
      if (input.action === 'search') {
        if (!Array.isArray(data.characters) || data.characters.length > 20) unavailable()
        result = { characters: data.characters.map(parseCharacter) }
      } else {
        const target = parseCharacter(data.target)
        if (target.characterId !== input.characterId || !revision(data.revision)) unavailable()
        if (input.action === 'read') {
          if (!token(data.catalogueToken) || typeof data.battleLocked !== 'boolean') unavailable()
          result = {
            target,
            revision: data.revision,
            catalogueToken: data.catalogueToken,
            battleLocked: data.battleLocked,
          }
        } else result = { target, revision: data.revision }
      }
      return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
      return toServerErrorResponse(error)
    }
  }
}
