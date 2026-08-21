import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function loadPvpParticipantTitles(
  characterIds: readonly string[],
): Promise<Record<string, string | null>> {
  const uniqueIds = [...new Set(characterIds)]
  if (uniqueIds.length === 0) return {}

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('characters')
    .select('id, personal_title')
    .in('id', uniqueIds)

  if (error || !Array.isArray(data)) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'PvP participant titles could not be loaded safely.',
    )
  }

  const titles: Record<string, string | null> = {}
  for (const row of data) {
    if (!row || typeof row.id !== 'string') continue
    titles[row.id] = typeof row.personal_title === 'string' ? row.personal_title : null
  }
  return titles
}
