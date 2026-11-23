import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  commitCharacterAppearance,
  loadCharacterAppearance,
} from '@/server/character/character-appearance-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  try {
    const actor = await getAuthenticatedActor()
    const character = await loadSelectedCharacter(actor)
    if (!character) throw new AurevaneError('FORBIDDEN', 'Choose a character first.')
    return Response.json(
      { appearance: await loadCharacterAppearance(actor.userId, character.id) },
      { headers },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const character = await loadSelectedCharacter(actor)
    const body = (await request.json()) as {
      characterId?: unknown
      expectedRevision?: unknown
      blueprint?: unknown
    } | null
    if (!character || character.id !== body?.characterId) {
      throw new AurevaneError('FORBIDDEN', 'That character is not selected.')
    }
    if (
      typeof body.expectedRevision !== 'number' ||
      !Number.isSafeInteger(body.expectedRevision) ||
      body.expectedRevision < 0 ||
      body.expectedRevision > 2147483647
    ) {
      throw new AurevaneError('INVALID_REQUEST', 'Reopen the editor to review your current look.')
    }
    const appearance = await commitCharacterAppearance({
      userId: actor.userId,
      characterId: character.id,
      expectedRevision: body.expectedRevision,
      blueprint: body.blueprint,
    })
    return Response.json({ appearance }, { headers })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
