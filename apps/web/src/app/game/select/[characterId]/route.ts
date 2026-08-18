import { NextResponse } from 'next/server'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { findPlayableOwnedCharacterById } from '@/server/character/character-slot-service'
import { SELECTED_CHARACTER_COOKIE } from '@/server/character/selected-character'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> },
) {
  const actor = await getAuthenticatedActor()
  const { characterId } = await params
  const character = await findPlayableOwnedCharacterById(actor.userId, characterId)
  if (!character) return NextResponse.redirect(new URL('/game', request.url))

  const response = NextResponse.redirect(new URL('/game/character', request.url))
  response.cookies.set(SELECTED_CHARACTER_COOKIE, character.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
