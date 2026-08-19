import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { findPlayableOwnedCharacterById } from '@/server/character/character-slot-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const body = (await request.json()) as { characterId?: unknown }
    if (typeof body.characterId !== 'string') {
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Choose a valid character before stopping training.',
      )
    }
    const character = await findPlayableOwnedCharacterById(actor.userId, body.characterId)
    if (!character) {
      throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
    }

    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.rpc('stop_passive_training_v1', {
      p_user_id: actor.userId,
      p_character_id: character.id,
    })
    if (error) {
      throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Passive Training could not be stopped.')
    }

    const row = Array.isArray(data) && data.length === 1 ? data[0] : null
    return Response.json(
      { stopped: Boolean(row?.stopped), serverNow: row?.server_now ?? null },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
