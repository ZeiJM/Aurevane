import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  changeCharacterPrimaryDiscipline,
  loadCharacterBuildContext,
  previewCharacterPrimaryDiscipline,
} from '@/server/character/character-build-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { toServerErrorResponse } from '@/server/http/error-response'

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape')
    return value as Record<string, unknown>
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}

async function selectedCharacter() {
  const actor = await getAuthenticatedActor()
  const character = await loadSelectedCharacter(actor)
  if (!character) {
    throw new AurevaneError('INVALID_REQUEST', 'Select a character before editing its build.')
  }
  return { actor, character }
}

export async function GET() {
  try {
    const { actor, character } = await selectedCharacter()
    const context = await loadCharacterBuildContext(
      actor.userId,
      character,
      createSupabaseCharacterBuildRepository(),
    )
    return Response.json({ context }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { actor, character } = await selectedCharacter()
    const body = await readJson(request)
    const primaryDisciplineId =
      typeof body.primaryDisciplineId === 'string' ? body.primaryDisciplineId : ''
    const preview = await previewCharacterPrimaryDiscipline(
      actor.userId,
      character,
      primaryDisciplineId,
      createSupabaseCharacterBuildRepository(),
    )
    return Response.json({ preview }, { headers: { 'Cache-Control': 'private, no-store' } })
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
    const primaryDisciplineId =
      typeof body.primaryDisciplineId === 'string' ? body.primaryDisciplineId : ''
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : ''
    const context = await changeCharacterPrimaryDiscipline(
      actor.userId,
      character,
      { expectedBuildVersion, primaryDisciplineId, idempotencyKey },
      createSupabaseCharacterBuildRepository(),
    )
    return Response.json({ context }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
