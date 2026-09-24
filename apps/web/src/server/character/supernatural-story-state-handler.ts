import type { SupernaturalStoryStateRepository } from '@aurevane/db/supernatural-state'
import { AurevaneError } from '@aurevane/game-core/errors'
import { parseAuthoredSupernaturalTransitionRequest } from '@aurevane/validation/player/supernatural'

import { toServerErrorResponse } from '@/server/http/error-response'

import {
  commitAuthoredSupernaturalStoryTransition,
  findSupernaturalStoryState,
} from './supernatural-story-state-service'

export interface SupernaturalStoryHandlerDependencies {
  getActor(): Promise<{ userId: string }>
  loadSelectedCharacter(actor: { userId: string }): Promise<{ id: string } | null>
  assertGameplayMutationAllowed(userId: string): Promise<void>
  repository: SupernaturalStoryStateRepository
}

async function selectedCharacter(dependencies: SupernaturalStoryHandlerDependencies) {
  const actor = await dependencies.getActor()
  const character = await dependencies.loadSelectedCharacter(actor)
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

export async function handleSupernaturalStoryGet(
  dependencies: SupernaturalStoryHandlerDependencies,
): Promise<Response> {
  try {
    const { actor, character } = await selectedCharacter(dependencies)
    const state = await findSupernaturalStoryState(
      actor.userId,
      character.id,
      dependencies.repository,
    )
    return Response.json({ state }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function handleSupernaturalStoryPut(
  request: Request,
  dependencies: SupernaturalStoryHandlerDependencies,
): Promise<Response> {
  try {
    const { actor, character } = await selectedCharacter(dependencies)
    await dependencies.assertGameplayMutationAllowed(actor.userId)

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
      dependencies.repository,
    )

    return Response.json(outcome, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
