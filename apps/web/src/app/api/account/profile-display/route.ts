import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { setCharacterProfileImage } from '@/server/character/character-profile-display-service'
import { findPlayableOwnedCharacterById } from '@/server/character/character-slot-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const body = (await request.json()) as { characterId?: unknown; imageUrl?: unknown }
    if (typeof body.characterId !== 'string') {
      throw new AurevaneError('INVALID_REQUEST', 'Choose a valid character before changing profile display.')
    }
    if (body.imageUrl !== null && typeof body.imageUrl !== 'string') {
      throw new AurevaneError('INVALID_REQUEST', 'Profile image URL must be text or null.')
    }

    const character = await findPlayableOwnedCharacterById(actor.userId, body.characterId)
    if (!character) {
      throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
    }

    const display = await setCharacterProfileImage({
      userId: actor.userId,
      characterId: character.id,
      imageUrl: body.imageUrl ?? null,
    })

    return Response.json(
      { display },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
