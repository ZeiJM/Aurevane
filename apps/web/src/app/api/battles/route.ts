import { AurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionCreateRequest } from '@aurevane/validation/combat/battle-session'

import { assertNoActiveBattle } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleCreateBattleSessionRequest } from '@/server/battle/battle-session-handler'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
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
      raw = await request.clone().json()
    } catch {
      throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
    }
    const parsed = parseBattleSessionCreateRequest(raw)
    if (!parsed) {
      throw new AurevaneError('INVALID_REQUEST', 'Invalid battle-session creation request.')
    }

    await assertNoActiveBattle(actor.userId)

    const trainingStatus = await loadPracticeStatus(
      actor,
      parsed.characterId,
      createSupabaseWayfarersPracticeRepository(),
    )
    if (isPassiveTrainingActive(trainingStatus)) {
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Finish or stop Passive Training before starting a new Battle Hall fight.',
      )
    }

    return handleCreateBattleSessionRequest(request, {
      getActor: async () => actor,
      service: createBattleSessionService({
        characters: createSupabaseCharacterRepository(),
        battles: createSupabaseBattleSessionRepository(),
      }),
    })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
