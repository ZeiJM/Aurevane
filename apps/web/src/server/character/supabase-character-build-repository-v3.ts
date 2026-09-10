import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

import type { CharacterBuildRepository } from './character-build-service'
import { createSupabaseCharacterBuildRepository } from './supabase-character-build-repository'

/**
 * Keeps the mature build read/snapshot paths unchanged while routing the one mutation that can
 * change a Primary through the v3 transaction that also moves the fixed Core Stat base.
 */
export function createSupabaseCharacterBuildRepositoryV3(): CharacterBuildRepository {
  const base = createSupabaseCharacterBuildRepository()

  return {
    ...base,
    async changeDisciplines(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('change_character_disciplines_v3', {
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
        if (
          error.message.includes('PRIMARY_ATTUNEMENT_LOCKED') ||
          error.message.includes('SECONDARY_ATTUNEMENT_LOCKED')
        ) {
          throw new AurevaneError(
            'BUILD_ATTUNEMENT_COOLDOWN',
            'That Discipline slot is still locked. Review the remaining time in Profile.',
          )
        }
        if (error.message.includes('CHARACTER_CORE_CONVERSION_REQUIRED')) {
          throw new AurevaneError(
            'INVALID_REQUEST',
            'Redistribute your Core Stats once before changing Primary Discipline.',
          )
        }
        if (error.message.includes('PRIMARY_CORE_ALLOCATION_REQUIRES_REDISTRIBUTION')) {
          throw new AurevaneError(
            'INVALID_REQUEST',
            'Your personal Core Stat investment would exceed the proposed Primary’s off-focus cap. Redistribute first.',
          )
        }
        if (error.code === '22023') {
          throw new AurevaneError('INVALID_REQUEST', 'That Discipline build change is not legal.')
        }
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'Character build data is unavailable right now.',
        )
      }

      const row = Array.isArray(data) && data.length === 1 ? data[0] : null
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'Character build data is unavailable right now.',
        )
      }
      const replayed = (row as Record<string, unknown>).replayed === true
      const build = await base.findActiveBuild(input.userId, input.characterId)
      if (!build) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'Character build data is unavailable right now.',
        )
      }
      return { build, replayed }
    },
  }
}
