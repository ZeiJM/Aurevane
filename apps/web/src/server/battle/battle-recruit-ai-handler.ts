import 'server-only'

import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseBattleRecruitTurnRequest,
  parseBattleSessionId,
} from '@aurevane/validation/combat/battle-session'

import { toServerErrorResponse } from '../http/error-response'
import type { BattleRecruitAiService } from './battle-recruit-ai-service'

interface Dependencies {
  getActor: () => Promise<AuthenticatedActor>
  service: BattleRecruitAiService
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}

export async function handleBattleRecruitTurnRequest(
  request: Request,
  battleSessionIdInput: unknown,
  dependencies: Dependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const battleSessionId = parseBattleSessionId(battleSessionIdInput)
    const parsed = parseBattleRecruitTurnRequest(await readJson(request))
    if (!battleSessionId || !parsed) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid Recruit turn request.')
    }

    const battle = await dependencies.service.runTurn({
      userId: actor.userId,
      battleSessionId,
      expectedBattleVersion: parsed.expectedBattleVersion,
    })

    return Response.json(
      { battle },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
