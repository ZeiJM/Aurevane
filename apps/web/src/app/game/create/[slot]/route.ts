import { NextResponse } from 'next/server'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { isCharacterSlotIndex, loadCharacterSlots } from '@/server/character/character-slot-service'
import { CREATION_SLOT_COOKIE } from '@/server/character/selected-character'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  const actor = await getAuthenticatedActor()
  const { slot } = await params
  const slotIndex = Number(slot)
  const response = NextResponse.redirect(new URL('/game', request.url))

  if (slot === 'cancel') {
    response.cookies.set(CREATION_SLOT_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  }

  if (!isCharacterSlotIndex(slotIndex)) return response
  const occupied = (await loadCharacterSlots(actor.userId)).some((character) => character.slotIndex === slotIndex)
  if (occupied) return response

  response.cookies.set(CREATION_SLOT_COOKIE, String(slotIndex), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 30,
  })
  return response
}
