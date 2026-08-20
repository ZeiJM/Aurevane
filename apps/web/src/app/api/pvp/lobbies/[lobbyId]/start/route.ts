import { AurevaneError } from '@aurevane/game-core/errors'
import { parsePvpLobbyId } from '@aurevane/validation/combat/pvp'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { startPvpLobby } from '@/server/battle/pvp-lobby-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST(_request: Request, context: { params: Promise<{ lobbyId: string }> }) {
  try {
    const actor = await getAuthenticatedActor()
    const { lobbyId: rawLobbyId } = await context.params
    const lobbyId = parsePvpLobbyId(rawLobbyId)
    if (!lobbyId) throw new AurevaneError('INVALID_REQUEST', 'Invalid PvP lobby identifier.')
    const battle = await startPvpLobby(actor.userId, lobbyId)
    return Response.json({ battle }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
