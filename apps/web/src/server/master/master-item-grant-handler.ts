import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { toServerErrorResponse } from '@/server/http/error-response'
import { characterItemsView } from '../character/character-items-service'
import {
  parseCharacterItemsState,
  throwItemRpcError,
  type ItemRpc,
} from '../character/supabase-character-items-repository'
export function createMasterItemGrantHandler(dependencies: {
  selected(): Promise<{ userId: string; characterId: string }>
  rpc: ItemRpc
}) {
  return async (request: Request): Promise<Response> => {
    try {
      const actor = await dependencies.selected()
      let input: unknown
      try {
        input = await request.json()
      } catch {
        throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
      }
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new AurevaneError('INVALID_REQUEST', 'A test Item grant is required.')
      const body = input as Record<string, unknown>
      if (
        Object.keys(body).some(
          (key) =>
            ![
              'characterId',
              'itemId',
              'quantity',
              'expectedRevision',
              'catalogueToken',
              'requestId',
            ].includes(key),
        ) ||
        body.characterId !== actor.characterId ||
        typeof body.itemId !== 'string' ||
        body.itemId.length > 160 ||
        !Number.isSafeInteger(body.quantity) ||
        (body.quantity as number) < 1 ||
        (body.quantity as number) > 99 ||
        !Number.isSafeInteger(body.expectedRevision) ||
        (body.expectedRevision as number) < 0 ||
        typeof body.catalogueToken !== 'string' ||
        !/^[a-f0-9]{32}$/.test(body.catalogueToken) ||
        typeof body.requestId !== 'string' ||
        !/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/.test(body.requestId)
      )
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Choose one current Item and the selected owned test character. Refresh changed inventory before trying again.',
        )
      const { data, error } = await dependencies.rpc('grant_master_test_item_v1', {
        p_actor_user_id: actor.userId,
        p_actor_character_id: actor.characterId,
        p_item_id: body.itemId,
        p_quantity: body.quantity,
        p_expected_revision: body.expectedRevision,
        p_catalogue_token: body.catalogueToken,
        p_request_key: body.requestId,
      })
      if (error) throwItemRpcError(error)
      return Response.json(
        { view: characterItemsView(parseCharacterItemsState(data, actor.characterId)) },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    } catch (error) {
      return toServerErrorResponse(error)
    }
  }
}
