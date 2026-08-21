import { AurevaneError } from '@aurevane/game-core/errors'
import { parsePvpCreateLobbyRequest } from '@aurevane/validation/combat/pvp'

import { assertNoActiveBattle } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { setPvpLobbyMapSettings } from '@/server/battle/pvp-lobby-quality-service'
import { createPvpLobby } from '@/server/battle/pvp-lobby-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
    }
    const parsed = parsePvpCreateLobbyRequest(raw)
    if (!parsed) throw new AurevaneError('INVALID_REQUEST', 'Invalid PvP lobby setup.')

    await assertNoActiveBattle(actor.userId)
    const lobby = await createPvpLobby({
      userId: actor.userId,
      characterId: parsed.characterId,
      mode: parsed.mode,
      teamASize: parsed.teamASize,
      teamBSize: parsed.teamBSize,
    })
    await setPvpLobbyMapSettings(actor.userId, lobby.lobbyId, {
      mapSize: parsed.mapSize,
      elevationBias: parsed.elevationBias,
      terrainBias: parsed.terrainBias,
      turnTimerSeconds: parsed.turnTimerSeconds,
    })
    return Response.json(
      { lobby },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
