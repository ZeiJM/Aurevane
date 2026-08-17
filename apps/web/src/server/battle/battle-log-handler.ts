import 'server-only'

import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionId } from '@aurevane/validation/combat/battle-session'

import { toServerErrorResponse } from '../http/error-response'
import type { BattleLogService } from './battle-log-service'

interface Dependencies {
  getActor: () => Promise<AuthenticatedActor>
  service: BattleLogService
}

export async function handleBattleLogRequest(
  battleSessionIdInput: unknown,
  dependencies: Dependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const battleSessionId = parseBattleSessionId(battleSessionIdInput)
    if (!battleSessionId) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid battle-session identifier.')
    }

    const battleLog = await dependencies.service.getLog(actor.userId, battleSessionId)
    return Response.json(
      { battleLog },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
