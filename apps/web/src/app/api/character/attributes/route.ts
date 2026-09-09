import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import { AurevaneError } from '@aurevane/game-core/errors'

import { assertGameplayMutationAllowed } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  commitCharacterAttributeAllocation,
  loadCharacterAttributeAllocation,
  type CharacterAttributeChangeMode,
} from '@/server/character/character-attribute-service'
import { loadCharacterBuildContext } from '@/server/character/character-build-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { createSupabaseCharacterAttributeRepository } from '@/server/character/supabase-character-attribute-repository'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { toServerErrorResponse } from '@/server/http/error-response'

async function selectedCharacter() {
  const actor = await getAuthenticatedActor()
  const character = await loadSelectedCharacter(actor)
  if (!character) {
    throw new AurevaneError('INVALID_REQUEST', 'Select a character before editing attributes.')
  }
  return { actor, character }
}

export async function GET() {
  try {
    const { actor, character } = await selectedCharacter()
    const allocation = await loadCharacterAttributeAllocation(
      actor.userId,
      character,
      createSupabaseCharacterAttributeRepository(),
    )
    return Response.json({ allocation }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const { actor, character } = await selectedCharacter()
    await assertGameplayMutationAllowed(actor.userId)
    const body = await readObject(request)
    const mode =
      body.mode === 'spend' || body.mode === 'reset' || body.mode === 'convert' ? body.mode : null
    if (!mode) throw new AurevaneError('INVALID_REQUEST', 'Choose a valid attribute action.')

    const attributes = parseAttributes(body.attributes)
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : ''
    const build = await loadCharacterBuildContext(
      actor.userId,
      character,
      createSupabaseCharacterBuildRepository(),
    )
    const outcome = await commitCharacterAttributeAllocation(
      actor.userId,
      character,
      {
        mode: mode as CharacterAttributeChangeMode,
        attributes,
        idempotencyKey,
        primaryDisciplineId: build.current.definition.id,
      },
      createSupabaseCharacterAttributeRepository(),
    )
    return Response.json(outcome, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

async function readObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape')
    return value as Record<string, unknown>
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}

function parseAttributes(value: unknown): CharacterAttributes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AurevaneError('INVALID_REQUEST', 'Provide all six core attributes.')
  }
  const record = value as Record<string, unknown>
  const attributes = {} as CharacterAttributes
  for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
    const candidate = record[attributeId]
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 1) {
      throw new AurevaneError('INVALID_REQUEST', `Provide a valid ${attributeId} value.`)
    }
    attributes[attributeId] = candidate
  }
  return attributes
}
