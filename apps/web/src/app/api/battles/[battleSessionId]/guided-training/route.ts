import { AurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionId } from '@aurevane/validation/combat/battle-session'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { createGuidedTrainingCompletionService } from '@/server/battle/guided-training-completion-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { toServerErrorResponse } from '@/server/http/error-response'

function service() {
  return createGuidedTrainingCompletionService(createSupabaseBattleSessionRepository())
}

function parseSessionId(value: unknown): string {
  const parsed = parseBattleSessionId(value)
  if (!parsed) throw new AurevaneError('INVALID_REQUEST', 'Invalid battle-session identifier.')
  return parsed
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ battleSessionId: string }> },
) {
  try {
    const actor = await getAuthenticatedActor()
    const { battleSessionId } = await context.params
    const progress = await service().getProgress(actor.userId, parseSessionId(battleSessionId))
    return Response.json({ progress }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ battleSessionId: string }> },
) {
  try {
    const actor = await getAuthenticatedActor()
    const { battleSessionId } = await context.params
    const body = (await request.json()) as { idempotencyKey?: unknown }
    if (typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length < 8) {
      throw new AurevaneError('INVALID_REQUEST', 'A valid idempotency key is required.')
    }
    const result = await service().complete({
      userId: actor.userId,
      battleSessionId: parseSessionId(battleSessionId),
      idempotencyKey: body.idempotencyKey,
    })
    return Response.json(
      { completed: true, battleVersion: result.battleVersion, replayed: result.replayed },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
