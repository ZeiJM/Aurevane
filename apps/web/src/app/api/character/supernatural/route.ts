import { assertGameplayMutationAllowed } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import {
  handleSupernaturalStoryGet,
  handleSupernaturalStoryPut,
} from '@/server/character/supernatural-story-state-handler'
import { createSupabaseSupernaturalStoryStateRepository } from '@/server/character/supabase-supernatural-story-state-repository'

function dependencies() {
  return {
    getActor: getAuthenticatedActor,
    loadSelectedCharacter,
    assertGameplayMutationAllowed,
    repository: createSupabaseSupernaturalStoryStateRepository(),
  }
}

export async function GET() {
  return handleSupernaturalStoryGet(dependencies())
}

export async function PUT(request: Request) {
  return handleSupernaturalStoryPut(request, dependencies())
}
