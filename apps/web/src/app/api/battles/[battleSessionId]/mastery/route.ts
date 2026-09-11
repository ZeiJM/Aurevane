import { AurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionId } from '@aurevane/validation/combat/battle-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { claimDisciplineTrial } from '@/server/character/discipline-mastery-service'
import { toServerErrorResponse } from '@/server/http/error-response'
export async function POST(
  _request: Request,
  context: { params: Promise<{ battleSessionId: string }> },
) {
  try {
    const actor = await getAuthenticatedActor()
    const id = parseBattleSessionId((await context.params).battleSessionId)
    if (!id) throw new AurevaneError('INVALID_REQUEST', 'Invalid battle-session identifier.')
    return Response.json(
      { mastery: await claimDisciplineTrial(actor.userId, id) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
