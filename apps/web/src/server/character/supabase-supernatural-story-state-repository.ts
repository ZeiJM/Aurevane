import 'server-only'

import type {
  SupernaturalStoryStateRecord,
  SupernaturalStoryStateRepository,
} from '@aurevane/db/supernatural-state'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseSupernaturalStoryStateRow,
  parseSupernaturalStoryTransitionRow,
  type SupernaturalStoryStateRow,
} from '@aurevane/validation/player/supernatural'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Supernatural story state is unavailable right now.',
  )
}

function mapRpcError(error: { code?: string | null; message?: string | null }): AurevaneError {
  const message = error.message ?? ''

  if (message.includes('SUPERNATURAL_IDEMPOTENCY_CONFLICT'))
    return new AurevaneError(
      'IDEMPOTENCY_CONFLICT',
      'That supernatural story command key was already used for a different transition.',
    )

  if (message.includes('SUPERNATURAL_STATE_VERSION_CONFLICT'))
    return new AurevaneError(
      'STALE_VERSION',
      'The supernatural story state changed. Refresh and try again.',
    )

  if (message.includes('CHARACTER_NOT_FOUND'))
    return new AurevaneError('FORBIDDEN', 'That character is unavailable.')

  if (
    message.includes('SUPERNATURAL_') &&
    (message.includes('INVALID') ||
      message.includes('STALE') ||
      message.includes('PERMANENT') ||
      message.includes('NOT_INITIALIZED') ||
      message.includes('ALREADY_INITIALIZED_DIFFERENTLY'))
  )
    return new AurevaneError(
      'INVALID_REQUEST',
      'That supernatural story transition is not available.',
    )

  return unavailable()
}

function oneRow(data: unknown): unknown {
  return Array.isArray(data) && data.length === 1 ? data[0] : null
}

function toRecord(row: SupernaturalStoryStateRow): SupernaturalStoryStateRecord {
  return {
    characterId: row.character_id,
    schemaVersion: row.schema_version,
    stateVersion: row.state_version,
    storyId: row.story_id,
    storyVersion: row.story_version,
    nodeId: row.node_id,
    path: row.path,
    ascensionId: row.ascension_id,
    ascensionContentVersion: row.ascension_content_version,
    severenceId: row.severence_id,
    severenceContentVersion: row.severence_content_version,
    chosenAt: row.chosen_at,
    updatedAt: row.updated_at,
  }
}

export function createSupabaseSupernaturalStoryStateRepository(): SupernaturalStoryStateRepository {
  return {
    async find(userId, characterId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_character_supernatural_story_state_v1', {
        p_user_id: userId,
        p_character_id: characterId,
      })

      if (error) throw mapRpcError(error)
      if (!Array.isArray(data)) throw unavailable()
      if (data.length === 0) return null
      const parsed = parseSupernaturalStoryStateRow(oneRow(data))
      if (!parsed) throw unavailable()
      return toRecord(parsed)
    },

    async initialize(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc(
        'initialize_character_supernatural_story_state_v1',
        {
          p_user_id: input.userId,
          p_character_id: input.characterId,
          p_story_id: input.storyId,
          p_story_version: input.storyVersion,
          p_initial_node_id: input.initialNodeId,
        },
      )

      if (error) throw mapRpcError(error)
      const parsed = parseSupernaturalStoryStateRow(oneRow(data))
      if (!parsed) throw unavailable()
      return toRecord(parsed)
    },

    async commitTransition(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc(
        'commit_character_supernatural_story_transition_v1',
        {
          p_user_id: input.userId,
          p_character_id: input.characterId,
          p_expected_state_version: input.expectedStateVersion,
          p_idempotency_key: input.idempotencyKey,
          p_request_fingerprint: input.requestFingerprint,
          p_transition_id: input.transitionId,
          p_transition_content_version: input.transitionContentVersion,
          p_story_id: input.storyId,
          p_story_version: input.storyVersion,
          p_from_node_id: input.fromNodeId,
          p_to_node_id: input.toNodeId,
          p_next_path: input.nextPath,
          p_ascension_id: input.ascensionId,
          p_ascension_content_version: input.ascensionContentVersion,
          p_severence_id: input.severenceId,
          p_severence_content_version: input.severenceContentVersion,
        },
      )

      if (error) throw mapRpcError(error)
      const parsed = parseSupernaturalStoryTransitionRow(oneRow(data))
      if (!parsed) throw unavailable()
      const { replayed, ...stateRow } = parsed
      return { state: toRecord(stateRow), replayed }
    },
  }
}
