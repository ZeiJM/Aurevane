import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  loadCharacterBuildContext,
  saveCharacterSupportAction,
  type CharacterBuildContext,
} from '@/server/character/character-build-service'
import { resolveCurrentCharacterSkillDetails } from '@/server/character/current-skill-detail-loader'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { toServerErrorResponse } from '@/server/http/error-response'

async function selectedCharacter() {
  const actor = await getAuthenticatedActor()
  const character = await loadSelectedCharacter(actor)
  if (!character) {
    throw new AurevaneError('INVALID_REQUEST', 'Select a character before editing its build.')
  }
  return { actor, character }
}

async function currentSkillDetails(context: CharacterBuildContext): Promise<CharacterBuildContext> {
  return {
    ...context,
    disciplineSkills: await resolveCurrentCharacterSkillDetails(
      context.disciplineSkills,
      createServerCombatContentResolver(),
    ),
  }
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape')
    return value as Record<string, unknown>
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}

export async function GET() {
  try {
    const { actor, character } = await selectedCharacter()
    const context = await loadCharacterBuildContext(
      actor.userId,
      character,
      createSupabaseCharacterBuildRepository(),
    )
    return Response.json(
      { context: await currentSkillDetails(context) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { actor, character } = await selectedCharacter()
    const body = await readJson(request)
    const expectedBuildVersion =
      typeof body.expectedBuildVersion === 'number' ? body.expectedBuildVersion : Number.NaN
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : ''
    if (body.characterId !== character.id) {
      throw new AurevaneError(
        'INVALID_REQUEST',
        'The selected character changed. Refresh and try again.',
      )
    }
    const context = await saveCharacterSupportAction(
      actor.userId,
      character,
      { expectedBuildVersion, idempotencyKey, supportActionId: body.supportActionId },
      createSupabaseCharacterBuildRepository(),
    )
    return Response.json(
      { context: await currentSkillDetails(context) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
