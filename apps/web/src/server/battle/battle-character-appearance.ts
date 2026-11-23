import 'server-only'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/** Caller must already have resolved the session and viewer-visible roster. */
export async function loadPinnedBattleCharacterImages(
  battleSessionId: string,
): Promise<ReadonlyMap<string, string | null>> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    'get_battle_character_appearances_v1',
    { p_battle_session_id: battleSessionId },
  )
  if (error || !Array.isArray(data)) return new Map()
  return new Map(
    data.flatMap((row) =>
      typeof row?.character_id === 'string' &&
      (typeof row.image_url === 'string' || row.image_url === null)
        ? [[row.character_id, row.image_url] as const]
        : [],
    ),
  )
}
