import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleBattleFinalTurnPreviewRequest } from '@/server/battle/battle-final-turn-handler'
import { createBattleFinalTurnService } from '@/server/battle/battle-final-turn-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'

interface RouteContext {
  params: Promise<{ battleSessionId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { battleSessionId } = await context.params
  return handleBattleFinalTurnPreviewRequest(request, battleSessionId, {
    getActor: getAuthenticatedActor,
    service: createBattleFinalTurnService(createSupabaseBattleSessionRepository()),
  })
}
