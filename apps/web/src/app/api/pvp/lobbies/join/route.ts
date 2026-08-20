import { AurevaneError } from '@aurevane/game-core/errors'
import { parsePvpJoinLobbyRequest } from '@aurevane/validation/combat/pvp'

import { assertNoActiveBattle } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { joinPvpLobby } from '@/server/battle/pvp-lobby-service'
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
    const parsed = parsePvpJoinLobbyRequest(raw)
    if (!parsed) throw new AurevaneError('INVALID_REQUEST', 'Enter a valid Battle Hall lobby key.')
    await assertNoActiveBattle(actor.userId)
    const lobby = await joinPvpLobby({
      userId: actor.userId,
      characterId: parsed.characterId,
      lobbyKey: parsed.lobbyKey,
    })
    return Response.json({ lobby }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
