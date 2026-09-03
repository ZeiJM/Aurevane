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
  PrimaryDisciplineCatalogEntry,
} from './character-build-service'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
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

function parseCatalogEntry(row: unknown): PrimaryDisciplineCatalogEntry | null {
  if (!isRecord(row)) return null
  const definitionVersion = integer(row.definition_version)
  const profileVersion = integer(row.profile_version)
  const statOffsets = parseStatOffsets(row.stat_offsets)
  if (
    typeof row.discipline_id !== 'string' ||
    definitionVersion === null ||
    typeof row.name !== 'string' ||
    typeof row.summary !== 'string' ||
    typeof row.enabled_for_primary !== 'boolean' ||
    profileVersion === null ||
    statOffsets === null
  ) {
    return null
  }
  const definition = {
    id: row.discipline_id,
    definitionVersion,
    name: row.name,
    summary: row.summary,
    enabledForPrimary: row.enabled_for_primary,
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
  return { definition, profile }
}

function parseActiveBuild(row: unknown): CharacterActiveBuildRecord | null {
  if (!isRecord(row)) return null
  const schemaVersion = integer(row.schema_version)
  const buildVersion = integer(row.build_version)
  const definitionVersion = integer(row.primary_definition_version)
  const profileVersion = integer(row.primary_profile_version)
  const statOffsets = parseStatOffsets(row.primary_stat_offsets)
  if (
    typeof row.character_id !== 'string' ||
    schemaVersion === null ||
    buildVersion === null ||
    typeof row.primary_discipline_id !== 'string' ||
    definitionVersion === null ||
    profileVersion === null ||
    typeof row.primary_name !== 'string' ||
    typeof row.primary_summary !== 'string' ||
    typeof row.primary_enabled_for_primary !== 'boolean' ||
    statOffsets === null ||
    typeof row.updated_at !== 'string'
  ) {
    return null
  }
  return {
    characterId: row.character_id,
    schemaVersion,
    buildVersion,
    primaryDefinition: {
      id: row.primary_discipline_id,
      definitionVersion,
      name: row.primary_name,
      summary: row.primary_summary,
      enabledForPrimary: row.primary_enabled_for_primary,
    },
    primaryProfile: {
      disciplineId: row.primary_discipline_id,
      profileVersion,
      statOffsets,
    },
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
    character_id: row.character_id,
    schema_version: 1,
    build_version: row.build_version,
    primary_discipline_id: row.primary_discipline_id,
    primary_definition_version: row.primary_definition_version,
    primary_profile_version: row.primary_profile_version,
    primary_name: row.primary_name,
    primary_summary: row.primary_summary,
    primary_enabled_for_primary: true,
    primary_stat_offsets: row.primary_stat_offsets,
    updated_at: row.changed_at,
  })
  return build ? { build, replayed: row.replayed } : null
}

export function createSupabaseCharacterBuildRepository(): CharacterBuildRepository {
  return {
    async findActiveBuild(userId, characterId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_character_active_build_v1', {
        p_user_id: userId,
        p_character_id: characterId,
      })
      if (error) throw unavailable()
      const row = Array.isArray(data) && data.length === 1 ? parseActiveBuild(data[0]) : null
      if (Array.isArray(data) && data.length === 0) return null
      if (!row) throw unavailable()
      return row
    },

    async listPrimaryDisciplines() {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_primary_discipline_catalog_v1')
      if (error || !Array.isArray(data)) throw unavailable()
      const parsed = data.map(parseCatalogEntry)
      if (parsed.some((entry) => entry === null)) throw unavailable()
      return parsed as PrimaryDisciplineCatalogEntry[]
    },

    async changePrimaryDiscipline(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('change_character_primary_discipline_v1', {
        p_user_id: input.userId,
        p_character_id: input.characterId,
        p_expected_build_version: input.expectedBuildVersion,
        p_primary_discipline_id: input.primaryDisciplineId,
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
        if (
          error.message.includes('PRIMARY_DISCIPLINE_UNAVAILABLE') ||
          error.message.includes('PRIMARY_DISCIPLINE_ALREADY_ACTIVE')
        ) {
          throw new AurevaneError('INVALID_REQUEST', 'That Primary Discipline change is not legal.')
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
