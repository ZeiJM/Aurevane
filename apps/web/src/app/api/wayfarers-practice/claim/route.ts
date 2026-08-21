import { assertGameplayMutationAllowed } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleTrainingReportClaimRequest } from '@/server/wayfarers-practice/wayfarers-practice-handler'
import { createSupabaseWayfarersPracticeRepository } from '@/server/wayfarers-practice/supabase-wayfarers-practice-repository'

async function getMutationActor() {
  const actor = await getAuthenticatedActor()
  await assertGameplayMutationAllowed(actor.userId)
  return actor
}

export async function POST(request: Request) {
  return handleTrainingReportClaimRequest(request, {
    getActor: getMutationActor,
    repository: createSupabaseWayfarersPracticeRepository(),
  })
}
