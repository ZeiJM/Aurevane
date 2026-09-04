import 'server-only'

import type { DisciplineSkillReference } from '@aurevane/game-core/character/discipline-skill-loadout'
import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type {
  CharacterSavedBuildLoadoutActivationResult,
  CharacterSavedBuildLoadoutRecord,
  CharacterSavedBuildLoadoutRepository,
  CharacterSavedBuildLoadoutSaveResult,
} from './character-saved-build-loadout-service'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
}

function parseSkill(value: unknown): DisciplineSkillReference | null {
  if (!isRecord(value)) return null
  const contentVersion = integer(value.contentVersion)
  if (
    typeof value.skillId !== 'string' ||
    contentVersion === null ||
    contentVersion < 1 ||
    typeof value.sourceDisciplineId !== 'string'
  ) {
    return null
  }
  return {
    skillId: value.skillId,
    contentVersion,
    sourceDisciplineId: value.sourceDisciplineId,
  }
}

function parseLoadout(row: unknown): CharacterSavedBuildLoadoutRecord | null {
  if (!isRecord(row) || !Array.isArray(row.discipline_skills)) return null
  const slotIndex = integer(row.slot_index)
  const sourceBuildVersion = integer(row.source_build_version)
  const skills = row.discipline_skills.map(parseSkill)
  if (
    slotIndex === null ||
    slotIndex < 1 ||
    slotIndex > 8 ||
    typeof row.name !== 'string' ||
    typeof row.primary_discipline_id !== 'string' ||
    (row.secondary_discipline_id !== null && typeof row.secondary_discipline_id !== 'string') ||
    sourceBuildVersion === null ||
    sourceBuildVersion < 1 ||
    typeof row.saved_at !== 'string' ||
    typeof row.updated_at !== 'string' ||
    skills.some((skill) => skill === null)
  ) {
    return null
  }
  return {
    slotIndex,
    name: row.name,
    primaryDisciplineId: row.primary_discipline_id,
    secondaryDisciplineId: row.secondary_discipline_id,
    disciplineSkills: skills as DisciplineSkillReference[],
    sourceBuildVersion,
    savedAt: row.saved_at,
    updatedAt: row.updated_at,
  }
}

function parseSaveResult(row: unknown): CharacterSavedBuildLoadoutSaveResult | null {
  if (!isRecord(row)) return null
  const slotIndex = integer(row.slot_index)
  const sourceBuildVersion = integer(row.source_build_version)
  if (
    slotIndex === null ||
    slotIndex < 1 ||
    slotIndex > 8 ||
    typeof row.name !== 'string' ||
    sourceBuildVersion === null ||
    sourceBuildVersion < 1 ||
    typeof row.saved_at !== 'string' ||
    typeof row.replayed !== 'boolean'
  ) {
    return null
  }
  return {
    slotIndex,
    name: row.name,
    sourceBuildVersion,
    savedAt: row.saved_at,
    replayed: row.replayed,
  }
}

function parseActivationResult(row: unknown): CharacterSavedBuildLoadoutActivationResult | null {
  if (!isRecord(row)) return null
  const buildVersion = integer(row.build_version)
  if (
    buildVersion === null ||
    buildVersion < 1 ||
    typeof row.replayed !== 'boolean' ||
    typeof row.activated_at !== 'string'
  ) {
    return null
  }
  return { buildVersion, replayed: row.replayed, activatedAt: row.activated_at }
}

function mutationError(error: { message: string }): AurevaneError {
  if (error.message.includes('CHARACTER_BUILD_VERSION_CONFLICT')) {
    return new AurevaneError('STALE_VERSION', 'The build changed. Refresh and try again.')
  }
  if (
    error.message.includes('SAVED_BUILD_LOADOUT_IDEMPOTENCY_CONFLICT') ||
    error.message.includes('CHARACTER_BUILD_IDEMPOTENCY_CONFLICT') ||
    error.message.includes('CHARACTER_SKILL_LOADOUT_IDEMPOTENCY_CONFLICT')
  ) {
    return new AurevaneError(
      'IDEMPOTENCY_CONFLICT',
      'That saved build request key was already used for a different change.',
    )
  }
  if (
    error.message.includes('PRIMARY_ATTUNEMENT_LOCKED') ||
    error.message.includes('SECONDARY_ATTUNEMENT_LOCKED')
  ) {
    return new AurevaneError(
      'BUILD_ATTUNEMENT_COOLDOWN',
      'A Discipline attunement is still locked. Review the remaining time in Profile.',
    )
  }
  if (error.message.includes('SAVED_BUILD_LOADOUT_NOT_FOUND')) {
    return new AurevaneError('INVALID_REQUEST', 'That saved build loadout no longer exists.')
  }
  if (
    error.message.includes('SAVED_BUILD_LOADOUT_SLOT_INVALID') ||
    error.message.includes('SAVED_BUILD_LOADOUT_NAME_INVALID') ||
    error.message.includes('PRIMARY_DISCIPLINE_UNAVAILABLE') ||
    error.message.includes('SECONDARY_DISCIPLINE_UNAVAILABLE') ||
    error.message.includes('SECONDARY_DISCIPLINE_NOT_MASTERED') ||
    error.message.includes('DISCIPLINE_SLOTS_MUST_DIFFER') ||
    error.message.includes('DISCIPLINE_SKILL_CAPACITY_EXCEEDED') ||
    error.message.includes('DUPLICATE_DISCIPLINE_SKILL') ||
    error.message.includes('DISCIPLINE_SKILL_SOURCE_INACTIVE') ||
    error.message.includes('DISCIPLINE_SKILL_NOT_LEARNED') ||
    error.message.includes('SKILL_LOADOUT_REFERENCE_INVALID') ||
    error.message.includes('SKILL_LOADOUT_INVALID')
  ) {
    return new AurevaneError('INVALID_REQUEST', 'That saved build loadout is not legal.')
  }
  return unavailable()
}

export function createSupabaseCharacterSavedBuildLoadoutRepository(): CharacterSavedBuildLoadoutRepository {
  return {
    async list(userId, characterId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_character_saved_build_loadouts_v1', {
        p_user_id: userId,
        p_character_id: characterId,
      })
      if (error || !Array.isArray(data)) throw unavailable()
      const parsed = data.map(parseLoadout)
      if (parsed.some((entry) => entry === null)) throw unavailable()
      return parsed as CharacterSavedBuildLoadoutRecord[]
    },

    async save(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('save_character_build_loadout_v1', {
        p_user_id: input.userId,
        p_character_id: input.characterId,
        p_slot_index: input.slotIndex,
        p_name: input.name,
        p_expected_build_version: input.expectedBuildVersion,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      })
      if (error) throw mutationError(error)
      const result = Array.isArray(data) && data.length === 1 ? parseSaveResult(data[0]) : null
      if (!result) throw unavailable()
      return result
    },

    async activate(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('activate_character_build_loadout_v1', {
        p_user_id: input.userId,
        p_character_id: input.characterId,
        p_slot_index: input.slotIndex,
        p_expected_build_version: input.expectedBuildVersion,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      })
      if (error) throw mutationError(error)
      const result =
        Array.isArray(data) && data.length === 1 ? parseActivationResult(data[0]) : null
      if (!result) throw unavailable()
      return result
    },
  }
}

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Saved character build loadouts are unavailable right now.',
  )
}
