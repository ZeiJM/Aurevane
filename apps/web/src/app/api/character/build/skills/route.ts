import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  loadCharacterBuildContext,
  saveCharacterDisciplineSkills,
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

export async function PUT(request: Request) {
  try {
    const { actor, character } = await selectedCharacter()
    const body = await readJson(request)
    const expectedBuildVersion =
      typeof body.expectedBuildVersion === 'number' ? body.expectedBuildVersion : Number.NaN
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : ''
    const skillIds = Array.isArray(body.skillIds)
      ? body.skillIds.map((value) => (typeof value === 'string' ? value : ''))
      : []
    if (!Array.isArray(body.skillIds) || skillIds.some((skillId) => !skillId)) {
      throw new AurevaneError('INVALID_REQUEST', 'The Discipline Skill selection is invalid.')
    }

    let eligibilitySelections: { skillId: string; eligibilityDisciplineId: string }[] | undefined
    if (Object.hasOwn(body, 'eligibilitySelections')) {
      if (!Array.isArray(body.eligibilitySelections))
        throw new AurevaneError('INVALID_REQUEST', 'The Skill eligibility selection is invalid.')
      eligibilitySelections = body.eligibilitySelections.map((choice: unknown) => {
        if (
          !choice ||
          typeof choice !== 'object' ||
          Array.isArray(choice) ||
          !('skillId' in choice) ||
          typeof choice.skillId !== 'string' ||
          !('eligibilityDisciplineId' in choice) ||
          typeof choice.eligibilityDisciplineId !== 'string'
        )
          throw new AurevaneError('INVALID_REQUEST', 'The Skill eligibility selection is invalid.')
        return { skillId: choice.skillId, eligibilityDisciplineId: choice.eligibilityDisciplineId }
      })
    }
    const context = await saveCharacterDisciplineSkills(
      actor.userId,
      character,
      {
        expectedBuildVersion,
        idempotencyKey,
        skillIds,
        ...(eligibilitySelections === undefined ? {} : { eligibilitySelections }),
      },
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
