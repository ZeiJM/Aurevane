import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { setCharacterPersonalTitle } from '@/server/character/character-title-service'
import { findPlayableOwnedCharacterById } from '@/server/character/character-slot-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const body = (await request.json()) as { characterId?: unknown; title?: unknown }
    if (typeof body.characterId !== 'string') {
      throw new AurevaneError('INVALID_REQUEST', 'Choose a valid character before setting a title.')
    }

    const character = await findPlayableOwnedCharacterById(actor.userId, body.characterId)
    if (!character) {
      throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
    }

    const title = await setCharacterPersonalTitle({
      userId: actor.userId,
      characterId: character.id,
      title: body.title,
    })

    return Response.json(
      { title },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
