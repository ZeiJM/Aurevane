import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import {
  compileAppearanceManifest,
  parseAppearanceBlueprint,
} from '@/appearance/appearance-manifest'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { findPlayableOwnedCharacterById } from './character-slot-service'
import { invalidatePublicPeerPortrait } from './public-portrait-cache'

function unavailable() {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Appearance settings are unavailable right now.',
  )
}

export async function loadCharacterAppearance(userId: string, characterId: string) {
  await assertOwnedCharacter(userId, characterId)
  const supabase = createSupabaseAdminClient()
  const [{ data, error }, tokens] = await Promise.all([
    supabase
      .from('character_profile_display')
      .select('appearance_image_url, pending_appearance_image_url, appearance_revision')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .maybeSingle(),
    supabase.rpc('read_character_appearance_tokens_v1', {
      p_user_id: userId,
      p_character_id: characterId,
    }),
  ])
  if (error || tokens.error || !validTokenCount(tokens.data)) throw unavailable()
  return {
    imageUrl: typeof data?.appearance_image_url === 'string' ? data.appearance_image_url : null,
    pendingImageUrl:
      typeof data?.pending_appearance_image_url === 'string'
        ? data.pending_appearance_image_url
        : null,
    revision: typeof data?.appearance_revision === 'number' ? data.appearance_revision : 0,
    appearanceTokens: tokens.data,
  }
}

export async function commitCharacterAppearance(input: {
  userId: string
  characterId: string
  expectedRevision: number
  blueprint: unknown
}) {
  const blueprint = parseAppearanceBlueprint(input.blueprint)
  if (!blueprint) throw new AurevaneError('INVALID_REQUEST', 'Choose compatible appearance parts.')
  const imageUrl = compileAppearanceManifest(blueprint).neutralUrl
  const { data, error } = await createSupabaseAdminClient().rpc('commit_character_appearance_v4', {
    p_user_id: input.userId,
    p_character_id: input.characterId,
    p_expected_revision: input.expectedRevision,
    p_image_url: imageUrl,
  })
  if (error?.message.includes('CHARACTER_APPEARANCE_DUPLICATE')) {
    throw new AurevaneError(
      'STALE_VERSION',
      'Another character already uses this look. Change one or more parts.',
    )
  }
  if (error?.message.includes('CHARACTER_APPEARANCE_STALE')) {
    throw new AurevaneError(
      'STALE_VERSION',
      'Your active appearance changed. Reopen the editor before confirming.',
    )
  }
  if (error?.message.includes('APPEARANCE_TOKEN_REQUIRED')) {
    throw new AurevaneError(
      'STALE_VERSION',
      'You need an Appearance Token to confirm a different look.',
    )
  }
  if (
    error?.message.includes('CHARACTER_NOT_PLAYABLE') ||
    error?.message.includes('ITEM_OWNERSHIP') ||
    error?.message.includes('ITEM_DELETION_PENDING')
  ) {
    throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
  }
  if (
    error ||
    !data ||
    typeof data.revision !== 'number' ||
    !validTokenCount(data.appearanceTokens) ||
    (data.imageUrl !== null && typeof data.imageUrl !== 'string') ||
    (data.pendingImageUrl !== null && typeof data.pendingImageUrl !== 'string')
  )
    throw unavailable()
  invalidatePublicPeerPortrait(input.characterId)
  return {
    imageUrl: data.imageUrl,
    pendingImageUrl: data.pendingImageUrl,
    revision: data.revision,
    appearanceTokens: data.appearanceTokens,
  }
}

function validTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

async function assertOwnedCharacter(userId: string, characterId: string) {
  if (!(await findPlayableOwnedCharacterById(userId, characterId))) {
    throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
  }
}
