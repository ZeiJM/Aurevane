import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleBattleAbortRequest } from '@/server/battle/battle-abort-handler'
import { createBattleAbortService } from '@/server/battle/battle-abort-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'

interface RouteContext {
  params: Promise<{ battleSessionId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { battleSessionId } = await context.params
  return handleBattleAbortRequest(request, battleSessionId, {
    getActor: getAuthenticatedActor,
    service: createBattleAbortService(createSupabaseBattleSessionRepository()),
  })
}
