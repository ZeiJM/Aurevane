import 'server-only'

import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseBattleAbortRequest,
  parseBattleSessionId,
} from '@aurevane/validation/combat/battle-session'

import type { BattleAbortService } from './battle-abort-service'
import { toServerErrorResponse } from '../http/error-response'

interface Dependencies {
  getActor: () => Promise<AuthenticatedActor>
  service: BattleAbortService
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}

export async function handleBattleAbortRequest(
  request: Request,
  battleSessionIdInput: unknown,
  dependencies: Dependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const battleSessionId = parseBattleSessionId(battleSessionIdInput)
    const parsed = parseBattleAbortRequest(await readJson(request))
    if (!battleSessionId || !parsed) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid practice-abort request.')
    }

    const battle = await dependencies.service.abortPractice({
      userId: actor.userId,
      battleSessionId,
      expectedBattleVersion: parsed.expectedBattleVersion,
      idempotencyKey: parsed.idempotencyKey,
    })

    return Response.json(
      { battle },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
