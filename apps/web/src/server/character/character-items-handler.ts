import { AurevaneError } from '@aurevane/game-core/errors'
import { toServerErrorResponse } from '@/server/http/error-response'
import {
  loadCharacterItems,
  mutateCharacterItems,
  type CharacterItemsRepository,
} from './character-items-service'
export function createCharacterItemsHandler(dependencies: {
  selected(): Promise<{ userId: string; characterId: string }>
  repository(): CharacterItemsRepository
}) {
  return async (request: Request): Promise<Response> => {
    try {
      const { userId, characterId } = await dependencies.selected()
      const repository = dependencies.repository()
      if (request.method === 'GET')
        return Response.json(
          { view: await loadCharacterItems(userId, characterId, repository) },
          { headers: { 'Cache-Control': 'private, no-store' } },
        )
      let body: unknown
      try {
        body = await request.json()
      } catch {
        throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
      }
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        !('characterId' in body) ||
        body.characterId !== characterId
      )
        throw new AurevaneError(
          'INVALID_REQUEST',
          'The selected character changed. Refresh and try again.',
        )
      const command = { ...body } as Record<string, unknown>
      delete command.characterId
      return Response.json(
        { view: await mutateCharacterItems(userId, characterId, command, repository) },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    } catch (error) {
      return toServerErrorResponse(error)
    }
  }
}
