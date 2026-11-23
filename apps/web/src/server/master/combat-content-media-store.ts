import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSelectedCharacterRpc } from './selected-character-rpc'
import type { normalizeContentMedia } from './combat-content-media'

export function createContentMediaStore(actorUserId?: string) {
  const client = createSupabaseAdminClient()
  const selectedRpc = createSelectedCharacterRpc((name, parameters) => client.rpc(name, parameters))
  async function rpc(
    name: string,
    parameters: Record<string, unknown>,
    selected = true,
  ): Promise<unknown> {
    const { data, error } = await (selected
      ? selectedRpc(name, { p_actor_user_id: actorUserId, ...parameters })
      : client.rpc(name, parameters))
    if (error)
      throw new AurevaneError(
        error.code === '42501'
          ? 'FORBIDDEN'
          : error.code === '22023'
            ? 'INVALID_REQUEST'
            : 'PERSISTENCE_UNAVAILABLE',
        error.code === '42501'
          ? 'Content media authoring is not available to this actor.'
          : error.code === '22023'
            ? 'The file or finalized media reference is invalid.'
            : 'Content media is temporarily unavailable.',
      )
    return data
  }
  return {
    finalize: (media: Awaited<ReturnType<typeof normalizeContentMedia>>) =>
      rpc('finalize_combat_content_media_v1', {
        p_bytes: `\\x${media.bytes.toString('hex')}`,
        p_descriptor: media.descriptor,
      }),
    read: (id: string | null) => rpc('read_combat_content_media_v1', { p_media_id: id }),
    readPublished: (id: string) =>
      rpc('read_published_combat_content_media_v1', { p_media_id: id }, false),
  }
}
