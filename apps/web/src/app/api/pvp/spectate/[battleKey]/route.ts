import { AurevaneError } from '@aurevane/game-core/errors'
import { parsePvpBattleKey } from '@aurevane/validation/combat/pvp'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { getPvpSpectatorView } from '@/server/battle/pvp-lobby-service'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function GET(_request: Request, context: { params: Promise<{ battleKey: string }> }) {
  try {
    await getAuthenticatedActor()
    const { battleKey: rawBattleKey } = await context.params
    const battleKey = parsePvpBattleKey(rawBattleKey)
    if (!battleKey) throw new AurevaneError('INVALID_REQUEST', 'Enter a valid Battle Key.')
    const spectator = await getPvpSpectatorView(battleKey)
    if (!spectator) {
      throw new AurevaneError('INVALID_REQUEST', 'No active or completed PvP battle uses that key.')
    }
    return Response.json({ spectator }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
