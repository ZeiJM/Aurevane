import { getAuthenticatedActor } from '@/server/auth/actor'
import { createSupabaseWayfarersPracticeRepository } from '@/server/wayfarers-practice/supabase-wayfarers-practice-repository'
import { handleSetPracticePlanRequest } from '@/server/wayfarers-practice/wayfarers-practice-handler'

export async function POST(request: Request) {
  return handleSetPracticePlanRequest(request, {
    getActor: getAuthenticatedActor,
    repository: createSupabaseWayfarersPracticeRepository(),
  })
}
