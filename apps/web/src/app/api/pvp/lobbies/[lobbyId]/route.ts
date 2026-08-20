import { AurevaneError } from '@aurevane/game-core/errors'
import { parsePvpLobbyId } from '@aurevane/validation/combat/pvp'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { getPvpLobby, leavePvpLobby } from '@/server/battle/pvp-lobby-service'
import { toServerErrorResponse } from '@/server/http/error-response'

function lobbyIdOrThrow(value: unknown): string {
  const lobbyId = parsePvpLobbyId(value)
  if (!lobbyId) throw new AurevaneError('INVALID_REQUEST', 'Invalid PvP lobby identifier.')
  return lobbyId
}

export async function GET(_request: Request, context: { params: Promise<{ lobbyId: string }> }) {
  try {
    const actor = await getAuthenticatedActor()
    const { lobbyId } = await context.params
    const lobby = await getPvpLobby(actor.userId, lobbyIdOrThrow(lobbyId))
    return Response.json({ lobby }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ lobbyId: string }> }) {
  try {
    const actor = await getAuthenticatedActor()
    const { lobbyId } = await context.params
    await leavePvpLobby(actor.userId, lobbyIdOrThrow(lobbyId))
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
