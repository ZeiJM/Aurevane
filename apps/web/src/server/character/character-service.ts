import { createHash } from 'node:crypto'

import type { CharacterRepository, CharacterRecord } from '@aurevane/db/character'
import {
  buildInitialCharacterState,
  CHARACTER_PRESENTATIONS,
  CharacterCreationRuleError,
  PRONOUN_PRESETS,
  type CharacterCreationIntent,
} from '@aurevane/game-core/character/creation'
import { isFoundationDisciplineId } from '@aurevane/game-core/character/foundation-disciplines'
import {
  BASE_CHARACTER_SLOT_INDEX,
  type PersistedCharacter,
} from '@aurevane/game-core/character/persistence'
import {
  isStarterCharacterAppearanceRef,
  isStarterCharacterPortraitRef,
} from '@aurevane/game-core/character/starter-options'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'

const CREATE_CHARACTER_COMMAND = 'character.create.v1'

const presentationIds = new Set<string>(CHARACTER_PRESENTATIONS.map((option) => option.id))
const pronounIds = new Set<string>(PRONOUN_PRESETS.map((option) => option.id))

export interface CreateBaseCharacterCommand {
  actor: AuthenticatedActor
  idempotencyKey: string
  intent: CharacterCreationIntent
}

export async function loadBaseCharacter(
  actor: AuthenticatedActor,
  repository: CharacterRepository,
): Promise<PersistedCharacter | null> {
  const record = await repository.findByOwnerSlot(actor.userId, BASE_CHARACTER_SLOT_INDEX)
  if (!record) {
    return null
  }

  if (record.userId !== actor.userId) {
    throw new AurevaneError('FORBIDDEN', 'That character does not belong to this account.')
  }

  return toPersistedCharacter(record)
}

export async function createBaseCharacter(
  command: CreateBaseCharacterCommand,
  repository: CharacterRepository,
): Promise<{ character: PersistedCharacter; replayed: boolean }> {
  let seed
  try {
    seed = buildInitialCharacterState(command.intent)
  } catch (error) {
    if (error instanceof CharacterCreationRuleError) {
      throw new AurevaneError('INVALID_REQUEST', 'Review the highlighted character choices.')
    }
    throw error
  }

  if (
    !isStarterCharacterPortraitRef(seed.portraitRef) ||
    !isStarterCharacterAppearanceRef(seed.starterAppearanceRef)
  ) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Choose an available starter portrait and appearance.',
    )
  }

  const requestFingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        rulesVersion: seed.rulesVersion,
        name: seed.name,
        nameKey: seed.nameKey,
        presentationId: seed.presentationId,
        pronounPresetId: seed.pronounPresetId,
        portraitRef: seed.portraitRef,
        starterAppearanceRef: seed.starterAppearanceRef,
        foundationDisciplineId: seed.foundationDisciplineId,
        attributes: seed.attributes,
        level: seed.level,
        xp: seed.xp,
        progressionCycle: seed.progressionCycle.number,
      }),
    )
    .digest('hex')

  const outcome = await repository.createBaseCharacter({
    actorKey: `user:${command.actor.userId}`,
    commandName: CREATE_CHARACTER_COMMAND,
    idempotencyKey: command.idempotencyKey,
    requestFingerprint,
    userId: command.actor.userId,
    rulesVersion: seed.rulesVersion,
    name: seed.name,
    nameKey: seed.nameKey,
    presentationId: seed.presentationId,
    pronounPresetId: seed.pronounPresetId,
    portraitRef: seed.portraitRef,
    starterAppearanceRef: seed.starterAppearanceRef,
    foundationDisciplineId: seed.foundationDisciplineId,
    might: seed.attributes.might,
    finesse: seed.attributes.finesse,
    intellect: seed.attributes.intellect,
    resolve: seed.attributes.resolve,
  })

  if (outcome.result.userId !== command.actor.userId) {
    throw new AurevaneError('FORBIDDEN', 'The created character ownership was invalid.')
  }

  return {
    character: toPersistedCharacter(outcome.result),
    replayed: outcome.replayed,
  }
}

function toPersistedCharacter(record: CharacterRecord): PersistedCharacter {
  if (
    !presentationIds.has(record.presentationId) ||
    !pronounIds.has(record.pronounPresetId) ||
    !isStarterCharacterPortraitRef(record.portraitRef) ||
    !isStarterCharacterAppearanceRef(record.starterAppearanceRef) ||
    !isFoundationDisciplineId(record.foundationDisciplineId)
  ) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Character data is unavailable.')
  }

  return {
    id: record.id,
    userId: record.userId,
    slotIndex: record.slotIndex,
    rulesVersion: record.rulesVersion,
    name: record.name,
    nameKey: record.nameKey,
    presentationId: record.presentationId as PersistedCharacter['presentationId'],
    pronounPresetId: record.pronounPresetId as PersistedCharacter['pronounPresetId'],
    portraitRef: record.portraitRef,
    starterAppearanceRef: record.starterAppearanceRef,
    foundationDisciplineId: record.foundationDisciplineId,
    attributes: {
      might: record.might,
      finesse: record.finesse,
      intellect: record.intellect,
      resolve: record.resolve,
    },
    level: record.level,
    xp: record.xp,
    progressionCycle: { number: record.progressionCycle },
    createdAt: record.createdAt,
    cycleStartedAt: record.cycleStartedAt,
    lastActiveAt: record.lastActiveAt,
  }
}
