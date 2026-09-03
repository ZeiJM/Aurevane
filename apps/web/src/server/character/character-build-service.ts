import 'server-only'

import { createHash } from 'node:crypto'

import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import {
  buildPrimaryDisciplinePreview,
  type DisciplineDefinition,
  type PrimaryDisciplineBaseProfile,
  type PrimaryDisciplinePreview,
} from '@aurevane/game-core/character/discipline-build'
import { AurevaneError } from '@aurevane/game-core/errors'

export interface CharacterActiveBuildRecord {
  characterId: string
  schemaVersion: number
  buildVersion: number
  primaryDefinition: DisciplineDefinition
  primaryProfile: PrimaryDisciplineBaseProfile
  updatedAt: string
}

export interface PrimaryDisciplineCatalogEntry {
  definition: DisciplineDefinition
  profile: PrimaryDisciplineBaseProfile
}

export interface ChangePrimaryDisciplineInput {
  userId: string
  characterId: string
  expectedBuildVersion: number
  primaryDisciplineId: string
  idempotencyKey: string
  requestFingerprint: string
}

export interface CharacterBuildRepository {
  findActiveBuild(userId: string, characterId: string): Promise<CharacterActiveBuildRecord | null>
  listPrimaryDisciplines(): Promise<readonly PrimaryDisciplineCatalogEntry[]>
  changePrimaryDiscipline(
    input: ChangePrimaryDisciplineInput,
  ): Promise<{ build: CharacterActiveBuildRecord; replayed: boolean }>
}

export interface CharacterBuildContext {
  build: CharacterActiveBuildRecord
  current: PrimaryDisciplinePreview
  availablePrimaries: readonly PrimaryDisciplineCatalogEntry[]
}

export interface PrimaryDisciplineChangeResult extends CharacterBuildContext {
  replayed: boolean
}

function calculatePreview(
  character: PersistedCharacter,
  entry: PrimaryDisciplineCatalogEntry,
): PrimaryDisciplinePreview {
  return buildPrimaryDisciplinePreview({
    attributes: character.attributes,
    level: character.level,
    primaryDefinition: entry.definition,
    primaryProfile: entry.profile,
  })
}

export async function loadCharacterBuildContext(
  userId: string,
  character: PersistedCharacter,
  repository: CharacterBuildRepository,
): Promise<CharacterBuildContext> {
  const [build, availablePrimaries] = await Promise.all([
    repository.findActiveBuild(userId, character.id),
    repository.listPrimaryDisciplines(),
  ])
  if (!build) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The character build is unavailable right now.')
  }
  return {
    build,
    current: calculatePreview(character, {
      definition: build.primaryDefinition,
      profile: build.primaryProfile,
    }),
    availablePrimaries,
  }
}

export async function previewCharacterPrimaryDiscipline(
  userId: string,
  character: PersistedCharacter,
  primaryDisciplineId: string,
  repository: CharacterBuildRepository,
): Promise<{ current: PrimaryDisciplinePreview; proposed: PrimaryDisciplinePreview; buildVersion: number }> {
  if (!primaryDisciplineId.trim()) {
    throw new AurevaneError('INVALID_REQUEST', 'Choose a Primary Discipline to preview.')
  }
  const context = await loadCharacterBuildContext(userId, character, repository)
  const proposedEntry = context.availablePrimaries.find(
    (entry) => entry.definition.id === primaryDisciplineId && entry.definition.enabledForPrimary,
  )
  if (!proposedEntry) {
    throw new AurevaneError('INVALID_REQUEST', 'That Primary Discipline is not available.')
  }
  return {
    current: context.current,
    proposed: calculatePreview(character, proposedEntry),
    buildVersion: context.build.buildVersion,
  }
}

export async function changeCharacterPrimaryDiscipline(
  userId: string,
  character: PersistedCharacter,
  input: { expectedBuildVersion: number; primaryDisciplineId: string; idempotencyKey: string },
  repository: CharacterBuildRepository,
): Promise<PrimaryDisciplineChangeResult> {
  if (!Number.isInteger(input.expectedBuildVersion) || input.expectedBuildVersion < 1) {
    throw new AurevaneError('INVALID_REQUEST', 'The build version is invalid. Refresh and try again.')
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey)) {
    throw new AurevaneError('INVALID_REQUEST', 'The build request key is invalid.')
  }

  const catalog = await repository.listPrimaryDisciplines()
  const proposed = catalog.find(
    (entry) =>
      entry.definition.id === input.primaryDisciplineId && entry.definition.enabledForPrimary,
  )
  if (!proposed) {
    throw new AurevaneError('INVALID_REQUEST', 'That Primary Discipline is not available.')
  }

  const requestFingerprint = `sha256:${createHash('sha256')
    .update(
      JSON.stringify({
        command: 'character.primary.change.v1',
        characterId: character.id,
        expectedBuildVersion: input.expectedBuildVersion,
        primaryDisciplineId: input.primaryDisciplineId,
      }),
    )
    .digest('hex')}`

  const changed = await repository.changePrimaryDiscipline({
    userId,
    characterId: character.id,
    expectedBuildVersion: input.expectedBuildVersion,
    primaryDisciplineId: input.primaryDisciplineId,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint,
  })

  return {
    build: changed.build,
    current: calculatePreview(character, {
      definition: changed.build.primaryDefinition,
      profile: changed.build.primaryProfile,
    }),
    availablePrimaries: catalog,
    replayed: changed.replayed,
  }
}
