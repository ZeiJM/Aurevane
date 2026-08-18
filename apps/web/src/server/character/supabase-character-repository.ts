import 'server-only'

import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseCharacterCreationPersistenceRow,
  parseCharacterPersistenceRow,
  type CharacterPersistenceRow,
} from '@aurevane/validation/player/character'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const characterColumns =
  'id, user_id, slot_index, rules_version, name, name_key, presentation_id, pronoun_preset_id, portrait_ref, starter_appearance_ref, foundation_discipline_id, might, finesse, vitality, agility, intellect, resolve, level, xp, progression_cycle, created_at, cycle_started_at, last_active_at'

export function createSupabaseCharacterRepository(): CharacterRepository {
  return {
    async findByOwnerSlot(userId, slotIndex) {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase
        .from('characters')
        .select(characterColumns)
        .eq('user_id', userId)
        .eq('slot_index', slotIndex)
        .maybeSingle()

      if (error) throw unavailable()
      if (!data) return null
      const row = parseCharacterPersistenceRow(data)
      if (!row) throw unavailable()
      return toRecord(row)
    },

    async findByOwnerId(userId, characterId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_character_slots_v2', { p_user_id: userId })
      if (error || !Array.isArray(data)) throw unavailable()

      const candidate = data.find(
        (row) => row && typeof row === 'object' && !Array.isArray(row) && row.id === characterId,
      )
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
      const extended = candidate as Record<string, unknown>
      if (typeof extended.deletion_execute_after === 'string') return null
      const base = { ...extended }
      delete base.deletion_requested_at
      delete base.deletion_execute_after
      delete base.reselect_available_at
      const row = parseCharacterPersistenceRow(base)
      if (!row) throw unavailable()
      return toRecord(row)
    },

    async createBaseCharacter(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('create_character_v3', {
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
        p_might: input.might,
        p_finesse: input.finesse,
        p_vitality: input.vitality,
        p_agility: input.agility,
        p_intellect: input.intellect,
        p_resolve: input.resolve,
      })

      if (error) {
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
