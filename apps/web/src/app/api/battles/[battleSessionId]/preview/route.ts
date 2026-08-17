import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleBattlePreviewRequest } from '@/server/battle/battle-preview-handler'
import { createBattlePreviewService } from '@/server/battle/battle-preview-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'

export async function POST(
  request: Request,
  context: { params: Promise<{ battleSessionId: string }> },
) {
  const { battleSessionId } = await context.params
  return handleBattlePreviewRequest(request, battleSessionId, {
    getActor: getAuthenticatedActor,
    service: createBattlePreviewService(createSupabaseBattleSessionRepository()),
  })
}
