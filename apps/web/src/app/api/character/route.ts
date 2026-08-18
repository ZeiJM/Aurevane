import { AurevaneError } from '@aurevane/game-core/errors'
import { parseCharacterCreationRequest } from '@aurevane/validation/player/character'
import { NextResponse } from 'next/server'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { createCharacterInSlot } from '@/server/character/character-slot-service'
import { CREATION_SLOT_COOKIE, readCreationSlot } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const creation = parseCharacterCreationRequest(await request.json())
    const slotIndex = await readCreationSlot()
    if (!creation || slotIndex === null) {
      throw new AurevaneError('INVALID_REQUEST', 'Choose an open character slot before creating a character.')
    }

    const outcome = await createCharacterInSlot({
      actor,
      slotIndex,
      idempotencyKey: creation.idempotencyKey,
      intent: creation.intent,
    })

    const response = NextResponse.json(
      { character: outcome.character, replayed: outcome.replayed },
      { status: outcome.replayed ? 200 : 201, headers: { 'Cache-Control': 'private, no-store' } },
    )
    response.cookies.set(CREATION_SLOT_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
