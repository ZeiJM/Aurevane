import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleTrainingReportClaimRequest } from '@/server/wayfarers-practice/wayfarers-practice-handler'
import { createSupabaseWayfarersPracticeRepository } from '@/server/wayfarers-practice/supabase-wayfarers-practice-repository'

export async function POST(request: Request) {
  return handleTrainingReportClaimRequest(request, {
    getActor: getAuthenticatedActor,
    repository: createSupabaseWayfarersPracticeRepository(),
  })
}
