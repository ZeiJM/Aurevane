import { AurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionCreateRequest } from '@aurevane/validation/combat/battle-session'

import { assertNoActiveBattle } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createSupabaseWayfarersPracticeRepository } from '@/server/wayfarers-practice/supabase-wayfarers-practice-repository'
import {
  isPassiveTrainingActive,
  loadPracticeStatus,
} from '@/server/wayfarers-practice/wayfarers-practice-service'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
    }
    const parsed = parseBattleSessionCreateRequest(raw)
    if (!parsed) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid battle-session creation request.')
    }

    const [activeBattleResult, trainingStatusResult] = await Promise.allSettled([
      assertNoActiveBattle(actor.userId, parsed.idempotencyKey),
      loadPracticeStatus(actor, parsed.characterId, createSupabaseWayfarersPracticeRepository()),
    ])
    if (activeBattleResult.status === 'rejected') throw activeBattleResult.reason
    if (trainingStatusResult.status === 'rejected') throw trainingStatusResult.reason
    const trainingStatus = trainingStatusResult.value
    if (isPassiveTrainingActive(trainingStatus)) {
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Finish or stop Passive Training before starting a new Battle Hall fight.',
      )
    }

    const battle = await createBattleSessionService({
      characters: createSupabaseCharacterRepository(),
      battles: createSupabaseBattleSessionRepository(),
      builds: createSupabaseCharacterBuildRepository(),
    }).createSession({
      userId: actor.userId,
      characterId: parsed.characterId,
      arenaId: parsed.arenaId,
      aiDifficulty: parsed.aiDifficulty,
      battleHallRecordId: parsed.battleHallRecordId,
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
