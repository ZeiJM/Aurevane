import 'server-only'

import type {
  CharacterAttributeAllocationView,
  CharacterAttributeRepository,
} from './character-attribute-service'
import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export function createSupabaseCharacterAttributeRepository(): CharacterAttributeRepository {
  return {
    async loadAllocation(userId, characterId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_character_attribute_allocation_v1', {
        p_user_id: userId,
        p_character_id: characterId,
      })
      if (error) throw unavailable()
      const candidate = Array.isArray(data) && data.length === 1 ? data[0] : null
      return candidate ? parseAllocation(candidate) : null
    },

    async commitAllocation(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('commit_character_attribute_allocation_v1', {
        p_user_id: input.userId,
        p_character_id: input.characterId,
        p_mode: input.mode,
        p_might: input.attributes.might,
        p_finesse: input.attributes.finesse,
        p_vitality: input.attributes.vitality,
        p_agility: input.attributes.agility,
        p_intellect: input.attributes.intellect,
        p_resolve: input.attributes.resolve,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      })

      if (error) {
        if (error.message.includes('CHARACTER_ATTRIBUTE_IDEMPOTENCY_CONFLICT')) {
          throw new AurevaneError(
            'IDEMPOTENCY_CONFLICT',
            'That attribute request key was already used for a different allocation.',
          )
        }
        if (error.message.includes('CHARACTER_ATTRIBUTE_RESET_LIMIT_REACHED')) {
          throw new AurevaneError(
            'INVALID_REQUEST',
            'No attribute resets remain in the current 30-day window.',
          )
        }
        if (error.code === '22023') {
          throw new AurevaneError('INVALID_REQUEST', humanizeDatabaseValidation(error.message))
        }
        throw unavailable()
      }

      const candidate = Array.isArray(data) && data.length === 1 ? data[0] : null
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
        throw unavailable()
      const record = candidate as Record<string, unknown>
      return {
        allocation: parseAllocation(record),
        replayed: record.replayed === true,
      }
    },
  }
}

function parseAllocation(value: unknown): CharacterAttributeAllocationView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw unavailable()
  const row = value as Record<string, unknown>
  const allocation: CharacterAttributeAllocationView = {
    characterId: stringField(row.character_id),
    attributes: {
      might: integerField(row.might),
      finesse: integerField(row.finesse),
      vitality: integerField(row.vitality),
      agility: integerField(row.agility),
      intellect: integerField(row.intellect),
      resolve: integerField(row.resolve),
    },
    level: integerField(row.level),
    pointPool: integerField(row.point_pool),
    spentPoints: integerField(row.spent_points),
    unspentPoints: integerField(row.unspent_points),
    resetWindowStartedAt: nullableStringField(row.reset_window_started_at),
    resetUsed: integerField(row.reset_used),
    resetRemaining: integerField(row.reset_remaining),
    resetRenewsAt: nullableStringField(row.reset_renews_at),
    serverNow: stringField(row.server_now),
  }
  return allocation
}

function integerField(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(parsed)) throw unavailable()
  return parsed
}

function stringField(value: unknown): string {
  if (typeof value !== 'string' || !value) throw unavailable()
  return value
}

function nullableStringField(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return stringField(value)
}

function humanizeDatabaseValidation(message: string): string {
  if (message.includes('CHARACTER_ATTRIBUTE_POINT_POOL_EXCEEDED')) {
    return 'That allocation exceeds the character’s available attribute points.'
  }
  if (message.includes('CHARACTER_ATTRIBUTE_SPEND_CANNOT_REDUCE')) {
    return 'Spending earned points cannot reduce existing attributes. Use Reset Attributes to redistribute.'
  }
  if (message.includes('CHARACTER_ATTRIBUTE_RESET_MUST_SPEND_FULL_POOL')) {
    return 'A reset must redistribute the character’s complete available attribute pool.'
  }
  if (message.includes('CHARACTER_ATTRIBUTE_NO_CHANGE')) {
    return 'Change at least one attribute before saving.'
  }
  return 'That attribute allocation is invalid.'
}

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Character attribute allocation is unavailable right now.',
  )
}
