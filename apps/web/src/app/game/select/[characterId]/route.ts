import { isAurevaneError } from '@aurevane/game-core/errors'
import { NextResponse } from 'next/server'

import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  findPlayableOwnedCharacterById,
  selectCharacterForAccount,
} from '@/server/character/character-slot-service'
import { SELECTED_CHARACTER_COOKIE } from '@/server/character/selected-character'

function redirectTo(path: string): NextResponse {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: path },
  })
}

function requestUsesHttps(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> },
) {
  const actor = await getAuthenticatedActor()
  const { characterId } = await params
  const character = await findPlayableOwnedCharacterById(actor.userId, characterId)
  if (!character) return redirectTo('/game?character=unavailable')

  try {
    await selectCharacterForAccount(actor.userId, character.id)
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'INVALID_REQUEST') {
      return redirectTo('/game?character=cooldown')
    }
    throw error
  }

  const response = redirectTo('/game/character')
  response.cookies.set(SELECTED_CHARACTER_COOKIE, character.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: requestUsesHttps(request),
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
