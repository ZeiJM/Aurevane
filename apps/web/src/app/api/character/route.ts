import { getAuthenticatedActor } from '@/server/auth/actor'
import { handleCharacterCreationRequest } from '@/server/character/character-handler'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

export async function POST(request: Request) {
  return handleCharacterCreationRequest(request, {
    getActor: getAuthenticatedActor,
    repository: createSupabaseCharacterRepository(),
  })
}
