import { getAuthenticatedActor } from '@/server/auth/actor'
import { createSupabaseAuthorityProbeRepository } from '@/server/db/supabase-authority-probe-repository'
import { handleAuthorityProbeRequest } from '@/server/foundation/authority-probe-handler'

export async function POST(request: Request) {
  return handleAuthorityProbeRequest(request, {
    getActor: getAuthenticatedActor,
    repository: createSupabaseAuthorityProbeRepository(),
  })
}
