import { AurevaneError } from '@aurevane/game-core/errors'
import { parsePvpLobbyId, parsePvpReadyLobbyRequest } from '@aurevane/validation/combat/pvp'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { setPvpLobbyReady } from '@/server/battle/pvp-lobby-service'
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
    const parsed = parsePvpReadyLobbyRequest(raw)
    if (!lobbyId || !parsed) throw new AurevaneError('INVALID_REQUEST', 'Invalid lobby readiness request.')
    const lobby = await setPvpLobbyReady(actor.userId, lobbyId, parsed.ready)
    return Response.json({ lobby }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
