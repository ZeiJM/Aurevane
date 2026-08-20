import { isAurevaneError } from '@aurevane/game-core/errors'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { getActiveBattleForUser } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  authorizeCharacterSelection,
  findPlayableOwnedCharacterById,
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
  const activeBattle = await getActiveBattleForUser(actor.userId)
  if (activeBattle) return redirectTo(`/game/battle/${activeBattle.battleSessionId}`)

  const { characterId } = await params
  const character = await findPlayableOwnedCharacterById(actor.userId, characterId)
  if (!character) return redirectTo('/game')

  const currentCharacterId = (await cookies()).get(SELECTED_CHARACTER_COOKIE)?.value ?? null
  try {
    await authorizeCharacterSelection({
      userId: actor.userId,
      fromCharacterId: currentCharacterId,
      toCharacterId: character.id,
    })
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'CHARACTER_RESELECT_COOLDOWN') {
      return redirectTo('/game')
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
