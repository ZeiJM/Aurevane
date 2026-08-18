import { AurevaneError } from '@aurevane/game-core/errors'
import { parseCharacterCreationRequest } from '@aurevane/validation/player/character'
import { NextResponse } from 'next/server'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { createCharacterInSlot } from '@/server/character/character-slot-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const creation = parseCharacterCreationRequest(await request.json())
    if (!creation) {
      throw new AurevaneError('INVALID_REQUEST', 'Review the character creation request.')
    }

    const outcome = await createCharacterInSlot({
      actor,
      slotIndex: creation.slotIndex,
      idempotencyKey: creation.idempotencyKey,
      intent: creation.intent,
    })

    return NextResponse.json(
      { character: outcome.character, replayed: outcome.replayed },
      { status: outcome.replayed ? 200 : 201, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
