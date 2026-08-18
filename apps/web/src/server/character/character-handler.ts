import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import { parseCharacterCreationRequest } from '@aurevane/validation/player/character'

import { toServerErrorResponse } from '../http/error-response'
import { createCharacterInSlot } from './character-slot-service'

export interface CharacterCreationHandlerDependencies {
  getActor(): Promise<AuthenticatedActor>
}

export async function handleCharacterCreationRequest(
  request: Request,
  dependencies: CharacterCreationHandlerDependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const input = parseCharacterCreationRequest(await readJson(request))
    if (!input) {
      throw new AurevaneError(
        'INVALID_REQUEST',
        'The character choices could not be read. Review the form and try again.',
      )
    }

    const outcome = await createCharacterInSlot({
      actor,
      slotIndex: input.slotIndex,
      idempotencyKey: input.idempotencyKey,
      intent: input.intent,
    })

    return Response.json(
      {
        character: {
          id: outcome.character.id,
          name: outcome.character.name,
          slotIndex: outcome.character.slotIndex,
          foundationDisciplineId: outcome.character.foundationDisciplineId,
          attributes: outcome.character.attributes,
          level: outcome.character.level,
          createdAt: outcome.character.createdAt,
        },
        replayed: outcome.replayed,
      },
      {
        status: outcome.replayed ? 200 : 201,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}
