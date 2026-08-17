import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleBattleRecruitTurnRequest } from '@/server/battle/battle-recruit-ai-handler'
import { createBattleRecruitAiService } from '@/server/battle/battle-recruit-ai-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'

export async function POST(
  request: Request,
  context: { params: Promise<{ battleSessionId: string }> },
) {
  const { battleSessionId } = await context.params
  return handleBattleRecruitTurnRequest(request, battleSessionId, {
    getActor: getAuthenticatedActor,
    service: createBattleRecruitAiService(createSupabaseBattleSessionRepository()),
  })
}
