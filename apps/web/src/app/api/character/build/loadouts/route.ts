import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadCharacterBuildContext } from '@/server/character/character-build-service'
import {
  activateCharacterSavedBuildLoadout,
  listCharacterSavedBuildLoadouts,
  saveCurrentCharacterBuildLoadout,
} from '@/server/character/character-saved-build-loadout-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { createSupabaseCharacterSavedBuildLoadoutRepository } from '@/server/character/supabase-character-saved-build-loadout-repository'
import { toServerErrorResponse } from '@/server/http/error-response'

async function selectedCharacter() {
  const actor = await getAuthenticatedActor()
  const character = await loadSelectedCharacter(actor)
  if (!character) {
    throw new AurevaneError('INVALID_REQUEST', 'Select a character before editing its build.')
  }
  return { actor, character }
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
    const loadouts = await listCharacterSavedBuildLoadouts(
      actor.userId,
      character.id,
      createSupabaseCharacterSavedBuildLoadoutRepository(),
    )
    return Response.json({ loadouts }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { actor, character } = await selectedCharacter()
    const body = await readJson(request)
    const slotIndex = typeof body.slotIndex === 'number' ? body.slotIndex : Number.NaN
    const name = typeof body.name === 'string' ? body.name : ''
    const expectedBuildVersion =
      typeof body.expectedBuildVersion === 'number' ? body.expectedBuildVersion : Number.NaN
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : ''
    const repository = createSupabaseCharacterSavedBuildLoadoutRepository()

    const saved = await saveCurrentCharacterBuildLoadout(
      actor.userId,
      character,
      { slotIndex, name, expectedBuildVersion, idempotencyKey },
      repository,
    )
    const loadouts = await listCharacterSavedBuildLoadouts(actor.userId, character.id, repository)
    return Response.json({ saved, loadouts }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const { actor, character } = await selectedCharacter()
    const body = await readJson(request)
    const slotIndex = typeof body.slotIndex === 'number' ? body.slotIndex : Number.NaN
    const expectedBuildVersion =
      typeof body.expectedBuildVersion === 'number' ? body.expectedBuildVersion : Number.NaN
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : ''

    const activation = await activateCharacterSavedBuildLoadout(
      actor.userId,
      character,
      { slotIndex, expectedBuildVersion, idempotencyKey },
      createSupabaseCharacterSavedBuildLoadoutRepository(),
    )
    const context = await loadCharacterBuildContext(
      actor.userId,
      character,
      createSupabaseCharacterBuildRepository(),
    )
    return Response.json(
      { activation, context },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
