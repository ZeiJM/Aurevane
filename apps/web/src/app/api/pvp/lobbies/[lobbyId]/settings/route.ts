import { AurevaneError } from '@aurevane/game-core/errors'
import { parsePvpLobbyId, parsePvpLobbySettingsRequest } from '@aurevane/validation/combat/pvp'

import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  getPvpLobbyMapSettings,
  setPvpLobbyMapSettings,
} from '@/server/battle/pvp-lobby-quality-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function GET(_request: Request, context: { params: Promise<{ lobbyId: string }> }) {
  try {
    const actor = await getAuthenticatedActor()
    const { lobbyId: rawLobbyId } = await context.params
    const lobbyId = parsePvpLobbyId(rawLobbyId)
    if (!lobbyId) throw new AurevaneError('INVALID_REQUEST', 'Invalid PvP lobby identifier.')
    const settings = await getPvpLobbyMapSettings(actor.userId, lobbyId)
    return Response.json({ settings }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

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
    const parsed = parsePvpLobbySettingsRequest(raw)
    if (!lobbyId || !parsed) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid PvP battlefield settings.')
    }
    const settings = await setPvpLobbyMapSettings(actor.userId, lobbyId, parsed)
    return Response.json({ settings }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
