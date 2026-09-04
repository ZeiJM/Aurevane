import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  isPv2BuildcraftTestKitEnabled,
  preparePv2BuildcraftTestKit,
} from '@/server/character/pv2-buildcraft-test-kit'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST() {
  if (!isPv2BuildcraftTestKitEnabled()) {
    return Response.json({ error: { message: 'Not found.' } }, { status: 404 })
  }

  try {
    const actor = await getAuthenticatedActor()
    const character = await loadSelectedCharacter(actor)
    if (!character) {
      throw new AurevaneError('INVALID_REQUEST', 'Select a character before preparing PV-2.')
    }

    const result = await preparePv2BuildcraftTestKit(actor.userId, character.id)
    return Response.json(
      { result },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
