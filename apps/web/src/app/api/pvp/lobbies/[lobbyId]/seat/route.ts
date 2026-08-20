import { AurevaneError } from '@aurevane/game-core/errors'
import { parsePvpLobbyId, parsePvpLobbySeatMoveRequest } from '@aurevane/validation/combat/pvp'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { movePvpLobbySeat } from '@/server/battle/pvp-lobby-quality-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST(request: Request, context: { params: Promise<{ lobbyId: string }> }) {
  try {
    const actor = await getAuthenticatedActor()
    const { lobbyId: rawLobbyId } = await context.params
    const lobbyId = parsePvpLobbyId(rawLobbyId)
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
    }
    const parsed = parsePvpLobbySeatMoveRequest(raw)
    if (!lobbyId || !parsed) throw new AurevaneError('INVALID_REQUEST', 'Invalid PvP seat move.')
    const lobby = await movePvpLobbySeat(
      actor.userId,
      lobbyId,
      parsed.targetTeamIndex,
      parsed.targetSeatIndex,
    )
    return Response.json({ lobby }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
