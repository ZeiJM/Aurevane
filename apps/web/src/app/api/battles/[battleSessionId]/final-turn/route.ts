import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleBattleFinalTurnRequest } from '@/server/battle/battle-final-turn-handler'
import { createBattleFinalTurnService } from '@/server/battle/battle-final-turn-service'
import { enforcePvpTurnDeadline } from '@/server/battle/pvp-turn-command-guard'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { toServerErrorResponse } from '@/server/http/error-response'

interface RouteContext {
  params: Promise<{ battleSessionId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getAuthenticatedActor()
    const { battleSessionId } = await context.params
    await enforcePvpTurnDeadline(actor.userId, battleSessionId)
    return handleBattleFinalTurnRequest(request, battleSessionId, {
      getActor: async () => actor,
      service: createBattleFinalTurnService(createSupabaseBattleSessionRepository()),
    })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
