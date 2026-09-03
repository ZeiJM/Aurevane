import 'server-only'

import type { DerivedStatId } from '@aurevane/game-core/character/derived-stats'
import {
  validateDisciplineDefinition,
  validatePrimaryDisciplineBaseProfile,
} from '@aurevane/game-core/character/discipline-build'
import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type {
  CharacterActiveBuildRecord,
  CharacterBuildRepository,
  DisciplineCatalogEntry,
} from './character-build-service'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
}

function optionalString(value: unknown): string | null {
  return value === null ? null : typeof value === 'string' ? value : null
}

function parseStatOffsets(value: unknown): Readonly<Partial<Record<DerivedStatId, number>>> | null {
  if (!isRecord(value)) return null
  const result: Partial<Record<DerivedStatId, number>> = {}
  for (const [key, candidate] of Object.entries(value)) {
    if (typeof candidate !== 'number' || !Number.isInteger(candidate)) return null
    result[key as DerivedStatId] = candidate
  }
  return result
}

function parseCatalogEntry(row: unknown): DisciplineCatalogEntry | null {
  if (!isRecord(row)) return null
  const definitionVersion = integer(row.definition_version)
  const profileVersion = integer(row.profile_version)
  const statOffsets = parseStatOffsets(row.stat_offsets)
  const masteredAt = optionalString(row.mastered_at)
  if (
    typeof row.discipline_id !== 'string' ||
    definitionVersion === null ||
    typeof row.name !== 'string' ||
    typeof row.summary !== 'string' ||
    typeof row.enabled_for_primary !== 'boolean' ||
    typeof row.enabled_for_secondary !== 'boolean' ||
    profileVersion === null ||
    statOffsets === null ||
    (row.mastered_at !== null && masteredAt === null)
  ) {
    return null
  }
  const definition = {
    id: row.discipline_id,
    definitionVersion,
    name: row.name,
    summary: row.summary,
    enabledForPrimary: row.enabled_for_primary,
    enabledForSecondary: row.enabled_for_secondary,
  }
  const profile = {
    disciplineId: row.discipline_id,
    profileVersion,
    statOffsets,
  }
  if (
    validateDisciplineDefinition(definition).length > 0 ||
    validatePrimaryDisciplineBaseProfile(profile).length > 0
  ) {
    return null
  }
  return { definition, profile, masteredAt }
}

function parseActiveBuild(row: unknown): CharacterActiveBuildRecord | null {
  if (!isRecord(row)) return null
  const schemaVersion = integer(row.schema_version)
  const buildVersion = integer(row.build_version)
  const primaryDefinitionVersion = integer(row.primary_definition_version)
  const primaryProfileVersion = integer(row.primary_profile_version)
  const primaryStatOffsets = parseStatOffsets(row.primary_stat_offsets)
  const policyVersion = integer(row.attunement_policy_version)
  const primaryCooldownSeconds = integer(row.primary_cooldown_seconds)
  const secondaryCooldownSeconds = integer(row.secondary_cooldown_seconds)
  const primaryLockedUntil = optionalString(row.primary_attunement_locked_until)
  const secondaryLockedUntil = optionalString(row.secondary_attunement_locked_until)
  if (
    typeof row.character_id !== 'string' ||
    schemaVersion === null ||
    buildVersion === null ||
    typeof row.primary_discipline_id !== 'string' ||
    primaryDefinitionVersion === null ||
    primaryProfileVersion === null ||
    typeof row.primary_name !== 'string' ||
    typeof row.primary_summary !== 'string' ||
    typeof row.primary_enabled_for_primary !== 'boolean' ||
    typeof row.primary_enabled_for_secondary !== 'boolean' ||
    primaryStatOffsets === null ||
    policyVersion === null ||
    primaryCooldownSeconds === null ||
    secondaryCooldownSeconds === null ||
    (row.primary_attunement_locked_until !== null && primaryLockedUntil === null) ||
    (row.secondary_attunement_locked_until !== null && secondaryLockedUntil === null) ||
    typeof row.server_now !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    return null
  }

  const primaryDefinition = {
    id: row.primary_discipline_id,
    definitionVersion: primaryDefinitionVersion,
    name: row.primary_name,
    summary: row.primary_summary,
    enabledForPrimary: row.primary_enabled_for_primary,
    enabledForSecondary: row.primary_enabled_for_secondary,
  }
  const primaryProfile = {
    disciplineId: row.primary_discipline_id,
    profileVersion: primaryProfileVersion,
    statOffsets: primaryStatOffsets,
  }
  if (
    validateDisciplineDefinition(primaryDefinition).length > 0 ||
    validatePrimaryDisciplineBaseProfile(primaryProfile).length > 0
  ) {
    return null
  }

  const secondaryId = optionalString(row.secondary_discipline_id)
  const secondaryVersion =
    row.secondary_definition_version === null ? null : integer(row.secondary_definition_version)
  const secondaryName = optionalString(row.secondary_name)
  const secondarySummary = optionalString(row.secondary_summary)
  const secondaryEnabledForPrimary =
    row.secondary_enabled_for_primary === null ? null : row.secondary_enabled_for_primary
  const secondaryEnabledForSecondary =
    row.secondary_enabled_for_secondary === null ? null : row.secondary_enabled_for_secondary

  const hasSecondary = secondaryId !== null
  if (
    hasSecondary !== (secondaryVersion !== null) ||
    hasSecondary !== (secondaryName !== null) ||
    hasSecondary !== (secondarySummary !== null) ||
    hasSecondary !== (typeof secondaryEnabledForPrimary === 'boolean') ||
    hasSecondary !== (typeof secondaryEnabledForSecondary === 'boolean')
  ) {
    return null
  }

  const secondaryDefinition = hasSecondary
    ? {
        id: secondaryId as string,
        definitionVersion: secondaryVersion as number,
        name: secondaryName as string,
        summary: secondarySummary as string,
        enabledForPrimary: secondaryEnabledForPrimary as boolean,
        enabledForSecondary: secondaryEnabledForSecondary as boolean,
      }
    : null
  if (secondaryDefinition && validateDisciplineDefinition(secondaryDefinition).length > 0) {
    return null
  }

  return {
    characterId: row.character_id,
    schemaVersion,
    buildVersion,
    primaryDefinition,
    primaryProfile,
    secondaryDefinition,
    primaryAttunementLockedUntil: primaryLockedUntil,
    secondaryAttunementLockedUntil: secondaryLockedUntil,
    attunementPolicy: {
      version: policyVersion,
      primaryCooldownSeconds,
      secondaryCooldownSeconds,
    },
    serverNow: row.server_now,
    updatedAt: row.updated_at,
  }
}

function parseChangeResult(
  row: unknown,
): { build: CharacterActiveBuildRecord; replayed: boolean } | null {
  if (!isRecord(row) || typeof row.replayed !== 'boolean' || typeof row.changed_at !== 'string') {
    return null
  }
  const build = parseActiveBuild({
    ...row,
    updated_at: row.changed_at,
  })
  return build ? { build, replayed: row.replayed } : null
}

export function createSupabaseCharacterBuildRepository(): CharacterBuildRepository {
  return {
    async findActiveBuild(userId, characterId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_character_active_build_v2', {
        p_user_id: userId,
        p_character_id: characterId,
      })
      if (error) throw unavailable()
      const row = Array.isArray(data) && data.length === 1 ? parseActiveBuild(data[0]) : null
      if (Array.isArray(data) && data.length === 0) return null
      if (!row) throw unavailable()
      return row
    },

    async listDisciplines(userId, characterId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_character_discipline_catalog_v2', {
        p_user_id: userId,
        p_character_id: characterId,
      })
      if (error || !Array.isArray(data)) throw unavailable()
      const parsed = data.map(parseCatalogEntry)
      if (parsed.some((entry) => entry === null)) throw unavailable()
      return parsed as DisciplineCatalogEntry[]
    },

    async changeDisciplines(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('change_character_disciplines_v2', {
        p_user_id: input.userId,
        p_character_id: input.characterId,
        p_expected_build_version: input.expectedBuildVersion,
        p_change_primary: input.changePrimary,
        p_primary_discipline_id: input.primaryDisciplineId,
        p_change_secondary: input.changeSecondary,
        p_secondary_discipline_id: input.secondaryDisciplineId,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      })
      if (error) {
        if (error.message.includes('CHARACTER_BUILD_VERSION_CONFLICT')) {
          throw new AurevaneError(
            'STALE_VERSION',
            'The build changed. Refresh and review it again.',
          )
        }
        if (error.message.includes('CHARACTER_BUILD_IDEMPOTENCY_CONFLICT')) {
          throw new AurevaneError(
            'IDEMPOTENCY_CONFLICT',
            'That build request key was already used for a different change.',
          )
        }
        if (error.message.includes('PRIMARY_ATTUNEMENT_LOCKED')) {
          throw new AurevaneError(
            'BUILD_ATTUNEMENT_COOLDOWN',
            'Primary attunement is still locked. Review the remaining time in Profile.',
          )
        }
        if (error.message.includes('SECONDARY_ATTUNEMENT_LOCKED')) {
          throw new AurevaneError(
            'BUILD_ATTUNEMENT_COOLDOWN',
            'Secondary attunement is still locked. Review the remaining time in Profile.',
          )
        }
        if (
          error.message.includes('PRIMARY_DISCIPLINE_UNAVAILABLE') ||
          error.message.includes('SECONDARY_DISCIPLINE_UNAVAILABLE') ||
          error.message.includes('SECONDARY_DISCIPLINE_NOT_MASTERED') ||
          error.message.includes('DISCIPLINE_SLOTS_MUST_DIFFER') ||
          error.message.includes('PRIMARY_DISCIPLINE_ALREADY_ACTIVE') ||
          error.message.includes('SECONDARY_DISCIPLINE_ALREADY_ACTIVE') ||
          error.message.includes('CHARACTER_BUILD_NO_CHANGE')
        ) {
          throw new AurevaneError('INVALID_REQUEST', 'That Discipline build change is not legal.')
        }
        throw unavailable()
      }
      const candidate = Array.isArray(data) && data.length === 1 ? parseChangeResult(data[0]) : null
      if (!candidate) throw unavailable()
      return candidate
    },
  }
}

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Character build data is unavailable right now.',
  )
}
