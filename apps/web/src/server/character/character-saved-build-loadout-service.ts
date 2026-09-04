import 'server-only'

import { createHash } from 'node:crypto'

import type { DisciplineSkillReference } from '@aurevane/game-core/character/discipline-skill-loadout'
import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { AurevaneError } from '@aurevane/game-core/errors'

export interface CharacterSavedBuildLoadoutRecord {
  slotIndex: number
  name: string
  primaryDisciplineId: string
  secondaryDisciplineId: string | null
  disciplineSkills: readonly DisciplineSkillReference[]
  sourceBuildVersion: number
  savedAt: string
  updatedAt: string
}

export interface SaveCharacterBuildLoadoutInput {
  userId: string
  characterId: string
  slotIndex: number
  name: string
  expectedBuildVersion: number
  idempotencyKey: string
  requestFingerprint: string
}

export interface ActivateCharacterBuildLoadoutInput {
  userId: string
  characterId: string
  slotIndex: number
  expectedBuildVersion: number
  idempotencyKey: string
  requestFingerprint: string
}

export interface CharacterSavedBuildLoadoutSaveResult {
  slotIndex: number
  name: string
  sourceBuildVersion: number
  savedAt: string
  replayed: boolean
}

export interface CharacterSavedBuildLoadoutActivationResult {
  buildVersion: number
  replayed: boolean
  activatedAt: string
}

export interface CharacterSavedBuildLoadoutRepository {
  list(userId: string, characterId: string): Promise<readonly CharacterSavedBuildLoadoutRecord[]>
  save(input: SaveCharacterBuildLoadoutInput): Promise<CharacterSavedBuildLoadoutSaveResult>
  activate(
    input: ActivateCharacterBuildLoadoutInput,
  ): Promise<CharacterSavedBuildLoadoutActivationResult>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validateSlotIndex(slotIndex: number) {
  if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > 8) {
    throw new AurevaneError('INVALID_REQUEST', 'Choose a saved build slot from 1 through 8.')
  }
}

function validateMutationInput(input: {
  slotIndex: number
  expectedBuildVersion: number
  idempotencyKey: string
}) {
  validateSlotIndex(input.slotIndex)
  if (!Number.isInteger(input.expectedBuildVersion) || input.expectedBuildVersion < 1) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'The build version is invalid. Refresh and try again.',
    )
  }
  if (!UUID_PATTERN.test(input.idempotencyKey)) {
    throw new AurevaneError('INVALID_REQUEST', 'The saved build request key is invalid.')
  }
}

function fingerprint(value: Record<string, unknown>): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

export async function listCharacterSavedBuildLoadouts(
  userId: string,
  characterId: string,
  repository: CharacterSavedBuildLoadoutRepository,
): Promise<readonly CharacterSavedBuildLoadoutRecord[]> {
  return repository.list(userId, characterId)
}

export async function saveCurrentCharacterBuildLoadout(
  userId: string,
  character: PersistedCharacter,
  input: {
    slotIndex: number
    name: string
    expectedBuildVersion: number
    idempotencyKey: string
  },
  repository: CharacterSavedBuildLoadoutRepository,
): Promise<CharacterSavedBuildLoadoutSaveResult> {
  validateMutationInput(input)
  const name = input.name.trim()
  if (name.length < 1 || name.length > 40) {
    throw new AurevaneError('INVALID_REQUEST', 'Saved build names must be 1 to 40 characters.')
  }

  return repository.save({
    userId,
    characterId: character.id,
    slotIndex: input.slotIndex,
    name,
    expectedBuildVersion: input.expectedBuildVersion,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: fingerprint({
      command: 'character.saved-build-loadout.save.v1',
      characterId: character.id,
      slotIndex: input.slotIndex,
      name,
      expectedBuildVersion: input.expectedBuildVersion,
    }),
  })
}

export async function activateCharacterSavedBuildLoadout(
  userId: string,
  character: PersistedCharacter,
  input: {
    slotIndex: number
    expectedBuildVersion: number
    idempotencyKey: string
  },
  repository: CharacterSavedBuildLoadoutRepository,
): Promise<CharacterSavedBuildLoadoutActivationResult> {
  validateMutationInput(input)
  return repository.activate({
    userId,
    characterId: character.id,
    slotIndex: input.slotIndex,
    expectedBuildVersion: input.expectedBuildVersion,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: fingerprint({
      command: 'character.saved-build-loadout.activate.v1',
      characterId: character.id,
      slotIndex: input.slotIndex,
      expectedBuildVersion: input.expectedBuildVersion,
    }),
  })
}
