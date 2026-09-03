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
  CharacterCommittedBuildSnapshotRecord,
  CharacterEquippedDisciplineSkillRecord,
  CharacterLearnedSkillRecord,
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

function parseLearnedSkill(row: unknown): CharacterLearnedSkillRecord | null {
  if (!isRecord(row)) return null
  const contentVersion = integer(row.skill_content_version)
  if (
    typeof row.skill_id !== 'string' ||
    contentVersion === null ||
    typeof row.source_discipline_id !== 'string' ||
    typeof row.learned_at !== 'string'
  ) {
    return null
  }
  return {
    skillId: row.skill_id,
    contentVersion,
    sourceDisciplineId: row.source_discipline_id,
    learnedAt: row.learned_at,
  }
}

function parseEquippedSkill(row: unknown): CharacterEquippedDisciplineSkillRecord | null {
  if (!isRecord(row)) return null
  const slotIndex = integer(row.slot_index)
  const contentVersion = integer(row.skill_content_version)
  if (
    slotIndex === null ||
    slotIndex < 1 ||
    typeof row.skill_id !== 'string' ||
    contentVersion === null ||
    typeof row.source_discipline_id !== 'string' ||
    typeof row.equipped_at !== 'string'
  ) {
    return null
  }
  return {
    slotIndex,
    skillId: row.skill_id,
    contentVersion,
    sourceDisciplineId: row.source_discipline_id,
    equippedAt: row.equipped_at,
  }
}

function parseSnapshotSkill(value: unknown) {
  if (!isRecord(value)) return null
  const slotIndex = integer(value.slotIndex)
  const contentVersion = integer(value.contentVersion)
  if (
    slotIndex === null ||
    typeof value.skillId !== 'string' ||
    contentVersion === null ||
    typeof value.sourceDisciplineId !== 'string'
  ) {
    return null
  }
  return {
    slotIndex,
    skillId: value.skillId,
    contentVersion,
    sourceDisciplineId: value.sourceDisciplineId,
  }
}

function parseSnapshotResonance(
  value: unknown,
): CharacterCommittedBuildSnapshotRecord['extensions']['resonance'] | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const contentVersion = integer(value.contentVersion)
  if (
    typeof value.resonanceId !== 'string' ||
    contentVersion === null ||
    !Array.isArray(value.disciplinePair) ||
    value.disciplinePair.length !== 2 ||
    typeof value.disciplinePair[0] !== 'string' ||
    typeof value.disciplinePair[1] !== 'string'
  ) {
    return undefined
  }
  return {
    resonanceId: value.resonanceId,
    contentVersion,
    disciplinePair: [value.disciplinePair[0], value.disciplinePair[1]],
  }
}

function parseCommittedSnapshot(value: unknown): CharacterCommittedBuildSnapshotRecord | null {
  if (!isRecord(value) || !isRecord(value.primary) || !isRecord(value.extensions)) return null
  const schemaVersion = integer(value.schemaVersion)
  const buildVersion = integer(value.buildVersion)
  const primaryDefinitionVersion = integer(value.primary.definitionVersion)
  const primaryProfileVersion = integer(value.primary.profileVersion)
  if (
    schemaVersion === null ||
    buildVersion === null ||
    typeof value.primary.disciplineId !== 'string' ||
    primaryDefinitionVersion === null ||
    primaryProfileVersion === null ||
    !Array.isArray(value.disciplineSkills) ||
    value.extensions.essence !== null ||
    !Array.isArray(value.extensions.equipmentSkills) ||
    value.extensions.equipmentSkills.length !== 0 ||
    value.extensions.supernatural !== null ||
    value.extensions.prestige !== null
  ) {
    return null
  }

  let secondary: CharacterCommittedBuildSnapshotRecord['secondary'] = null
  if (value.secondary !== null) {
    if (!isRecord(value.secondary)) return null
    const definitionVersion = integer(value.secondary.definitionVersion)
    if (typeof value.secondary.disciplineId !== 'string' || definitionVersion === null) return null
    secondary = { disciplineId: value.secondary.disciplineId, definitionVersion }
  }

  const disciplineSkills = value.disciplineSkills.map(parseSnapshotSkill)
  if (disciplineSkills.some((entry) => entry === null)) return null
  const resonance = parseSnapshotResonance(value.extensions.resonance)
  if (resonance === undefined) return null

  return {
    schemaVersion,
    buildVersion,
    primary: {
      disciplineId: value.primary.disciplineId,
      definitionVersion: primaryDefinitionVersion,
      profileVersion: primaryProfileVersion,
    },
    secondary,
    disciplineSkills: disciplineSkills as CharacterCommittedBuildSnapshotRecord['disciplineSkills'],
    extensions: {
      resonance,
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
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

    async listLearnedSkills(userId, characterId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_character_learned_skills_v1', {
        p_user_id: userId,
        p_character_id: characterId,
      })
      if (error || !Array.isArray(data)) throw unavailable()
      const parsed = data.map(parseLearnedSkill)
      if (parsed.some((entry) => entry === null)) throw unavailable()
      return parsed as CharacterLearnedSkillRecord[]
    },

    async listEquippedDisciplineSkills(userId, characterId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_character_discipline_skill_loadout_v1', {
        p_user_id: userId,
        p_character_id: characterId,
      })
      if (error || !Array.isArray(data)) throw unavailable()
      const parsed = data.map(parseEquippedSkill)
      if (parsed.some((entry) => entry === null)) throw unavailable()
      return parsed as CharacterEquippedDisciplineSkillRecord[]
    },

    async loadCommittedBuildSnapshot(userId, characterId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_character_committed_build_snapshot_v1', {
        p_user_id: userId,
        p_character_id: characterId,
      })
      if (error) throw unavailable()
      if (data === null) return null
      const parsed = parseCommittedSnapshot(data)
      if (!parsed) throw unavailable()
      return parsed
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

    async saveDisciplineSkills(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('save_character_discipline_skill_loadout_v1', {
        p_user_id: input.userId,
        p_character_id: input.characterId,
        p_expected_build_version: input.expectedBuildVersion,
        p_skills: input.skills.map((skill) => ({
          skillId: skill.skillId,
          contentVersion: skill.contentVersion,
          sourceDisciplineId: skill.sourceDisciplineId,
        })),
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      })
      if (error) {
        if (error.message.includes('CHARACTER_BUILD_VERSION_CONFLICT')) {
          throw new AurevaneError(
            'STALE_VERSION',
            'The build changed. Refresh and review the Skills again.',
          )
        }
        if (error.message.includes('CHARACTER_SKILL_LOADOUT_IDEMPOTENCY_CONFLICT')) {
          throw new AurevaneError(
            'IDEMPOTENCY_CONFLICT',
            'That Skill build request key was already used for a different save.',
          )
        }
        if (
          error.message.includes('DISCIPLINE_SKILL_CAPACITY_EXCEEDED') ||
          error.message.includes('DUPLICATE_DISCIPLINE_SKILL') ||
          error.message.includes('DISCIPLINE_SKILL_SOURCE_INACTIVE') ||
          error.message.includes('DISCIPLINE_SKILL_NOT_LEARNED') ||
          error.message.includes('SKILL_LOADOUT_REFERENCE_INVALID') ||
          error.message.includes('SKILL_LOADOUT_INVALID')
        ) {
          throw new AurevaneError('INVALID_REQUEST', 'That Discipline Skill loadout is not legal.')
        }
        throw unavailable()
      }
      const row = Array.isArray(data) && data.length === 1 && isRecord(data[0]) ? data[0] : null
      const buildVersion = row ? integer(row.build_version) : null
      if (!row || buildVersion === null || typeof row.replayed !== 'boolean') throw unavailable()
      return { buildVersion, replayed: row.replayed }
    },
  }
}

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Character build data is unavailable right now.',
  )
}
