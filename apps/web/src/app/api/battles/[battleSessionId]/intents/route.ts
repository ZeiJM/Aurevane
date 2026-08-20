import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleBattleIntentRequest } from '@/server/battle/battle-session-handler'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { enforcePvpTurnDeadline } from '@/server/battle/pvp-turn-command-guard'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'
import { toServerErrorResponse } from '@/server/http/error-response'

interface RouteContext {
  params: Promise<{ battleSessionId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getAuthenticatedActor()
    const { battleSessionId } = await context.params
    await enforcePvpTurnDeadline(actor.userId, battleSessionId)
    return handleBattleIntentRequest(request, battleSessionId, {
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
