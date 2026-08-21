import { AurevaneError } from '@aurevane/game-core/errors'
import { parsePvpBattleKey } from '@aurevane/validation/combat/pvp'

import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  joinPvpSpectation,
  leavePvpSpectation,
} from '@/server/battle/pvp-battle-communication-service'
import { getPvpSpectatorView } from '@/server/battle/pvp-lobby-service'
import { toServerErrorResponse } from '@/server/http/error-response'

async function parseBattleKey(context: { params: Promise<{ battleKey: string }> }): Promise<string> {
  const { battleKey: rawBattleKey } = await context.params
  const battleKey = parsePvpBattleKey(rawBattleKey)
  if (!battleKey) throw new AurevaneError('INVALID_REQUEST', 'Enter a valid Spectator Key.')
  return battleKey
}

export async function GET(_request: Request, context: { params: Promise<{ battleKey: string }> }) {
  try {
    const actor = await getAuthenticatedActor()
    const battleKey = await parseBattleKey(context)
    const spectator = await getPvpSpectatorView(battleKey)
    if (!spectator) {
      throw new AurevaneError('INVALID_REQUEST', 'No active or completed PvP battle uses that key.')
    }

    const battleSessionId = await joinPvpSpectation(actor.userId, battleKey)
    if (!battleSessionId || battleSessionId !== spectator.battle.battleSessionId) {
      throw new AurevaneError('INVALID_REQUEST', 'That battle is no longer available to spectate.')
    }

    return Response.json({ spectator }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ battleKey: string }> }) {
  try {
    const actor = await getAuthenticatedActor()
    const battleKey = await parseBattleKey(context)
    const spectator = await getPvpSpectatorView(battleKey)
    if (spectator) {
      await leavePvpSpectation(actor.userId, spectator.battle.battleSessionId)
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
