import { assertGameplayMutationAllowed } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { createSupabaseWayfarersPracticeRepository } from '@/server/wayfarers-practice/supabase-wayfarers-practice-repository'
import { handleSetPracticePlanRequest } from '@/server/wayfarers-practice/wayfarers-practice-handler'

async function getMutationActor() {
  const actor = await getAuthenticatedActor()
  await assertGameplayMutationAllowed(actor.userId)
  return actor
}

export async function POST(request: Request) {
  return handleSetPracticePlanRequest(request, {
    getActor: getMutationActor,
    repository: createSupabaseWayfarersPracticeRepository(),
  })
}
