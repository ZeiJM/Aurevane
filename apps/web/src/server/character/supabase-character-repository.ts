import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import { getFoundationDiscipline } from '@aurevane/game-core/character/foundation-disciplines'
import 'server-only'
import { throwCombatContentAdmissionError } from '../combat/combat-content-admission-error'

import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseCharacterCreationPersistenceRow,
  parseCharacterPersistenceRow,
  type CharacterPersistenceRow,
} from '@aurevane/validation/player/character'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export function createSupabaseCharacterRepository(): CharacterRepository {
  return {
    async findByOwnerSlot(userId, slotIndex) {
      return (
        (await readCurrentOwnedRecords(userId)).find((row) => row.slotIndex === slotIndex) ?? null
      )
    },
    async findByOwnerId(userId, characterId) {
      return (await readCurrentOwnedRecords(userId)).find((row) => row.id === characterId) ?? null
    },

    async createBaseCharacter(input) {
      // Retained direct adapter callers supply the old static seed; recover only
      // their original five choices, then let the actual SQL producer add current Core.
      const legacy = getFoundationDiscipline(input.foundationDisciplineId)
      if (!input.personalBonuses && !legacy) throw unavailable()
      const bonuses =
        input.personalBonuses ??
        (Object.fromEntries(
          CHARACTER_ATTRIBUTE_IDS.map((key) => [key, input[key] - legacy!.baseAttributes[key]]),
        ) as CharacterAttributes)
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('create_character_v4', {
        p_user_id: input.userId,
        p_slot_index: 0,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_rules_version: input.rulesVersion,
        p_name: input.name,
        p_name_key: input.nameKey,
        p_presentation_id: input.presentationId,
        p_pronoun_preset_id: input.pronounPresetId,
        p_portrait_ref: input.portraitRef,
        p_starter_appearance_ref: input.starterAppearanceRef,
        p_foundation_discipline_id: input.foundationDisciplineId,
        p_bonus_might: bonuses.might,
        p_bonus_finesse: bonuses.finesse,
        p_bonus_vitality: bonuses.vitality,
        p_bonus_agility: bonuses.agility,
        p_bonus_intellect: bonuses.intellect,
        p_bonus_resolve: bonuses.resolve,
        p_expected_profile_version: input.expectedProfileVersion ?? null,
      })

      if (error) {
        throwCombatContentAdmissionError(error)
        if (error.message.includes('CHARACTER_CORE_STALE'))
          throw new AurevaneError(
            'INVALID_REQUEST',
            'The Discipline Core changed. Refresh and review your five personal choices.',
          )
        if (error.code === '22023') {
          throw new AurevaneError(
            'IDEMPOTENCY_CONFLICT',
            'That creation request key was already used for different choices.',
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
            'This account already has its base character.',
          )
        }
        throw unavailable()
      }

      const candidate = Array.isArray(data) && data.length === 1 ? data[0] : null
      const row = parseCharacterCreationPersistenceRow(candidate)
      if (!row) throw unavailable()
      return { result: toRecord(row), replayed: row.replayed }
    },
  }
}

async function readCurrentOwnedRecords(userId: string): Promise<CharacterRecord[]> {
  const { data, error } = await createSupabaseAdminClient().rpc('get_character_slots_v3', {
    p_user_id: userId,
  })
  if (error) throwCombatContentAdmissionError(error)
  if (error || !Array.isArray(data) || data.length > 3) throw unavailable()
  return data.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw unavailable()
    if (typeof candidate.deletion_execute_after === 'string') return []
    const base = { ...candidate }
    delete base.deletion_requested_at
    delete base.deletion_execute_after
    delete base.reselect_available_at
    const row = parseCharacterPersistenceRow(base)
    if (!row || row.user_id !== userId) throw unavailable()
    return [toRecord(row)]
  })
}

function toRecord(row: CharacterPersistenceRow): CharacterRecord {
  return {
    id: row.id,
    userId: row.user_id,
    slotIndex: row.slot_index,
    rulesVersion: row.rules_version,
    name: row.name,
    nameKey: row.name_key,
    presentationId: row.presentation_id,
    pronounPresetId: row.pronoun_preset_id,
    portraitRef: row.portrait_ref,
    starterAppearanceRef: row.starter_appearance_ref,
    foundationDisciplineId: row.foundation_discipline_id,
    might: row.might,
    finesse: row.finesse,
    vitality: row.vitality,
    agility: row.agility,
    intellect: row.intellect,
    resolve: row.resolve,
    level: row.level,
    xp: row.xp,
    progressionCycle: row.progression_cycle,
    createdAt: row.created_at,
    cycleStartedAt: row.cycle_started_at,
    lastActiveAt: row.last_active_at,
  }
}

function unavailable(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Character data is unavailable right now.')
}
