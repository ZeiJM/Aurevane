import {
  foundationDisciplineAttributePolicy,
  projectAllocationForPrimaryDisciplineChange,
} from '@aurevane/game-core/character/attribute-allocation'
import { buildPrimaryDisciplinePreview } from '@aurevane/game-core/character/discipline-build'
import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  changeCharacterDisciplines,
  loadCharacterBuildContext,
  previewCharacterDisciplines,
  type BuildSelectionInput,
} from '@/server/character/character-build-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { createSupabaseCharacterBuildRepositoryV3 } from '@/server/character/supabase-character-build-repository-v3'
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

function readSelection(body: Record<string, unknown>): BuildSelectionInput {
  const input: BuildSelectionInput = {}
  if (Object.prototype.hasOwnProperty.call(body, 'primaryDisciplineId')) {
    if (typeof body.primaryDisciplineId !== 'string') {
      throw new AurevaneError('INVALID_REQUEST', 'The Primary Discipline selection is invalid.')
    }
    input.primaryDisciplineId = body.primaryDisciplineId
  }
  if (Object.prototype.hasOwnProperty.call(body, 'secondaryDisciplineId')) {
    if (body.secondaryDisciplineId !== null && typeof body.secondaryDisciplineId !== 'string') {
      throw new AurevaneError('INVALID_REQUEST', 'The Secondary Discipline selection is invalid.')
    }
    input.secondaryDisciplineId = body.secondaryDisciplineId as string | null
  }
  return input
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
    const selection = readSelection(await readJson(request))
    const preview = await previewCharacterDisciplines(
      actor.userId,
      character,
      selection,
      createSupabaseCharacterBuildRepository(),
    )

    const currentPolicy = foundationDisciplineAttributePolicy(preview.current.definition.id)
    const proposedPolicy = foundationDisciplineAttributePolicy(preview.proposed.definition.id)
    if (!currentPolicy || !proposedPolicy) {
      throw new AurevaneError('INVALID_REQUEST', 'The selected Primary Discipline is unavailable.')
    }

    const projection = projectAllocationForPrimaryDisciplineChange({
      attributes: character.attributes,
      level: character.level,
      currentPolicy,
      proposedPolicy,
    })
    if (projection.issues.length > 0) {
      throw new AurevaneError(
        'INVALID_REQUEST',
        projection.issues[0]?.message ??
          'That Primary Discipline cannot use the current Core Stats.',
      )
    }

    const alignedPreview = {
      ...preview,
      currentAttributes: character.attributes,
      proposedAttributes: projection.attributes,
      proposed: buildPrimaryDisciplinePreview({
        attributes: projection.attributes,
        level: character.level,
        primaryDefinition: preview.proposed.definition,
        primaryProfile: preview.proposed.profile,
      }),
    }

    return Response.json(
      { preview: alignedPreview },
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
    const selection = readSelection(body)
    const changed = await changeCharacterDisciplines(
      actor.userId,
      character,
      { expectedBuildVersion, idempotencyKey, ...selection },
      createSupabaseCharacterBuildRepositoryV3(),
    )

    const refreshedCharacter = await loadSelectedCharacter(actor)
    if (!refreshedCharacter) {
      throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The updated character is unavailable.')
    }
    const freshContext = await loadCharacterBuildContext(
      actor.userId,
      refreshedCharacter,
      createSupabaseCharacterBuildRepository(),
    )

    return Response.json(
      { context: { ...freshContext, replayed: changed.replayed } },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
