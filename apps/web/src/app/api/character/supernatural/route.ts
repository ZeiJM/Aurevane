import { AurevaneError } from '@aurevane/game-core/errors'
import { parseAuthoredSupernaturalTransitionRequest } from '@aurevane/validation/player/supernatural'

import { assertGameplayMutationAllowed } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import {
  commitAuthoredSupernaturalStoryTransition,
  findSupernaturalStoryState,
} from '@/server/character/supernatural-story-state-service'
import { createSupabaseSupernaturalStoryStateRepository } from '@/server/character/supabase-supernatural-story-state-repository'
import { toServerErrorResponse } from '@/server/http/error-response'

async function selectedCharacter() {
  const actor = await getAuthenticatedActor()
  const character = await loadSelectedCharacter(actor)
  if (!character) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Select a character before accessing supernatural progression.',
    )
  }
  return { actor, character }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}

export async function GET() {
  try {
    const { actor, character } = await selectedCharacter()
    const state = await findSupernaturalStoryState(
      actor.userId,
      character.id,
      createSupabaseSupernaturalStoryStateRepository(),
    )
    return Response.json({ state }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const { actor, character } = await selectedCharacter()
    await assertGameplayMutationAllowed(actor.userId)

    const input = parseAuthoredSupernaturalTransitionRequest(await readJson(request))
    if (!input) {
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Provide a valid authored supernatural transition request.',
      )
    }

    const outcome = await commitAuthoredSupernaturalStoryTransition(
      actor.userId,
      character.id,
      input,
      createSupabaseSupernaturalStoryStateRepository(),
    )

    return Response.json(outcome, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
