import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import {
  loadRecentBattleEmojis,
  saveRecentBattleEmojis,
} from '@/server/player-profile/recent-emojis-service'

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}

export async function GET() {
  try {
    const actor = await getAuthenticatedActor()
    const emojis = await loadRecentBattleEmojis(actor)
    return Response.json(
      { emojis },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const body = await readJson(request)
    const emojis =
      body && typeof body === 'object' && !Array.isArray(body) && 'emojis' in body
        ? (body as { emojis: unknown }).emojis
        : null
    if (emojis === null) {
      throw new AurevaneError('INVALID_REQUEST', 'Recent emoji preferences are required.')
    }

    const saved = await saveRecentBattleEmojis(actor, emojis)
    return Response.json(
      { emojis: saved },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
