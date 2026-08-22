import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseBattleAbortRequest,
  parseBattleSessionId,
} from '@aurevane/validation/combat/battle-session'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { surrenderAiBattle } from '@/server/battle/ai-battle-surrender-service'
import { toServerErrorResponse } from '@/server/http/error-response'

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ battleSessionId: string }> },
) {
  try {
    const actor = await getAuthenticatedActor()
    const { battleSessionId: rawBattleSessionId } = await context.params
    const battleSessionId = parseBattleSessionId(rawBattleSessionId)
    const parsed = parseBattleAbortRequest(await readJson(request))
    if (!battleSessionId || !parsed) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid AI surrender request.')
    }

    const battle = await surrenderAiBattle(
      actor.userId,
      battleSessionId,
      parsed.expectedBattleVersion,
      parsed.idempotencyKey,
    )
    return Response.json({ battle }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
