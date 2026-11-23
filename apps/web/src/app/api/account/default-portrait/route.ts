import { AurevaneError } from '@aurevane/game-core/errors'
import { assertGameplayMutationAllowed } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { setCharacterDefaultPortrait } from '@/server/character/character-portrait-choice-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    await assertGameplayMutationAllowed(actor.userId)
    const body = (await request.json()) as { characterId?: unknown; portraitRef?: unknown } | null
    if (!body || typeof body.characterId !== 'string')
      throw new AurevaneError('INVALID_REQUEST', 'Choose a valid character.')
    const choice = await setCharacterDefaultPortrait({
      userId: actor.userId,
      characterId: body.characterId,
      portraitRef: body.portraitRef,
    })
    return Response.json({ choice }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
