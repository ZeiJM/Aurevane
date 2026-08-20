import 'server-only'

import { createHash } from 'node:crypto'

import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import {
  buildInitialCharacterState,
  CharacterCreationRuleError,
  type CharacterCreationIntent,
} from '@aurevane/game-core/character/creation'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseCharacterCreationPersistenceRow,
  parseCharacterPersistenceRow,
  type CharacterPersistenceRow,
} from '@aurevane/validation/player/character'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const CHARACTER_SLOT_COUNT = 3 as const

export interface CharacterSlotCharacter extends PersistedCharacter {
  deletionRequestedAt: string | null
  deletionExecuteAfter: string | null
  reselectAvailableAt: string | null
}

export function isCharacterSlotIndex(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < CHARACTER_SLOT_COUNT
}

export async function loadCharacterSlots(userId: string): Promise<CharacterSlotCharacter[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_character_slots_v2', { p_user_id: userId })
  if (error || !Array.isArray(data)) throw unavailable()

  return data.map((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw unavailable()
    const record = candidate as Record<string, unknown>
    const deletionRequestedAt =
      typeof record.deletion_requested_at === 'string' ? record.deletion_requested_at : null
    const deletionExecuteAfter =
      typeof record.deletion_execute_after === 'string' ? record.deletion_execute_after : null
    const reselectAvailableAt =
      typeof record.reselect_available_at === 'string' ? record.reselect_available_at : null
    const base = { ...record }
    delete base.deletion_requested_at
    delete base.deletion_execute_after
    delete base.reselect_available_at
    const row = parseCharacterPersistenceRow(base)
    if (!row) throw unavailable()
    return {
      ...toPersistedCharacter(row),
      deletionRequestedAt,
      deletionExecuteAfter,
      reselectAvailableAt,
    }
  })
}

export async function findPlayableOwnedCharacterById(
  userId: string,
  characterId: string,
): Promise<PersistedCharacter | null> {
  const character = (await loadCharacterSlots(userId)).find(
    (candidate) => candidate.id === characterId,
  )
  if (!character || character.deletionExecuteAfter) return null
  return character
}

export async function authorizeCharacterSelection(command: {
  userId: string
  fromCharacterId: string | null
  toCharacterId: string
}): Promise<void> {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.rpc('switch_character_v1', {
    p_user_id: command.userId,
    p_from_character_id: command.fromCharacterId,
    p_to_character_id: command.toCharacterId,
  })

  if (!error) return

  if (error.message.includes('CHARACTER_RESELECT_COOLDOWN')) {
    const timestamp = typeof error.details === 'string' ? Date.parse(error.details) : Number.NaN
    const suffix = Number.isFinite(timestamp)
      ? ` You can return after ${new Date(timestamp).toLocaleTimeString('en', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'UTC',
          timeZoneName: 'short',
        })}.`
      : ''
    throw new AurevaneError(
      'CHARACTER_RESELECT_COOLDOWN',
      `That character is resting after a swap. The one-hour return cooldown is still active.${suffix}`,
    )
  }

  if (error.message.includes('CHARACTER_NOT_PLAYABLE')) {
    throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
  }

  throw unavailable()
}

export async function createCharacterInSlot(command: {
  actor: AuthenticatedActor
  slotIndex: number
  idempotencyKey: string
  intent: CharacterCreationIntent
}): Promise<{ character: PersistedCharacter; replayed: boolean }> {
  if (!isCharacterSlotIndex(command.slotIndex)) {
    throw new AurevaneError('INVALID_REQUEST', 'Choose character slot 1, 2, or 3.')
  }

  // During the current pre-monetization/pre-prestige phase the account has one free creation slot.
  // Additional slots are never unlocked by a browser flag: this authoritative route refuses them
  // until their real entitlement sources are implemented. Existing legacy characters in those
  // slots remain playable and are treated as already-unlocked roster positions.
  if (command.slotIndex === 1) {
    throw new AurevaneError(
      'FORBIDDEN',
      'Character slot 2 unlocks through an account slot purchase. Purchases are not available yet.',
    )
  }
  if (command.slotIndex === 2) {
    throw new AurevaneError(
      'FORBIDDEN',
      'Character slot 3 unlocks free after this account completes its first Prestige Rebirth.',
    )
  }

  let seed
  try {
    seed = buildInitialCharacterState(command.intent)
  } catch (error) {
    if (error instanceof CharacterCreationRuleError) {
      const firstIssue = error.issues[0]
      throw new AurevaneError(
        'INVALID_REQUEST',
        firstIssue?.message ?? 'Review the character choices and try again.',
      )
    }
    throw error
  }

  const requestFingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        command: 'character.create.v3',
        slotIndex: command.slotIndex,
        rulesVersion: seed.rulesVersion,
        name: seed.name,
        nameKey: seed.nameKey,
        presentationId: seed.presentationId,
        pronounPresetId: seed.pronounPresetId,
        portraitRef: seed.portraitRef,
        starterAppearanceRef: seed.starterAppearanceRef,
        foundationDisciplineId: seed.foundationDisciplineId,
        attributes: seed.attributes,
      }),
    )
    .digest('hex')

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('create_character_v3', {
    p_user_id: command.actor.userId,
    p_slot_index: command.slotIndex,
    p_idempotency_key: command.idempotencyKey,
    p_request_fingerprint: requestFingerprint,
    p_rules_version: seed.rulesVersion,
    p_name: seed.name,
    p_name_key: seed.nameKey,
    p_presentation_id: seed.presentationId,
    p_pronoun_preset_id: seed.pronounPresetId,
    p_portrait_ref: seed.portraitRef,
    p_starter_appearance_ref: seed.starterAppearanceRef,
    p_foundation_discipline_id: seed.foundationDisciplineId,
    p_might: seed.attributes.might,
    p_finesse: seed.attributes.finesse,
    p_vitality: seed.attributes.vitality,
    p_agility: seed.attributes.agility,
    p_intellect: seed.attributes.intellect,
    p_resolve: seed.attributes.resolve,
  })

  if (error) {
    if (error.code === '22023') {
      throw new AurevaneError(
        'IDEMPOTENCY_CONFLICT',
        'That creation request could not be replayed safely.',
      )
    }
    if (error.message.includes('CHARACTER_NAME_UNAVAILABLE')) {
      throw new AurevaneError(
        'CHARACTER_NAME_UNAVAILABLE',
        'That character name is already claimed.',
      )
    }
    if (error.message.includes('CHARACTER_SLOT_OCCUPIED')) {
      throw new AurevaneError(
        'CHARACTER_ALREADY_EXISTS',
        'That character slot is already occupied.',
      )
    }
    throw unavailable()
  }

  const candidate = Array.isArray(data) && data.length === 1 ? data[0] : null
  const row = parseCharacterCreationPersistenceRow(candidate)
  if (!row || row.user_id !== command.actor.userId || row.slot_index !== command.slotIndex) {
    throw unavailable()
  }

  return { character: toPersistedCharacter(row), replayed: row.replayed }
}

export async function requestCharacterDeletion(
  userId: string,
  characterId: string,
  confirmationPhrase: string,
): Promise<{ requestedAt: string; deleteAfter: string }> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('request_character_deletion_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_confirmation_phrase: confirmationPhrase,
  })
  if (error) {
    if (error.message.includes('CHARACTER_DELETE_CONFIRMATION_MISMATCH')) {
      throw new AurevaneError('INVALID_REQUEST', 'The deletion phrase does not match exactly.')
    }
    if (error.message.includes('CHARACTER_NOT_FOUND')) {
      throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
    }
    throw unavailable()
  }
  const row = Array.isArray(data) && data.length === 1 ? data[0] : null
  if (!row || typeof row.requested_at !== 'string' || typeof row.delete_after !== 'string') {
    throw unavailable()
  }
  return { requestedAt: row.requested_at, deleteAfter: row.delete_after }
}

export async function cancelCharacterDeletion(
  userId: string,
  characterId: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('cancel_character_deletion_v1', {
    p_user_id: userId,
    p_character_id: characterId,
  })
  if (error || typeof data !== 'boolean') throw unavailable()
  return data
}

function toPersistedCharacter(row: CharacterPersistenceRow): PersistedCharacter {
  return {
    id: row.id,
    userId: row.user_id,
    slotIndex: row.slot_index,
    rulesVersion: row.rules_version,
    name: row.name,
    nameKey: row.name_key,
    presentationId: row.presentation_id as PersistedCharacter['presentationId'],
    pronounPresetId: row.pronoun_preset_id as PersistedCharacter['pronounPresetId'],
    portraitRef: row.portrait_ref as PersistedCharacter['portraitRef'],
    starterAppearanceRef: row.starter_appearance_ref as PersistedCharacter['starterAppearanceRef'],
    foundationDisciplineId:
      row.foundation_discipline_id as PersistedCharacter['foundationDisciplineId'],
    attributes: {
      might: row.might,
      finesse: row.finesse,
      vitality: row.vitality,
      agility: row.agility,
      intellect: row.intellect,
      resolve: row.resolve,
    },
    level: row.level,
    xp: row.xp,
    progressionCycle: { number: row.progression_cycle },
    createdAt: row.created_at,
    cycleStartedAt: row.cycle_started_at,
    lastActiveAt: row.last_active_at,
  }
}

function unavailable(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Character data is unavailable right now.')
}
