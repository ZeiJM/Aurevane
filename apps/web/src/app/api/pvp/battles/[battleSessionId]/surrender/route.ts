import { AurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionId } from '@aurevane/validation/combat/battle-session'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { surrenderPvpBattle } from '@/server/battle/pvp-battle-quality-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST(
  _request: Request,
  context: { params: Promise<{ battleSessionId: string }> },
) {
  try {
    const actor = await getAuthenticatedActor()
    const { battleSessionId: rawBattleSessionId } = await context.params
    const battleSessionId = parseBattleSessionId(rawBattleSessionId)
    if (!battleSessionId) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid PvP battle identifier.')
    }
    const battle = await surrenderPvpBattle(actor.userId, battleSessionId)
    return Response.json({ battle }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
