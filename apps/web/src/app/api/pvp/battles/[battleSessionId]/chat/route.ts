import { AurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionId } from '@aurevane/validation/combat/battle-session'

import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  getPvpBattleLog,
  getPvpSpectatorCount,
  listPvpBattleChat,
  listPvpSpectators,
  sendPvpBattleChat,
} from '@/server/battle/pvp-battle-communication-service'
import { toServerErrorResponse } from '@/server/http/error-response'

function parseAfterId(request: Request): number {
  const value = new URL(request.url).searchParams.get('after')
  if (!value) return 0
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

export async function GET(request: Request, context: { params: Promise<{ battleSessionId: string }> }) {
  try {
    const actor = await getAuthenticatedActor()
    const { battleSessionId: rawBattleSessionId } = await context.params
    const battleSessionId = parseBattleSessionId(rawBattleSessionId)
    if (!battleSessionId) throw new AurevaneError('INVALID_REQUEST', 'Invalid battle session.')
    const includeLog = new URL(request.url).searchParams.get('includeLog') === '1'

    const [messages, spectators, spectatorCount, battleLog] = await Promise.all([
      listPvpBattleChat(actor.userId, battleSessionId, parseAfterId(request)),
      listPvpSpectators(actor.userId, battleSessionId),
      getPvpSpectatorCount(actor.userId, battleSessionId),
      includeLog ? getPvpBattleLog(actor.userId, battleSessionId) : Promise.resolve(null),
    ])

    return Response.json(
      { messages, spectators, spectatorCount, ...(battleLog ? { battleLog } : {}) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request, context: { params: Promise<{ battleSessionId: string }> }) {
  try {
    const actor = await getAuthenticatedActor()
    const { battleSessionId: rawBattleSessionId } = await context.params
    const battleSessionId = parseBattleSessionId(rawBattleSessionId)
    if (!battleSessionId) throw new AurevaneError('INVALID_REQUEST', 'Invalid battle session.')

    const input = (await request.json()) as unknown
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new AurevaneError('INVALID_REQUEST', 'Enter a battle chat message.')
    }
    const body = (input as Record<string, unknown>).body
    if (typeof body !== 'string') {
      throw new AurevaneError('INVALID_REQUEST', 'Enter a battle chat message.')
    }

    const message = await sendPvpBattleChat(actor.userId, battleSessionId, body)
    return Response.json(
      { message },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
